/**
 * Documented exit codes and structured error reporting.
 *
 * Automation needs to tell a bad flag apart from an RPC outage and a rejected
 * token. Every command reports through {@link reportError}, which maps errors
 * onto these codes and, with `--json`, emits a single-line object on stderr.
 */
export const EXIT_SUCCESS = 0;
/** Bad flags, missing configuration, or invalid input. */
export const EXIT_USAGE = 1;
/** Soroban RPC, Horizon, or indexer API failure. */
export const EXIT_RPC = 2;
/** Missing, invalid, or insufficiently privileged credentials. */
export const EXIT_AUTH = 3;
/** Any other unexpected failure. */
export const EXIT_INTERNAL = 4;

export type CliErrorCode = "USAGE_ERROR" | "RPC_ERROR" | "AUTH_ERROR" | "INTERNAL_ERROR";

/** An error carrying the machine-readable code and process exit status. */
export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: number;

  constructor(code: CliErrorCode, message: string, exitCode: number) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function usageError(message: string): CliError {
  return new CliError("USAGE_ERROR", message, EXIT_USAGE);
}

export function rpcError(message: string): CliError {
  return new CliError("RPC_ERROR", message, EXIT_RPC);
}

export function authError(message: string): CliError {
  return new CliError("AUTH_ERROR", message, EXIT_AUTH);
}

export function internalError(message: string): CliError {
  return new CliError("INTERNAL_ERROR", message, EXIT_INTERNAL);
}

const URL_PATTERN = /https?:\/\/[^\s"'`<>]+/gi;
const AUTH_HINTS =
  /unauthori[sz]ed|forbidden|invalid or expired token|missing token|bearer|401|403/i;
const RPC_HINTS =
  /simulation failed|send failed|transaction|soroban|horizon|rpc|fetch|network|timeout|timed out|econn|enotfound|eai_again|socket|certificate/i;

/**
 * Removes the parts of a URL most likely to carry a provider API key: userinfo,
 * the query string, and the fragment. Path and host stay so failures remain
 * diagnosable.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const userinfo = url.username || url.password ? "***@" : "";
    const pathname = url.pathname === "/" ? "" : url.pathname;
    const query = url.search ? "?***" : "";
    const hash = url.hash ? "#***" : "";
    return `${url.protocol}//${userinfo}${url.host}${pathname}${query}${hash}`;
  } catch {
    return "<invalid-url>";
  }
}

/** Redacts every URL embedded in free-form text, such as an RPC error message. */
export function redactUrls(text: string): string {
  return text.replace(URL_PATTERN, (match) => {
    const trailing = match.match(/[),.;:]+$/)?.[0] ?? "";
    const core = trailing ? match.slice(0, -trailing.length) : match;
    return redactUrl(core) + trailing;
  });
}

/**
 * Normalizes any thrown value into a {@link CliError}. Explicit CLI errors keep
 * their code; SDK failures are classified by their message so RPC and
 * authorization failures do not look like bad flags.
 */
export function classifyError(error: unknown): CliError {
  if (error instanceof CliError) return error;

  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");

  if (AUTH_HINTS.test(message)) return authError(message);
  if (RPC_HINTS.test(message)) return rpcError(message);
  return internalError(message);
}

export interface ReportErrorOptions {
  /** Emit `{ "error": { ... } }` on stderr instead of a human line. */
  json?: boolean;
}

/**
 * Prints an error and sets `process.exitCode`. URLs are always redacted, in
 * both human and JSON output.
 *
 * @returns The exit code that was set, for callers that want to assert it.
 */
export function reportError(
  error: unknown,
  options: ReportErrorOptions = {},
): number {
  const cliError = classifyError(error);
  const message = redactUrls(cliError.message);

  if (options.json) {
    console.error(
      JSON.stringify({
        error: {
          code: cliError.code,
          message,
          exitCode: cliError.exitCode,
        },
      }),
    );
  } else {
    console.error(`Error: ${message}`);
  }

  process.exitCode = cliError.exitCode;
  return cliError.exitCode;
}
