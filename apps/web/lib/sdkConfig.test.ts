import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Asset } from "@stellar/stellar-sdk";

const ISSUER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RPC_URL = "https://rpc.example.test";
const PASSPHRASE = "Test Network ; custom";

describe("SDK startup config (#1090)", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_USDC_ISSUER: ISSUER,
      NEXT_PUBLIC_SOROBAN_RPC_URL: RPC_URL,
      NEXT_PUBLIC_NETWORK_PASSPHRASE: PASSPHRASE,
      NEXT_PUBLIC_POOL_CONTRACT_ID: "CPOOL",
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("configures the SDK with the web app's issuer, RPC URL and contract ids", async () => {
    const sdk = await import("@trusttrove/sdk");
    await import("./sdkConfig");

    const config = sdk.getConfig();
    expect(config.usdc.issuer).toBe(ISSUER);
    expect(config.sorobanRpcUrl).toBe(RPC_URL);
    expect(config.networkPassphrase).toBe(PASSPHRASE);
    expect(config.contractIds.pool).toBe("CPOOL");
  });

  it("keeps SDK defaults for variables the web app does not set", async () => {
    delete process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
    const sdk = await import("@trusttrove/sdk");
    await import("./sdkConfig");

    expect(sdk.getConfig().sorobanRpcUrl).toBe(
      "https://soroban-testnet.stellar.org",
    );
  });

  it("uses the configured Soroban RPC URL for getSorobanServer()", async () => {
    const sdk = await import("@trusttrove/sdk");
    await import("./sdkConfig");

    const server = sdk.getSorobanServer() as unknown as {
      serverURL: { toString(): string };
    };
    expect(server.serverURL.toString()).toContain("rpc.example.test");
  });

  it("ensureAllowance targets the same USDC issuer as ASSET_INFO", async () => {
    const sdk = await import("@trusttrove/sdk");
    const { ASSET_INFO } = await import("./assets");
    const { useWalletStore } = await import("@/store/wallet");
    const { useTokenAllowance } = await import("@/hooks/useTokenAllowance");
    const { renderHook, act } = await import("@testing-library/react");

    useWalletStore.getState().connect("GTEST", "testnet");

    let contractId: string | undefined;
    vi.spyOn(sdk.TokenClient.prototype, "allowance").mockImplementation(
      async function (this: unknown) {
        contractId = (this as { contractId: string }).contractId;
        return 1_000n;
      },
    );

    const { result } = renderHook(() => useTokenAllowance());
    await act(async () => {
      await result.current.ensureAllowance("CSPENDER", 100n);
    });

    expect(ASSET_INFO.USDC.issuer).toBe(ISSUER);
    expect(contractId).toBe(
      new Asset("USDC", ASSET_INFO.USDC.issuer as string).contractId(
        PASSPHRASE,
      ),
    );
  });
});
