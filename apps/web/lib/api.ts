import { useWalletStore } from "@/store/wallet";
import { parseInvoiceResponse } from "@/lib/parsers";
// Single source of truth for which HTTP statuses count as transient. Lives in
// lib/retry.ts, which deliberately has no imports, so this stays one-way.
import { TRANSIENT_HTTP_STATUSES } from "@/lib/retry";
import {
  AssetType,
  Invoice,
  PoolStats,
  LPPosition,
  EventLog,
  PoolSnapshot,
} from "@/types";

/**
 * Raw snake_case wire shapes returned by the indexer API. These mirror the
 * documented payloads in docs/developer-guide/indexer-api-reference.md so the
 * network boundaries in `apiFetch` are typed instead of `any`. Fields that
 * only appear for later lifecycle stages are optional; the normalization
 * helpers below tolerate their absence.
 */

/** Wire shape for `GET /invoices` and `GET /invoices/:id`. */
interface RawInvoice {
  id: string;
  issuer: string;
  buyer: string;
  face_value: string;
  funded_amount?: string;
  discount_bps?: number;
  due_date?: number;
  status?: string;
  created_at?: number;
  funded_at?: number | null;
  shipped_at?: number | null;
  repaid_at?: number | null;
  listed_at?: number | null;
  issuer_confirmed_at?: number | null;
  buyer_confirmed_at?: number | null;
  defaulted_at?: number | null;
  issuer_confirmed?: boolean;
  buyer_confirmed?: boolean;
  transaction_hashes?: unknown;
  tx_hashes?: unknown;
  created_tx_hash?: unknown;
  listed_tx_hash?: unknown;
  funded_tx_hash?: unknown;
  shipped_tx_hash?: unknown;
  issuer_confirmed_tx_hash?: unknown;
  buyer_confirmed_tx_hash?: unknown;
  repaid_tx_hash?: unknown;
  defaulted_tx_hash?: unknown;
}

/** Wire shape for `GET /pool/stats`. */
interface RawPoolStats {
  total_deposits: string;
  total_funded: string;
  available_liquidity: string;
  utilization_rate_bps: number;
  total_yield_distributed: string;
  active_invoice_count: number;
  total_shares?: string;
}

/** Wire shape for `GET /pool/position/:address`. */
interface RawLPPosition {
  shares: string;
  usdc_value: string;
  yield_earned: string;
  deposit_count: number;
}

/** Wire shape for `GET /events`. */
interface RawEventLog {
  id: number;
  event_id: string;
  contract_id: string;
  ledger: number;
  ledger_closed_at: number;
  event_type: string;
  data: Record<string, unknown>;
}

const getApiUrl = () => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
};

/**
 * Default per-request timeout, in milliseconds.
 *
 * Every request is handed an `AbortSignal` that fires after this long, so a
 * hung backend can no longer leave a request pending forever (issue #638).
 * Several hooks poll on 15s/30s/45s/60s `refetchInterval`s, so without a
 * ceiling a single stuck request lets new ones stack on top of it. Override
 * per request with {@link ApiRequestOptions.timeoutMs}.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Default number of retries attempted *after* the first one, i.e. three
 * attempts in total. Only safe methods are retried — see
 * {@link RETRYABLE_METHODS}.
 */
export const DEFAULT_RETRY_ATTEMPTS = 2;

/**
 * Default base delay of the retry backoff, in milliseconds. Retry `n` waits
 * `baseDelayMs * 2 ** (n - 1)`, so the defaults wait 300ms then 600ms. The
 * backoff is deliberately deterministic (no random jitter) so tests of the
 * retry path cannot flake.
 */
export const DEFAULT_RETRY_BASE_DELAY_MS = 300;

/** Per-request overrides for the bounded retry of safe methods. */
export interface ApiRetryOptions {
  /**
   * Maximum number of retries after the first attempt. Defaults to
   * {@link DEFAULT_RETRY_ATTEMPTS} (2, so 3 attempts total). `0` disables
   * retrying entirely.
   */
  attempts?: number;
  /**
   * Base backoff delay in milliseconds; retry `n` waits
   * `baseDelayMs * 2 ** (n - 1)`. Defaults to
   * {@link DEFAULT_RETRY_BASE_DELAY_MS}. `0` retries immediately without
   * scheduling a timer, which keeps tests fast and timer-free.
   */
  baseDelayMs?: number;
}

