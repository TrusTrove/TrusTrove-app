import {
  isConnected,
  requestAccess,
  getPublicKey,
} from "@stellar/freighter-api";

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
    throw new Error("Freighter wallet is not installed");
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
      throw new Error((res as any).error);
    }
    throw new Error("No address returned from Freighter");
  } catch (err) {
    console.error("Failed to connect to Freighter:", err);
    throw err;
  }
}

export async function getFreighterPublicKey(): Promise<string> {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error("Freighter wallet is not installed");
  }

  try {
    const res = await getPublicKey();
    if (typeof res === "string") {
      return res;
    }
    if (res && typeof res === "object" && "address" in res) {
      return (res as { address: string }).address;
    }
    throw new Error("No public key returned from Freighter");
  } catch (err) {
    console.error("Failed to get public key from Freighter:", err);
    throw err;
  }
}
