/**
 * Transient-failure retry policy for the TrusTrove web app (issue #639).
 *
 * ## What this module is for
 *
 * Issue #639 observed that a single transient gateway blip (a 503 from the
 * indexer API, a dropped socket) surfaces to the user as a hard failure even
 * though the UI copy — "Service Temporarily Unavailable. Please try again
 * later." — implies the operation is worth retrying. This module centralises
 * the *policy* for that: which failures are transient, how long to wait
 * between attempts, and — critically — which operations are allowed to be
 * retried automatically at all.
 *
 * ## Why automatic retry is enabled for reads and DISABLED for mutations
 *
 * A previous attempt at #639 (PR #713) was rejected. The maintainer's
 * requirement, verbatim:
 *
 * > "`mutationRetryPolicy` is spread onto on-chain `createInvoice`,
 * > `fundInvoice`, `deposit`, `withdraw`, `repayInvoice`, and other
 * > non-idempotent mutations. A timeout or network error can occur after a
 * > transaction is submitted, so automatically rerunning the mutation can
 * > submit a second money-moving transaction. Issue #639 suggests bounded
 * > retries for *idempotent* mutations. Please restrict automatic retry to
 * > operations with verified idempotency, or confirm the original transaction
 * > outcome by hash / use a stable idempotency key before resubmission."
 *
 * That constraint is binding, and in this codebase it rules out automatic
 * retry for *every* mutation we currently have:
 *
 * - The money-moving mutations do not go over HTTP at all. `PoolClient.deposit`,
 *   `PoolClient.withdraw`, `PoolClient.fundInvoice`, `InvoiceClient.repay`,
 *   `InvoiceClient.listForFinancing`, `InvoiceClient.markShipped`,
 *   `InvoiceClient.confirmDelivery`, `InvoiceClient.triggerDefault` and the
 *   `RegistryClient` registrations build, sign (via Freighter) and submit a
 *   Stellar transaction. A timeout or network error raised by the submit/poll
 *   step is **ambiguous**: it proves only that we lost the response, not that
 *   the transaction failed. The ledger may already have applied it. Re-running
 *   the mutation function would build and submit a *second* transaction, so a
 *   retry can double a deposit, a withdrawal or a repayment.
 *
 * - The one mutation that does use HTTP, `createInvoice` -> `POST /invoices`,
 *   is likewise non-idempotent: the backend has no idempotency-key support
 *   (`grep -ri idempoten` over the repository matches only unrelated indexer
 *   and store tests), so a replayed POST creates a duplicate invoice.
 *
 * Reads are different. `GET /pool/stats`, `GET /invoices`, `GET /stats` and
 * friends have no side effects, so repeating one can only cost a round trip.
 *
 * ## If you are here to add a retry to a mutation: please don't
 *
 * {@link MUTATION_RETRY_DISABLED} exists so that "mutations do not retry" is a
 * named, greppable, documented decision rather than an accidental omission of
 * react-query's `retry` option. Enabling automatic retry for a money-moving
 * mutation is safe only once one of the following exists, and neither does
 * today:
 *
 * 1. Server-side idempotency keys: the client sends a stable key with the
 *    request and the backend returns the original outcome for a replay.
 * 2. Outcome confirmation: before resubmitting, look up the original
 *    transaction by hash and resubmit only if the ledger shows it never
 *    applied. For a Stellar transaction this also requires reusing the same
 *    signed envelope / sequence number, so a replay cannot apply twice.
 *
 * Until then the safe alternative — the one issue #639 itself offers as the
 * "or at minimum" option — is a user-initiated retry: surface the failure and
 * let the user re-invoke the mutation deliberately. A human pressing "Retry"
 * has seen the error and accepts the risk; a silent background retry does not.
 *
 * The regression test
 * `apps/web/regression/audit-012-financial-mutation-retry-safety.test.ts`
 * locks this in: it drives the real hooks through an ambiguous post-submit
 * network failure and asserts exactly one on-chain submission per user action.
 *
 * This module deliberately has no imports. In particular it does not import
 * from `@/lib/api`, so error classification stays structural (duck-typed) and
 * this policy can be unit-tested and reused without pulling in the HTTP client.
 */

