import {
  isConnected,
  requestAccess,
  getPublicKey,
} from "@stellar/freighter-api";

export type FreighterErrorCode = "user_rejected" | "not_installed" | "unknown";

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

export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    if (typeof res === "boolean") {
      return res;
    }
    return !!(res as any)?.isConnected;
  } catch (err) {
    console.error("Failed to check if Freighter is installed:", err);
    return false;
  }
}

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
    if ((res as any)?.address) {
      return (res as any).address;
    }
    if ((res as any)?.error) {
      throw mapFreighterError(new Error((res as any).error));
    }
    throw new FreighterError("unknown", "No address returned from Freighter");
  } catch (err) {
    console.error("Failed to connect to Freighter:", err);
    throw mapFreighterError(err);
  }
}

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