/**
 * Options accepted by every API function: a standard `fetch` `RequestInit`
 * plus TrusTrove-specific timeout and retry overrides.
 *
 * Pass `signal` to tie a request to a caller's lifetime — react-query hands
 * its `queryFn` an `AbortSignal` that it aborts when a query is cancelled
 * (route change, unmount, refetch), and forwarding it here cancels the
 * underlying `fetch` instead of letting it run to completion.
 */
export interface ApiRequestOptions extends RequestInit {
  /**
   * Per-request timeout in milliseconds. Defaults to
   * {@link DEFAULT_REQUEST_TIMEOUT_MS}. Pass `0` or `Infinity` to disable the
   * timeout (the caller's own `signal`, if any, still applies).
   */
  timeoutMs?: number;
  /** Retry overrides; see {@link ApiRetryOptions}. */
  retry?: ApiRetryOptions;
}

/**
 * Discriminates why a request failed.
 *
 * - `"http"` — the server answered with a non-OK status (see `ApiError.status`).
 * - `"network"` — `fetch` itself rejected (DNS, TLS, connection refused…).
 * - `"timeout"` — the request exceeded its {@link ApiRequestOptions.timeoutMs}.
 * - `"aborted"` — the *caller* cancelled the request through its own `signal`.
 *   This is a deliberate cancellation, not a failure, and is never retried.
 */
export type ApiErrorKind = "http" | "network" | "timeout" | "aborted";

/**
 * Error thrown by {@link apiFetch} for every failure mode.
 *
 * It extends `Error` and keeps the exact same `message` text the API layer
 * produced before kinds existed, so `classifyError` and existing callers keep
 * working unchanged; `kind` and `status` are purely additive context.
 *
 * @example
 * ```ts
 * try {
 *   await getPoolStats();
 * } catch (err) {
 *   if (err instanceof ApiError && err.kind === "timeout") retryLater();
 * }
 * ```
 */
export class ApiError extends Error {
  /** Why the request failed. */
  readonly kind: ApiErrorKind;
  /** HTTP status for `kind === "http"`, otherwise `null`. */
  readonly status: number | null;
  /** The API path that was requested (e.g. `/invoices/123`). */
  readonly path: string;

  /**
   * @param params - Error configuration.
   *   - `kind` — Why the request failed.
   *   - `status` — HTTP status, for `kind === "http"` only.
   *   - `path` — The requested API path.
   *   - `message` — Human-readable description of what went wrong.
   */
  constructor(params: {
    kind: ApiErrorKind;
    status?: number | null;
    path: string;
    message: string;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.path = params.path;
  }
}

/**
 * Whether an error is worth retrying.
 *
 * `true` for the {@link TRANSIENT_HTTP_STATUSES} and for the `"network"`/
 * `"timeout"` kinds.
 * Deliberately `false` for `kind === "aborted"`: a caller cancellation is not
 * a failure, and retrying it would defeat the cancellation. Also `false` for
 * anything that is not an {@link ApiError}, since nothing is known about it.
 *
 * @param err - The error value to inspect.
 * @returns `true` when the request may be safely attempted again.
 */
export function isTransientApiError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.kind === "aborted") return false;
  if (err.kind === "network" || err.kind === "timeout") return true;
  return err.status !== null && TRANSIENT_HTTP_STATUSES.includes(err.status);
}

/**
 * HTTP methods whose requests may be retried.
 *
 * ---------------------------------------------------------------------------
 * FINANCIAL SAFETY: only idempotent/safe methods are ever retried.
 * POST/PUT/PATCH/DELETE are NEVER retried. The backend has NO idempotency-key
 * support (verified: `grep -ri idempoten` across the repo finds nothing in the
 * indexer API), and `POST /invoices` creates an invoice, so a replayed request
 * would create a duplicate invoice. A failed mutation must surface to the
 * caller instead of being silently replayed.
 * ---------------------------------------------------------------------------
 */
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Whether `method` (absent means `GET`) is safe to replay. See {@link RETRYABLE_METHODS}. */
function isRetryableMethod(method?: string): boolean {
  if (!method) return true;
  return RETRYABLE_METHODS.has(method.toUpperCase());
}