/**
 * HTTP statuses worth retrying for a side-effect-free read.
 *
 * - `429` Too Many Requests — backing off is the documented remedy.
 * - `502` / `503` / `504` — gateway, overload and upstream-timeout responses
 *   from the indexer API; these are the exact statuses `apiFetch` already
 *   describes to the user as temporary.
 *
 * Deliberately excluded: `4xx` statuses other than `429` (the request itself
 * is wrong, so repeating it cannot help) and `500`, which in this backend
 * signals an unhandled error rather than a load-shedding gateway.
 */
export const TRANSIENT_HTTP_STATUSES: readonly number[] = [429, 502, 503, 504];

/**
 * Maximum number of automatic retries for a READ query, i.e. up to three
 * attempts in total. Bounded on purpose: an unbounded retry loop against a
 * struggling API makes an outage worse.
 */
export const MAX_TRANSIENT_QUERY_RETRIES = 2;

/**
 * react-query `retry` value for every mutation: never retry automatically.
 *
 * Exported as a named, documented constant so the "no automatic retry on
 * money-moving mutations" decision is explicit and greppable rather than an
 * accidental omission. See this module's header for the full reasoning and the
 * maintainer requirement it satisfies.
 *
 * @example
 * ```ts
 * useMutation({
 *   mutationFn: deposit,
 *   // A lost response does not prove the deposit failed (#639).
 *   retry: MUTATION_RETRY_DISABLED,
 * });
 * ```
 */
export const MUTATION_RETRY_DISABLED = 0;

/** Base delay for the first retry, in milliseconds. */
export const TRANSIENT_RETRY_BASE_DELAY_MS = 300;

/**
 * Upper bound on a single backoff delay, in milliseconds. A read that is
 * already stale is not worth making the user wait longer than this for.
 */
export const TRANSIENT_RETRY_MAX_DELAY_MS = 8000;

/**
 * Highest exponent applied to the base delay. Guards against `2 ** huge`
 * producing `Infinity` before {@link TRANSIENT_RETRY_MAX_DELAY_MS} clamps it.
 */
const MAX_BACKOFF_EXPONENT = 20;

/**
 * Substrings that mark a plain `Error` message as a connectivity failure.
 *
 * These mirror the `"network"` branch of `classifyError` in `@/lib/errors`
 * ("network", "fetch", "timeout") plus the common Node/undici codes, so the
 * two modules agree on what connectivity looks like. The heuristic is only
 * consulted when the error carries no `kind` and no numeric `status`, i.e.
 * when there is no better signal available.
 */
const TRANSIENT_MESSAGE_MARKERS = [
  "timeout",
  "timed out",
  "etimedout",
  "network",
  "fetch",
  "econnreset",
  "econnrefused",
  "socket hang up",
] as const;

/**
 * Structural view of the error shapes this module understands.
 *
 * `@/lib/api` throws an `ApiError extends Error` carrying `kind` and `status`.
 * We duck-type those two properties rather than importing the class, so this
 * policy module stays dependency-free and does not break when the HTTP client
 * is refactored. There is intentionally no `instanceof` check anywhere here.
 */
interface ErrorLike {
  readonly kind?: unknown;
  readonly status?: unknown;
  readonly name?: unknown;
  readonly message?: unknown;
}

function asErrorLike(err: unknown): ErrorLike | null {
  if (typeof err !== "object" || err === null) return null;
  return err as ErrorLike;
}

/**
 * True when the value is a deliberate cancellation rather than a failure.
 *
 * Covers both the `kind: "aborted"` shape thrown by `@/lib/api` and the
 * `AbortError` `DOMException` the platform raises when an `AbortController`
 * fires. A user navigating away or a component unmounting must never be turned
 * into a retry, and must never be reported as a server problem.
 */
function isAbortLike(err: ErrorLike): boolean {
  if (err.kind === "aborted") return true;
  return err.name === "AbortError";
}

function isTransientStatus(status: unknown): boolean {
  return (
    typeof status === "number" &&
    Number.isInteger(status) &&
    TRANSIENT_HTTP_STATUSES.includes(status)
  );
}

function hasTransientMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return TRANSIENT_MESSAGE_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

