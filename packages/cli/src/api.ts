import { redactUrl, usageError } from "./errors.js";

/** Env var that can stand in for `--api-url`. */
export const API_URL_ENV_VAR = "TRUSTTROVE_API_URL";
/** Indexer API base URL used when no flag or env var is set. */
export const DEFAULT_API_URL = "http://localhost:8080";

/**
 * Resolves and validates the indexer API base URL from a flag, then
 * `TRUSTTROVE_API_URL`, then {@link DEFAULT_API_URL}. Trailing slashes are
 * removed so callers can append paths directly.
 */
export function resolveApiUrl(explicit?: string): string {
  const raw = (
    explicit ??
    process.env[API_URL_ENV_VAR] ??
    DEFAULT_API_URL
  ).trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw usageError(
      `Invalid API URL "${raw}". Expected an http(s) URL, for example ${DEFAULT_API_URL}.`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw usageError(
      `Invalid API URL "${redactUrl(raw)}". Expected an http(s) URL, for example ${DEFAULT_API_URL}.`,
    );
  }
  return raw.replace(/\/+$/, "");
}
