import { Command } from "commander";
import {
  API_URL_ENV_VAR,
  DEFAULT_API_URL,
  resolveApiUrl,
} from "../api.js";
import {
  authError,
  redactUrl,
  redactUrls,
  reportError,
  rpcError,
  usageError,
} from "../errors.js";
import { formatTable } from "./list-invoices.js";

/** Env var that can stand in for `--token`. */
export const API_TOKEN_ENV_VAR = "TRUSTTROVE_API_TOKEN";
export { API_URL_ENV_VAR, DEFAULT_API_URL };
export const DEFAULT_DELIVERY_LIMIT = 20;
export const MAX_DELIVERY_LIMIT = 100;

// Matches the UUID form the indexer accepts. The version/variant nibbles are
// not enforced: Go's uuid.Parse accepts nil-style IDs such as
// 00000000-0000-0000-0000-000000000001.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABLE_HEADERS = [
  "ID",
  "EVENT",
  "STATUS",
  "ATTEMPTS",
  "LAST STATUS",
  "NEXT RETRY",
  "ERROR",
];

/** One delivery attempt as exposed by `GET /webhooks/{id}/deliveries`. */
export interface WebhookDeliveryAttempt {
  id: number;
  subscription_id: string;
  event_type: string;
  event_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_status: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveriesOptions {
  /** Subscription UUID whose deliveries should be listed. */
  subscriptionId?: string;
  /** JWT with the subscription owner's subject. */
  token?: string;
  /** Indexer API base URL. */
  apiUrl?: string;
  /** Maximum rows to request (1–100). */
  limit?: string | number;
  /** Emit the attempts as JSON; also makes errors JSON. */
  json?: boolean;
}

export interface WebhookDeliveriesResult {
  attempts: WebhookDeliveryAttempt[];
  /** Redacted API base URL, for diagnostics. */
  apiUrl: string;
  table: string;
}

export interface WebhookDeliveriesDependencies {
  /** Overridable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

function resolveSubscriptionId(options: WebhookDeliveriesOptions): string {
  const id = (options.subscriptionId ?? "").trim();
  if (!id) {
    throw usageError(
      "A subscription ID is required. Pass --subscription-id <uuid>.",
    );
  }
  if (!UUID_PATTERN.test(id)) {
    throw usageError(
      `Invalid subscription ID "${id}". Expected a UUID, for example 00000000-0000-0000-0000-000000000001.`,
    );
  }
  return id;
}

function resolveToken(options: WebhookDeliveriesOptions): string {
  const token = (options.token ?? process.env[API_TOKEN_ENV_VAR] ?? "").trim();
  if (!token) {
    throw usageError(
      `An API token is required. Pass --token <jwt> or set ${API_TOKEN_ENV_VAR}.`,
    );
  }
  return token;
}

function resolveLimit(options: WebhookDeliveriesOptions): number {
  const raw =
    options.limit === undefined || options.limit === ""
      ? DEFAULT_DELIVERY_LIMIT
      : Number(options.limit);
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_DELIVERY_LIMIT) {
    throw usageError(
      `Invalid --limit "${String(options.limit)}". Expected an integer between 1 and ${MAX_DELIVERY_LIMIT}.`,
    );
  }
  return raw;
}

/**
 * Renders attempts as a table. Destination URLs are never printed: the API
 * does not return them, and any URL embedded in a stored error message is
 * redacted so a provider key in a subscriber URL cannot leak through logs.
 */
export function formatWebhookDeliveriesTable(
  attempts: WebhookDeliveryAttempt[],
): string {
  const rows = attempts.map((attempt) => [
    String(attempt.id),
    attempt.event_type,
    attempt.status,
    `${attempt.attempts}/${attempt.max_attempts}`,
    attempt.last_status === null ? "—" : String(attempt.last_status),
    attempt.status === "pending" && attempt.next_attempt_at
      ? attempt.next_attempt_at
      : "—",
    attempt.last_error ? redactUrls(attempt.last_error) : "—",
  ]);
  return formatTable(TABLE_HEADERS, rows);
}

function parseAttempts(payload: unknown): WebhookDeliveryAttempt[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw rpcError(
      "Unexpected response from the indexer API: missing data array.",
    );
  }
  return (payload as { data: WebhookDeliveryAttempt[] }).data;
}

/**
 * Fetches one subscription's delivery attempts from the indexer API.
 *
 * Authentication is a JWT bearer token; the API scopes the query to the token
 * subject, so a valid token for another user behaves like a missing
 * subscription.
 */
export async function fetchWebhookDeliveries(
  options: WebhookDeliveriesOptions = {},
  dependencies: WebhookDeliveriesDependencies = {},
): Promise<WebhookDeliveriesResult> {
  const subscriptionId = resolveSubscriptionId(options);
  const token = resolveToken(options);
  const apiUrl = resolveApiUrl(options.apiUrl);
  const limit = resolveLimit(options);
  const doFetch = dependencies.fetch ?? fetch;
  const url = `${apiUrl}/webhooks/${encodeURIComponent(subscriptionId)}/deliveries?limit=${limit}`;

  let response: Response;
  try {
    response = await doFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw rpcError(
      `Failed to reach the indexer API at ${redactUrl(apiUrl)}: ${message}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw authError(
      `The indexer API rejected the token (HTTP ${response.status}). Check --token or ${API_TOKEN_ENV_VAR}.`,
    );
  }
  if (response.status === 404) {
    throw usageError(
      `Webhook subscription ${subscriptionId} was not found for this token.`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim() ? `: ${redactUrls(body.trim())}` : "";
    throw rpcError(`The indexer API returned HTTP ${response.status}${detail}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw rpcError("The indexer API returned invalid JSON.");
  }

  const attempts = parseAttempts(payload);
  return {
    attempts,
    apiUrl,
    table: formatWebhookDeliveriesTable(attempts),
  };
}

/**
 * Registers `trusttrove webhook-deliveries`. Output goes to stdout; auth,
 * input, and API failures are reported on stderr with a documented exit code.
 */
export function registerWebhookDeliveriesCommand(program: Command): Command {
  return program
    .command("webhook-deliveries")
    .description("List recent delivery attempts for one webhook subscription")
    .option(
      "--subscription-id <uuid>",
      "webhook subscription ID to inspect (required)",
    )
    .option(
      "--token <jwt>",
      `JWT for the subscription owner (or set ${API_TOKEN_ENV_VAR})`,
    )
    .option(
      "--api-url <url>",
      `indexer API base URL (or set ${API_URL_ENV_VAR}; default ${DEFAULT_API_URL})`,
    )
    .option(
      "--limit <n>",
      `maximum attempts to list, 1-${MAX_DELIVERY_LIMIT} (default ${DEFAULT_DELIVERY_LIMIT})`,
    )
    .option("--json", "print attempts as JSON and emit errors as JSON")
    .action(async (options: WebhookDeliveriesOptions) => {
      try {
        const { attempts, table } = await fetchWebhookDeliveries(options);
        if (options.json) {
          console.log(JSON.stringify({ data: attempts }, null, 2));
          return;
        }
        if (attempts.length === 0) {
          console.log("No deliveries found.");
          return;
        }
        console.log(table);
      } catch (error) {
        reportError(error, { json: options.json });
      }
    });
}
