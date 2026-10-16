import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetStats = vi.hoisted(() => vi.fn());

vi.mock("@trusttrove/sdk", () => ({
  PoolClient: class {
    contractId: string;

    constructor(contractId: string) {
      this.contractId = contractId;
    }

    getStats(publicKey: string) {
      return mockGetStats(publicKey, this.contractId);
    }
  },
  getConfig: () => ({
    contractIds: { pool: "CBDEFAULTPOOL" },
  }),
}));

import { checkPoolBalanceCommand } from "../src/commands/check-pool-balance.js";

const PUBLIC_KEY = "GTESTPUBLICKEY";
const POOL_CONTRACT_ID = "CBTESTPOOL";

describe("checkPoolBalanceCommand", () => {
  beforeEach(() => {
    mockGetStats.mockReset();
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("prints pool balance stats from the SDK", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockGetStats.mockResolvedValue({
      totalDeposits: 1_500_000_000n,
      availableLiquidity: 900_000_000n,
      utilizationRateBps: 4500,
      totalYieldDistributed: 125_000_000n,
    });

    await checkPoolBalanceCommand({
      publicKey: PUBLIC_KEY,
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(mockGetStats).toHaveBeenCalledWith(PUBLIC_KEY, POOL_CONTRACT_ID);

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain(`Pool contract: ${POOL_CONTRACT_ID}`);
    expect(output).toContain("totalDeposits: 150 USDC");
    expect(output).toContain("availableLiquidity: 90 USDC");
    expect(output).toContain("utilizationRateBps: 4500 (45.00%)");
    expect(output).toContain("totalYieldDistributed: 12.5 USDC");
    expect(process.exitCode).toBe(0);
  });

  it("prints a clear error when the simulation fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetStats.mockRejectedValue(new Error("bad public key"));

    await checkPoolBalanceCommand({
      publicKey: PUBLIC_KEY,
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to fetch pool stats: bad public key",
    );
    expect(process.exitCode).toBe(1);
  });

  it("fails clearly when no public key is provided", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkPoolBalanceCommand({
      publicKey: "",
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Missing public key. Provide --public-key or set TRUSTTROVE_PUBLIC_KEY.",
    );
    expect(mockGetStats).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  describe("pool contract ID resolution", () => {
    const POOL_ENV_KEYS = [
      "TRUSTTROVE_POOL_CONTRACT_ID",
      "NEXT_PUBLIC_POOL_CONTRACT_ID",
      "POOL_CONTRACT_ID",
    ];
    const originalEnv = new Map(
      POOL_ENV_KEYS.map((key) => [key, process.env[key]] as const),
    );

    beforeEach(() => {
      for (const key of POOL_ENV_KEYS) delete process.env[key];
      mockGetStats.mockResolvedValue({
        totalDeposits: 0n,
        availableLiquidity: 0n,
        utilizationRateBps: 0,
        totalYieldDistributed: 0n,
      });
      vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      for (const [key, value] of originalEnv) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it("uses POOL_CONTRACT_ID, the name .env.example documents", async () => {
      process.env.POOL_CONTRACT_ID = "CBENVPOOL";

      await checkPoolBalanceCommand({ publicKey: PUBLIC_KEY });

      expect(mockGetStats).toHaveBeenCalledWith(PUBLIC_KEY, "CBENVPOOL");
      expect(process.exitCode).toBe(0);
    });

    it("keeps TRUSTTROVE_POOL_CONTRACT_ID ahead of POOL_CONTRACT_ID", async () => {
      process.env.TRUSTTROVE_POOL_CONTRACT_ID = "CBTRUSTTROVEPOOL";
      process.env.POOL_CONTRACT_ID = "CBENVPOOL";

      await checkPoolBalanceCommand({ publicKey: PUBLIC_KEY });

      expect(mockGetStats).toHaveBeenCalledWith(PUBLIC_KEY, "CBTRUSTTROVEPOOL");
    });

    it("falls back to the SDK default when no pool variable is set", async () => {
      await checkPoolBalanceCommand({ publicKey: PUBLIC_KEY });

      expect(mockGetStats).toHaveBeenCalledWith(PUBLIC_KEY, "CBDEFAULTPOOL");
    });
  });
});
