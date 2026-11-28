import { afterEach, describe, expect, it, vi } from "vitest";
import { Networks, rpc } from "@stellar/stellar-sdk";
import { checkPreflight } from "./base.js";

describe("checkPreflight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks RPC health and wallet capability without prompting the wallet", async () => {
    vi.spyOn(rpc.Server.prototype, "getHealth").mockResolvedValue({
      status: "healthy",
    } as Awaited<ReturnType<typeof rpc.Server.prototype.getHealth>>);
    const signTransaction = vi.fn().mockResolvedValue("signed-xdr");

    const result = await checkPreflight(
      "https://soroban-testnet.stellar.org",
      Networks.TESTNET,
      signTransaction,
    );

    expect(result).toEqual({
      connectionHealthy: true,
      networkSupported: true,
      signingSupported: true,
      errors: [],
    });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("reports unsupported networks, unhealthy RPC, and missing signing capability", async () => {
    vi.spyOn(rpc.Server.prototype, "getHealth").mockRejectedValue(
      new Error("RPC unavailable"),
    );

    const result = await checkPreflight(
      "https://rpc.example.test",
      "unsupported-network",
    );

    expect(result.connectionHealthy).toBe(false);
    expect(result.networkSupported).toBe(false);
    expect(result.signingSupported).toBe(false);
    expect(result.errors).toEqual([
      "Unsupported network passphrase",
      "Connection check failed: RPC unavailable",
      "Wallet does not provide a signTransaction function",
    ]);
  });
});