/**
 * Normalizes {@link ApiRequestOptions.timeoutMs} into a positive, finite
 * millisecond budget, or `null` when the timeout is disabled.
 */
function resolveTimeoutMs(timeoutMs?: number): number | null {
  const value = timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Builds the error used when a request exceeds its timeout budget. */
function timeoutApiError(path: string, limitMs: number): ApiError {
  // The word "timeout" must stay in this message: `classifyError` in
  // lib/errors.ts classifies messages containing it as "network".
  return new ApiError({
    kind: "timeout",
    path,
    message: `Request timeout: ${path} did not respond within ${limitMs}ms`,
  });
}

/**
 * Builds the error used when the caller cancelled the request. Kept free of
 * any server or timeout wording so a cancellation is never mistaken for a
 * failure in logs or toasts.
 */
function cancelledApiError(path: string): ApiError {
  return new ApiError({
    kind: "aborted",
    path,
    message: `Request to ${path} was cancelled by the caller`,
  });
}

/** Builds the error used when `fetch` itself rejected. */
function networkApiError(err: unknown, path: string): ApiError {
  // Preserve the original message (e.g. "Failed to fetch") so `classifyError`
  // and existing assertions keep seeing the text they saw before.
  const message =
    err instanceof Error && err.message
      ? err.message
      : `Network request to ${path} failed`;
  const apiError = new ApiError({ kind: "network", path, message });
  apiError.cause = err;
  return apiError;
}

/** Whether a rejection value is a DOM `AbortError`. */
function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

/** A caller signal plus the timeout signal, combined into the one `fetch` sees. */
interface ComposedSignal {
  signal: AbortSignal;
  /** Removes any listener the composition installed. Always called in `finally`. */
  cleanup: () => void;
}

/**
 * Combines several abort signals into one that aborts as soon as *any* of them
 * does.
 *
 * Uses the native `AbortSignal.any` when the runtime provides it, and falls
 * back to forwarding `abort` events into a local `AbortController` otherwise
 * (older jsdom/Node builds). The fallback removes its listeners through
 * {@link ComposedSignal.cleanup} so nothing leaks.
 */
function composeAbortSignals(signals: AbortSignal[]): ComposedSignal {
  if (signals.length === 1) {
    return { signal: signals[0], cleanup: () => {} };
  }

  const signalAny = (
    AbortSignal as unknown as {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;
  if (typeof signalAny === "function") {
    return { signal: signalAny.call(AbortSignal, signals), cleanup: () => {} };
  }

  const controller = new AbortController();
  const alreadyAborted = signals.find((signal) => signal.aborted);
  if (alreadyAborted) {
    controller.abort(alreadyAborted.reason);
    return { signal: controller.signal, cleanup: () => {} };
  }

  const listeners = signals.map((signal) => {
    const onAbort = () => {
      if (!controller.signal.aborted) controller.abort(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return { signal, onAbort };
  });

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const { signal, onAbort } of listeners) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

/**
 * Waits `ms` milliseconds, rejecting early if `signal` aborts so a cancelled
 * request short-circuits the retry backoff instead of sleeping it out. `ms <= 0`
 * resolves immediately without scheduling a timer.
 */
function sleepUnlessAborted(
  ms: number,
  signal: AbortSignal | null | undefined,
  path: string,
): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer !== null) clearTimeout(timer);
      reject(cancelledApiError(path));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Thin client facade over {@link apiFetch}.
 *
 * It deliberately holds no auth state: the SEP-10 token lives in
 * `useWalletStore` and `apiFetch` reads it on every request, so there is a
 * single source of truth and nothing to keep in sync after login/logout.
 */
export const apiClient = {
  async fetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    return apiFetch<T>(path, options);
  },
};

/**
 * Performs exactly one attempt of an authenticated request: injects the Bearer
 * token and JSON `Content-Type`, arms the timeout, wires up cancellation and
 * normalizes the response.
 *
 * Kept separate from {@link apiFetch} so the retry loop can re-arm a fresh
 * timeout (and a fresh composed signal) for every attempt.
 */
async function performRequest<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number | undefined,
): Promise<T> {
  const callerSignal = init.signal ?? null;
  const limitMs = resolveTimeoutMs(timeoutMs);

  // A caller that has already cancelled must not reach the network at all.
  if (callerSignal?.aborted) throw cancelledApiError(path);

  const token = useWalletStore.getState().token;
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    !headers.has("Content-Type") &&
    (init.method === "POST" || init.method === "PUT")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // Which signal fired first decides whether this is a "timeout" or a
  // caller-initiated "aborted" — the two must never be confused.
  let abortSource: "caller" | "timeout" | null = null;
  const cleanups: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (callerSignal) {
    const onCallerAbort = () => {
      if (abortSource === null) abortSource = "caller";
    };
    // Registered before the composition below, so it always runs first and
    // records the true cause.
    callerSignal.addEventListener("abort", onCallerAbort);
    cleanups.push(() =>
      callerSignal.removeEventListener("abort", onCallerAbort),
    );
  }

  const signals: AbortSignal[] = callerSignal ? [callerSignal] : [];
  if (limitMs !== null) {
    const timeoutController = new AbortController();
    timer = setTimeout(() => {
      if (abortSource === null) abortSource = "timeout";
      timeoutController.abort(timeoutApiError(path, limitMs));
    }, limitMs);
    signals.push(timeoutController.signal);
  }

  const composed = signals.length > 0 ? composeAbortSignals(signals) : null;
  if (composed) cleanups.push(composed.cleanup);
  const requestSignal = composed?.signal;

  try {
    const requestInit: RequestInit = { ...init, headers };
    if (requestSignal) requestInit.signal = requestSignal;

    let res: Response;
    try {
      if (requestSignal) {
        // Racing the abort explicitly means a `fetch` that ignores its signal
        // (or a hung connection that never settles) still rejects on time.
        const abortRace = new Promise<never>((_, reject) => {
          const onAbort = () => {
            reject(
              abortSource === "timeout" && limitMs !== null
                ? timeoutApiError(path, limitMs)
                : cancelledApiError(path),
            );
          };
          requestSignal.addEventListener("abort", onAbort, { once: true });
          cleanups.push(() =>
            requestSignal.removeEventListener("abort", onAbort),
          );
        });
        // The race's loser must not surface as an unhandled rejection.
        void abortRace.catch(() => {});
        res = await Promise.race([
          fetch(`${getApiUrl()}${path}`, requestInit),
          abortRace,
        ]);
      } else {
        res = await fetch(`${getApiUrl()}${path}`, requestInit);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (isAbortError(err)) {
        throw abortSource === "timeout" && limitMs !== null
          ? timeoutApiError(path, limitMs)
          : cancelledApiError(path);
      }
      throw networkApiError(err, path);
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 503 || res.status === 504) {
        throw new ApiError({
          kind: "http",
          status: res.status,
          path,
          message:
            text || "Service Temporarily Unavailable. Please try again later.",
        });
      }
      let errorMessage = text;
      try {
        const json = JSON.parse(text);
        if (json && typeof json === "object") {
          if ("error" in json && typeof json.error === "string") {
            errorMessage = json.error;
          } else if ("message" in json && typeof json.message === "string") {
            errorMessage = json.message;
          }
        }
      } catch {
        // Not JSON
      }
      throw new ApiError({
        kind: "http",
        status: res.status,
        path,
        message: errorMessage || `HTTP error! status: ${res.status}`,
      });
    }

    // Awaited (not returned) on purpose: `finally` must not disarm the timeout
    // until the body has actually been read.
    const data: unknown = await res.json();
    return data as T;
  } finally {
    if (timer !== null) clearTimeout(timer);
    for (const cleanup of cleanups) cleanup();
  }
}

/**
 * Low-level helper that performs an authenticated `fetch` against the TrusTrove
 * API. It injects the current wallet token as a Bearer header, sets a JSON
 * `Content-Type` for POST/PUT requests, and normalizes error responses
 * (including friendly messages for 503/504 outages).
 *
 * Every request is bounded by {@link ApiRequestOptions.timeoutMs} (default
 * {@link DEFAULT_REQUEST_TIMEOUT_MS}) and honours an optional caller `signal`,
 * so hung requests reject instead of hanging forever and cancelled queries
 * cancel the underlying `fetch` (issue #638). Transient failures on *safe*
 * methods are retried with a deterministic exponential backoff (issue #639);
 * mutations never are — see {@link RETRYABLE_METHODS}.
 *
 * @param path - The API path (e.g. `/invoices/123`). Prepended with the base URL.
 * @param options - {@link ApiRequestOptions}: standard `fetch` `RequestInit`
 *   (method, body, headers, `signal`, …) plus `timeoutMs` and `retry`.
 * @returns A promise resolving to the parsed JSON body, typed as `T`.
 *
 * @throws {ApiError} When the request fails. `kind` says why:
 *   `"http"` (non-OK status; 503/504 keep the message
 *   "Service Temporarily Unavailable. Please try again later."), `"network"`,
 *   `"timeout"`, or `"aborted"` when the caller's own `signal` cancelled it.
 *
 * @example
 * ```ts
 * const stats = await apiFetch<ProtocolStats>("/stats");
 *
 * // Inside a react-query queryFn, so route changes cancel the request:
 * const invoices = await apiFetch<PaginatedInvoices>("/invoices", { signal });
 * ```
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { timeoutMs, retry, ...init } = options;
  const maxRetries = Math.max(0, retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const baseDelayMs = Math.max(
    0,
    retry?.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
  );
  const methodIsRetryable = isRetryableMethod(init.method);

  let attempt = 0;
  for (;;) {
    // Cancellation short-circuits the loop before every attempt.
    if (init.signal?.aborted) throw cancelledApiError(path);
    try {
      return await performRequest<T>(path, init, timeoutMs);
    } catch (err) {
      const isCancellation = err instanceof ApiError && err.kind === "aborted";
      if (
        isCancellation ||
        !methodIsRetryable ||
        attempt >= maxRetries ||
        !isTransientApiError(err)
      ) {
        throw err;
      }
      attempt += 1;
      await sleepUnlessAborted(
        baseDelayMs * 2 ** (attempt - 1),
        init.signal,
        path,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBigInt(val: unknown): bigint {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") return BigInt(val);
  if (typeof val === "string") return BigInt(val);
  return 0n;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") return Number(val);
  return 0;
}

/**
 * Normalizes a raw pool stats payload from the API into a typed `PoolStats`.
 * Missing or invalid fields fall back to safe defaults (`0n`/`0`).
 *
 * @param raw - The untyped response object returned by the API.
 * @returns A `PoolStats` with:
 *   - `totalDeposits` — `bigint` total USDC deposited into the pool (stroops).
 *   - `totalFunded` — `bigint` total USDC used to fund invoices (stroops).
 *   - `availableLiquidity` — `bigint` USDC available for new funding (stroops).
 *   - `utilizationRateBps` — `number` utilization as basis points (10000 = 100%).
 *   - `totalYieldDistributed` — `bigint` cumulative yield paid to LPs (stroops).
 *   - `activeInvoiceCount` — `number` count of invoices currently being funded.
 *   - `totalShares` — `bigint` total LP shares outstanding.
 */
export function parseRawPoolStats(raw: unknown): PoolStats {
  const r = isRecord(raw) ? raw : {};
  return {
    totalDeposits: toBigInt(r.total_deposits),
    totalFunded: toBigInt(r.total_funded),
    availableLiquidity: toBigInt(r.available_liquidity),
    utilizationRateBps: toNumber(r.utilization_rate_bps),
    totalYieldDistributed: toBigInt(r.total_yield_distributed),
    activeInvoiceCount: toNumber(r.active_invoice_count),
    totalShares: toBigInt(r.total_shares),
  };
}

/**
 * Normalizes a raw LP position payload from the API into a typed `LPPosition`.
 * Missing or invalid fields fall back to safe defaults (`0n`/`0`).
 *
 * @param raw - The untyped response object returned by the API.
 * @returns An `LPPosition` with:
 *   - `shares` — `bigint` LP shares held by the address (stroops).
 *   - `usdcValue` — `bigint` current USDC value of the position (stroops).
 *   - `yieldEarned` — `bigint` cumulative yield earned (stroops).
 *   - `depositCount` — `number` number of deposits made by the address.
 */
export function parseRawLPPosition(raw: unknown): LPPosition {
  const r = isRecord(raw) ? raw : {};
  return {
    shares: toBigInt(r.shares),
    usdcValue: toBigInt(r.usdc_value),
    yieldEarned: toBigInt(r.yield_earned),
    depositCount: toNumber(r.deposit_count),
  };
}

/**
 * Normalizes a raw event-log entry from the API into a typed `EventLog`.
 * Missing or invalid fields fall back to safe defaults.
 *
 * @param raw - The untyped response object returned by the API.
 * @returns An `EventLog` with:
 *   - `id` — `number` numeric identifier of the event.
 *   - `event_id` — `string` on-chain event identifier.
 *   - `contract_id` — `string` Stellar contract that emitted the event.
 *   - `ledger` — `number` ledger sequence at which the event was recorded.
 *   - `ledger_closed_at` — `number` Unix timestamp when the ledger closed.
 *   - `event_type` — `string` the kind of event (e.g. `deposit`, `repay`).
 *   - `data` — `Record<string, unknown>` arbitrary event payload.
 */
export function parseRawEventLog(raw: unknown): EventLog {
  const r = isRecord(raw) ? raw : {};
  return {
    id: toNumber(r.id),
    event_id: String(r.event_id ?? ""),
    contract_id: String(r.contract_id ?? ""),
    ledger: toNumber(r.ledger),
    ledger_closed_at: toNumber(r.ledger_closed_at),
    event_type: String(r.event_type ?? ""),
    data: (r.data as Record<string, unknown>) || {},
  };
}

/**
 * Requests a Stellar auth challenge (a presigned transaction) that the user
 * must sign with their wallet to prove ownership of `address`.
 *
 * @param address - The Stellar account address requesting authentication.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to:
 *   - `transaction` — `string` XDR of the challenge transaction to sign.
 *   - `network_passphrase` — `string` network passphrase used to sign it.
 *
 * @example
 * ```ts
 * const { transaction, network_passphrase } = await fetchChallenge(address);
 * const signed = await signTransaction(transaction, { networkPassphrase });
 * ```
 */
export async function fetchChallenge(
  address: string,
  options?: ApiRequestOptions,
): Promise<{ transaction: string; network_passphrase: string }> {
  return apiFetch<{ transaction: string; network_passphrase: string }>(
    `/auth?address=${address}`,
    options,
  );
}

/**
 * Submits a wallet-signed challenge transaction to obtain an auth token.
 *
 * @param transaction - The signed challenge transaction XDR from `fetchChallenge`.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to:
 *   - `token` — `string` JWT bearer token to use for authenticated requests.
 */
export async function verifyChallenge(
  transaction: string,
  options?: ApiRequestOptions,
): Promise<{ token: string }> {
  return apiFetch<{ token: string }>("/auth", {
    ...options,
    method: "POST",
    body: JSON.stringify({ transaction }),
  });
}

/**
 * Creates a new invoice on-chain via the API.
 *
 * @param buyer - The Stellar address of the invoice buyer.
 * @param faceValue - The invoice face value as a decimal string (in asset units).
 * @param dueDate - Unix timestamp (seconds) when the invoice is due.
 * @param asset - The denomination asset; defaults to `"USDC"`.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to:
 *   - `invoice_id` — `string` the new invoice's id.
 *   - `transaction_hash` — `string` hash of the on-chain creation transaction.
 *   - `status` — `string` initial invoice status (e.g. `"pending"`).
 *
 * @example
 * ```ts
 * const res = await createInvoice(buyer, "1000.00", dueDate);
 * ```
 */
export async function createInvoice(
  buyer: string,
  faceValue: string,
  dueDate: number,
  asset: AssetType = "USDC",
  options?: ApiRequestOptions,
): Promise<{ invoice_id: string; transaction_hash: string; status: string }> {
  return apiFetch<{
    invoice_id: string;
    transaction_hash: string;
    status: string;
  }>("/invoices", {
    ...options,
    method: "POST",
    body: JSON.stringify({
      buyer,
      face_value: faceValue,
      due_date: dueDate,
      asset,
    }),
  });
}

/**
 * Fetches a single invoice by its id and normalizes it into a typed `Invoice`.
 *
 * @param id - The invoice id to fetch.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to the `Invoice`, whose fields include:
 *   - `id` — `string` invoice id.
 *   - `issuer` / `buyer` — `string` Stellar addresses.
 *   - `faceValue` — `bigint` invoice face value (stroops).
 *   - `asset` — `AssetType` denomination asset.
 *   - `discountBps` — `number` discount in basis points.
 *   - `fundedAmount` — `bigint` amount funded so far (stroops).
 *   - `dueDate` — `number` Unix timestamp of the due date.
 *   - `status` — `InvoiceStatus` lifecycle status.
 *   - `createdAt` / `fundedAt` / `shippedAt` / `repaidAt` — `number | null` timestamps.
 *   - `issuerConfirmed` / `buyerConfirmed` — `boolean` confirmation flags.
 */
export async function getInvoiceByID(
  id: string,
  options?: ApiRequestOptions,
): Promise<Invoice> {
  const raw = await apiFetch<RawInvoice>(`/invoices/${id}`, options);
  return parseInvoiceResponse(raw);
}

/**
 * Updates an invoice's lifecycle status via `PATCH /invoices/:id/status`.
 * Used by the creation cleanup path to mark a newly created invoice as
 * `Cancelled` when its immediate on-chain listing cannot be completed, so the
 * invoice is not left "pending listing" forever (issue #1097).
 *
 * @param id - The invoice id to update.
 * @param status - The new lifecycle status (e.g. `"Cancelled"`).
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to `{ id, status }`.
 *
 * @throws {ApiError} When the indexer responds with a non-OK status.
 */
export async function updateInvoiceStatus(
  id: string,
  status: string,
  options?: ApiRequestOptions,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/invoices/${encodeURIComponent(id)}/status`,
    {
      ...options,
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export interface PaginatedInvoices {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Fetches a paginated/filtered list of invoices and normalizes each entry.
 *
 * @param filters - Optional query filters:
 *   - `status` — `string` filter by `InvoiceStatus`.
 *   - `issuer` — `string` filter by issuer Stellar address.
 *   - `page` — `number` 1-based page index.
 *   - `limit` — `number` page size.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to a `PaginatedInvoices`:
 *   - `data` — `Invoice[]` the normalized invoices for this page.
 *   - `total` — `number` total matching invoices across all pages.
 *   - `page` — `number` the current page index.
 *   - `limit` — `number` the page size.
 *   - `totalPages` — `number` total number of pages available.
 *
 * @example
 * ```ts
 * const { data, totalPages } = await getInvoices({ status: "funded", page: 1 });
 * ```
 */
export async function getInvoices(
  filters?: {
    status?: string;
    issuer?: string;
    page?: number;
    limit?: number;
  },
  options?: ApiRequestOptions,
): Promise<PaginatedInvoices> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.issuer) params.append("issuer", filters.issuer);
  if (filters?.page != null) params.append("page", String(filters.page));
  if (filters?.limit != null) params.append("limit", String(filters.limit));
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const raw = await apiFetch<{
    data: RawInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/invoices${query}`, options);

  return {
    data: raw.data.map(parseInvoiceResponse),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
    totalPages: raw.totalPages,
  };
}

/** Page size used by {@link getAllInvoices}. Matches the API's max `limit`. */
const ALL_INVOICES_PAGE_SIZE = 100;

/** Safety cap on how many pages {@link getAllInvoices} will fetch (10k rows). */
const ALL_INVOICES_MAX_PAGES = 100;

/**
 * Fetches the complete, unpaged invoice set for the given filters by walking
 * every server page. Use this for aggregate/summary calculations that must
 * cover the whole set — never for rendering a paginated table.
 *
 * The API caps `limit` at 100, so a single request cannot return everything;
 * this helper requests successive pages (deduplicating by id in case rows are
 * inserted mid-walk) until `totalPages` is exhausted. The walk stops early on
 * an empty page or after {@link ALL_INVOICES_MAX_PAGES} pages so a bad server
 * response cannot loop forever.
 *
 * @param filters - Optional query filters:
 *   - `status` — `string` filter by `InvoiceStatus`.
 *   - `issuer` — `string` filter by issuer Stellar address.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 *   Forwarded to every paged request, so one cancellation stops the walk.
 * @returns A promise resolving to every matching `Invoice`, across all pages.
 *
 * @example
 * ```ts
 * const all = await getAllInvoices({ issuer: address });
 * const totalFunded = all.reduce((sum, inv) => sum + inv.fundedAmount, 0n);
 * ```
 */
export async function getAllInvoices(
  filters?: {
    status?: string;
    issuer?: string;
  },
  options?: ApiRequestOptions,
): Promise<Invoice[]> {
  const byId = new Map<string, Invoice>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= ALL_INVOICES_MAX_PAGES) {
    const res = await getInvoices(
      {
        ...filters,
        page,
        limit: ALL_INVOICES_PAGE_SIZE,
      },
      options,
    );
    totalPages = res.totalPages || 1;
    for (const invoice of res.data) {
      byId.set(invoice.id, invoice);
    }
    if (res.data.length === 0) break;
    page += 1;
  }

  return Array.from(byId.values());
}

