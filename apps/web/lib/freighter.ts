import {
  isConnected,
  requestAccess,
  getPublicKey,
} from "@stellar/freighter-api";

/**
 * Machine-readable failure codes for Freighter interactions:
 * - `"user_rejected"` — the user denied the access request.
 * - `"not_installed"` — the Freighter extension is unavailable.
 * - `"unknown"` — any other unexpected failure.
 */
export type FreighterErrorCode = "user_rejected" | "not_installed" | "unknown";

interface FreighterConnectedResponse {
  isConnected?: boolean;
}

interface FreighterAccessResponse {
  address?: string;
  error?: string;
}

/**
 * Error thrown by the Freighter helpers, carrying a machine-readable
 * `code` in addition to the standard error `message`.
 */
export class FreighterError extends Error {
  readonly code: FreighterErrorCode;
  constructor(code: FreighterErrorCode, message: string) {
    super(message);
    this.name = "FreighterError";
    this.code = code;
  }
}

function classifyFreighterError(err: unknown): FreighterErrorCode {
  if (err instanceof FreighterError) return err.code;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("user rejected") ||
      msg.includes("user rejected this request")
    ) {
      return "user_rejected";
    }
    if (msg.includes("not installed") || msg.includes("internal error")) {
      return "not_installed";
    }
  }
  return "unknown";
}

function mapFreighterError(err: unknown): FreighterError {
  if (err instanceof FreighterError) return err;
  const code = classifyFreighterError(err);
  const message = err instanceof Error ? err.message : String(err);
  return new FreighterError(code, message);
}

/**
 * Checks whether the Freighter wallet extension is installed and
 * connected in the browser.
 *
 * Handles both the legacy boolean response and the newer
 * `{ isConnected }` response shape. Never throws — failures are logged
 * and reported as `false`.
 *
 * @returns `true` when Freighter reports a connection, `false` otherwise
 *   (including when the extension is absent or the check itself fails).
 *
 * @example
 * ```ts
 * const installed = await isFreighterInstalled();
 * if (!installed) {
 *   // Prompt the user to install Freighter.
 * }
 * ```
 */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    if (typeof res === "boolean") {
      return res;
    }
    if (res && typeof res === "object" && "isConnected" in res) {
      return !!(res as FreighterConnectedResponse).isConnected;
    }
    return false;
  } catch (err) {
    console.error("Failed to check if Freighter is installed:", err);
    return false;
  }
}

/**
 * Connects to the Freighter wallet and requests account access from the
 * user, showing the Freighter approval popup.
 *
 * @returns The connected Stellar public key (address) as a string.
 *
 * @throws `FreighterError` with code `"not_installed"` when Freighter is
 *   missing, `"user_rejected"` when the user denies the request, or
 *   `"unknown"` for any other failure.
 *
 * @example
 * ```ts
 * try {
 *   const address = await connectFreighter();
 *   useWalletStore.getState().connect(address, "testnet");
 * } catch (err) {
 *   if (err instanceof FreighterError && err.code === "user_rejected") {
 *     // The user cancelled the connection request.
 *   }
 * }
 * ```
 */
export async function connectFreighter(): Promise<string> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new FreighterError(
      "not_installed",
      "Freighter wallet is not installed",
    );
  }

  try {
    const res = await requestAccess();
    if (typeof res === "string") {
      return res;
    }
    if (res && typeof res === "object") {
      const accessRes = res as FreighterAccessResponse;
      if (accessRes.address) {
        return accessRes.address;
      }
      if (accessRes.error) {
        throw mapFreighterError(new Error(accessRes.error));
      }
    }
    throw new FreighterError("unknown", "No address returned from Freighter");
  } catch (err) {
    console.error("Failed to connect to Freighter:", err);
    throw mapFreighterError(err);
  }
}

/**
 * Retrieves the public key of the account currently selected in Freighter
 * without prompting for a new access approval.
 *
 * @returns The Stellar public key of the selected Freighter account.
 *
 * @throws `FreighterError` with code `"not_installed"` when Freighter is
 *   missing, or `"unknown"` when no public key can be returned.
 */
export async function getFreighterPublicKey(): Promise<string> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new FreighterError(
      "not_installed",
      "Freighter wallet is not installed",
    );
  }

  try {
    const res = await getPublicKey();
    if (typeof res === "string") {
      return res;
    }
    if (res && typeof res === "object" && "address" in res) {
      return (res as { address: string }).address;
    }
    throw new FreighterError(
      "unknown",
      "No public key returned from Freighter",
    );
  } catch (err) {
    console.error("Failed to get public key from Freighter:", err);
    throw mapFreighterError(err);
  }
}
