import { afterEach, describe, expect, it, vi } from "vitest";
import { explorerBaseUrl, explorerContractUrl, explorerTxUrl } from "./explorer";

describe("Stellar Expert links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { network: "testnet", segment: "testnet" },
    { network: "mainnet", segment: "public" },
    { network: undefined, segment: "testnet" },
  ])("uses $segment for network $network", ({ network, segment }) => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_NETWORK", network);
    const origin = `https://stellar.expert/explorer/${segment}`;
    expect(explorerBaseUrl()).toBe(origin);
    expect(explorerTxUrl("abc123")).toBe(`${origin}/tx/abc123`);
    expect(explorerContractUrl("C123")).toBe(`${origin}/contract/C123`);
  });
});