/**
 * Fetches aggregate pool statistics for the liquidity pool.
 *
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to a `PoolStats` (see `parseRawPoolStats` for
 *   the field descriptions: `totalDeposits`, `totalFunded`,
 *   `availableLiquidity`, `utilizationRateBps`, `totalYieldDistributed`,
 *   `activeInvoiceCount`, `totalShares`).
 */
export async function getPoolStats(
  options?: ApiRequestOptions,
): Promise<PoolStats> {
  const raw = await apiFetch<RawPoolStats>("/pool/stats", options);
  return parseRawPoolStats(raw);
}

/**
 * Fetches the liquidity-provider position for a given address.
 *
 * @param address - The Stellar address whose LP position to fetch.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to an `LPPosition` (see `parseRawLPPosition`
 *   for the field descriptions: `shares`, `usdcValue`, `yieldEarned`,
 *   `depositCount`).
 */
export async function getLPPosition(
  address: string,
  options?: ApiRequestOptions,
): Promise<LPPosition> {
  const raw = await apiFetch<RawLPPosition>(
    `/pool/position/${address}`,
    options,
  );
  return parseRawLPPosition(raw);
}

/**
 * Fetches recent on-chain events, most recent first.
 *
 * @param limit - Optional maximum number of events to return.
 * @param issuer - Optional Stellar account to scope the feed to. The indexer
 *   resolves it through each event's invoice, so only that account's own
 *   activity comes back (issue #1115). Omit it for the protocol-wide feed.
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to an `EventLog[]`; each entry is described by
 *   `parseRawEventLog` (`id`, `event_id`, `contract_id`, `ledger`,
 *   `ledger_closed_at`, `event_type`, `data`).
 */
