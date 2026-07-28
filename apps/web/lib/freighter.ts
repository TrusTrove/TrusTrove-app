import {
  getNetworkDetails,
  getPublicKey,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

export type FreighterErrorCode = "user_rejected" | "not_installed" | "unknown";

interface FreighterConnectedResponse {
  isConnected?: boolean;
}

interface FreighterAccessResponse {
  address?: string;
  error?: string;
}

export class FreighterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FreighterError";
    this.code = code;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected Freighter error occurred";
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "unknown";
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

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

export async function connectFreighter(): Promise<string> {
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

export async function getFreighterNetwork(): Promise<{
  network: string;
  networkPassphrase: string;
}> {
  try {
    const details = await getNetworkDetails();
    return {
      network: details.network,
      networkPassphrase: details.networkPassphrase,
    };
  } catch (error: unknown) {
    throw new FreighterError(getErrorCode(error), getErrorMessage(error));
  }
}
