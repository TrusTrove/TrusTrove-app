import {
  getNetworkDetails,
  getPublicKey,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

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
    return await isConnected();
  } catch {
    return false;
  }
}

export async function connectFreighter(): Promise<string> {
  try {
    const address = await requestAccess();
    return address || (await getPublicKey());
  } catch (error: unknown) {
    throw new FreighterError(getErrorCode(error), getErrorMessage(error));
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