export async function getRecentEvents(
  limit?: number,
  issuer?: string,
  options?: ApiRequestOptions,
): Promise<EventLog[]> {
  const params: string[] = [];
  if (limit) params.push(`limit=${limit}`);
  if (issuer) params.push(`issuer=${encodeURIComponent(issuer)}`);
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  const rawList = await apiFetch<RawEventLog[]>(`/events${query}`, options);
  return rawList.map(parseRawEventLog);
}

/**
 * Fetches historical pool snapshots used for charts and trend analysis.
 *
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to a `PoolSnapshot[]`, each with:
 *   - `timestamp` — `number` Unix timestamp of the snapshot.
 *   - `utilizationRateBps` — `number` utilization at that time (basis points).
 *   - `totalYieldDistributed` — `string` cumulative yield up to that time.
 */
export async function getPoolSnapshots(
  options?: ApiRequestOptions,
): Promise<PoolSnapshot[]> {
  return apiFetch<PoolSnapshot[]>("/pool/snapshots", options);
}

export interface ProtocolStats {
  total_usdc_financed: string;
  active_invoice_count: number;
  total_invoices: number;
  total_repaid: number;
  total_defaulted: number;
  average_yield_bps: number;
  pool_utilization_bps: number;
  registered_issuers: number;
}

/**
 * Fetches high-level protocol-wide statistics.
 *
 * @param options - Optional {@link ApiRequestOptions} (e.g. `{ signal }`
 *   from a react-query `queryFn`, or a `timeoutMs` override).
 * @returns A promise resolving to a `ProtocolStats` with:
 *   - `total_usdc_financed` — `string` total USDC financed (decimal string).
 *   - `active_invoice_count` — `number` invoices currently being funded.
 *   - `total_invoices` — `number` invoices created since genesis.
 *   - `total_repaid` — `number` invoices fully repaid.
 *   - `total_defaulted` — `number` invoices defaulted.
 *   - `average_yield_bps` — `number` average realized yield (basis points).
 *   - `pool_utilization_bps` — `number` current pool utilization (basis points).
 *   - `registered_issuers` — `number` count of registered issuers.
 */
export async function getProtocolStats(
  options?: ApiRequestOptions,
): Promise<ProtocolStats> {
  return apiFetch<ProtocolStats>("/stats", options);
}