/**
 * Classifies an unknown thrown value as a transient failure that is worth
 * retrying, using structural checks only.
 *
 * Classification order:
 * 1. Non-objects (`null`, `undefined`, strings, numbers) are **not** retryable.
 *    We cannot reason about them, and guessing favours resubmission.
 * 2. Aborts are **not** retryable — see {@link isAbortLike}.
 * 3. `kind: "http"` is decided solely by `status` against
 *    {@link TRANSIENT_HTTP_STATUSES}. The message is not consulted, so a 400
 *    whose body happens to mention "network" stays non-retryable.
 * 4. `kind: "network"` or `kind: "timeout"` are retryable.
 * 5. Otherwise a numeric `status` is checked against
 *    {@link TRANSIENT_HTTP_STATUSES}, for bare `{ status }` objects.
 * 6. Otherwise a plain `Error` whose message reads as a connectivity failure
 *    is retryable.
 *
 * Note that "retryable" here describes the *error*, not the operation. Whether
 * the operation may be retried at all is a separate decision: see
 * {@link MUTATION_RETRY_DISABLED}.
 *
 * @param err - Any thrown value.
 * @returns `true` only when the failure looks transient and repeating the
 *   request could plausibly succeed.
 */
export function isRetryableTransientError(err: unknown): boolean {
  const candidate = asErrorLike(err);
  if (!candidate) return false;
  if (isAbortLike(candidate)) return false;

  if (candidate.kind === "http") {
    return isTransientStatus(candidate.status);
  }
  if (candidate.kind === "network" || candidate.kind === "timeout") {
    return true;
  }
  if (isTransientStatus(candidate.status)) {
    return true;
  }
  return hasTransientMessage(candidate.message);
}

/**
 * Deterministic exponential backoff.
 *
 * There is no jitter and no `Math.random()`: tests assert exact delays, and
 * the single-client read traffic this policy governs has no thundering-herd
 * problem for jitter to solve.
 *
 * @param attemptIndex - Zero-based count of failures so far, matching the
 *   `failureCount` react-query passes to `retryDelay` (0 for the delay before
 *   the first retry). Negative and non-finite values are treated as 0.
 * @param baseDelayMs - Delay before the first retry; defaults to
 *   {@link TRANSIENT_RETRY_BASE_DELAY_MS}. Non-finite or negative values fall
 *   back to the default.
 * @returns A delay in milliseconds, never above
 *   {@link TRANSIENT_RETRY_MAX_DELAY_MS}.
 *
 * @example
 * ```ts
 * transientRetryDelayMs(0); // 300
 * transientRetryDelayMs(1); // 600
 * transientRetryDelayMs(2); // 1200
 * ```
 */
export function transientRetryDelayMs(
  attemptIndex: number,
  baseDelayMs: number = TRANSIENT_RETRY_BASE_DELAY_MS,
): number {
  const base =
    Number.isFinite(baseDelayMs) && baseDelayMs >= 0
      ? baseDelayMs
      : TRANSIENT_RETRY_BASE_DELAY_MS;

  const safeIndex =
    Number.isFinite(attemptIndex) && attemptIndex > 0
      ? Math.min(Math.floor(attemptIndex), MAX_BACKOFF_EXPONENT)
      : 0;

  return Math.min(base * 2 ** safeIndex, TRANSIENT_RETRY_MAX_DELAY_MS);
}

/**
 * Drop-in react-query `retry` predicate for READ queries.
 *
 * Pair it with {@link transientRetryDelayMs} as `retryDelay`:
 *
 * @example
 * ```ts
 * useQuery({
 *   queryKey: ["poolStats"],
 *   queryFn: getPoolStats,
 *   retry: retryTransientQuery,
 *   retryDelay: transientRetryDelayMs,
 * });
 * ```
 *
 * @param failureCount - Zero-based number of failures so far, as react-query
 *   supplies it (0 when deciding whether to make the first retry).
 * @param err - The value the query function threw.
 * @returns `true` while the failure is transient and the
 *   {@link MAX_TRANSIENT_QUERY_RETRIES} budget is not yet spent.
 */
export function retryTransientQuery(
  failureCount: number,
  err: unknown,
): boolean {
  if (!Number.isFinite(failureCount)) return false;
  if (failureCount >= MAX_TRANSIENT_QUERY_RETRIES) return false;
  return isRetryableTransientError(err);
}
