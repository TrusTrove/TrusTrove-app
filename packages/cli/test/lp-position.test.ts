import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetLPPosition, mockCreateClient } = vi.hoisted(() => ({
  mockGetLPPosition: vi.fn(),
  mockCreateClient: vi.fn(),
}));

// `toUsdc` stays the real SDK formatter so the command's amounts are pinned to
// the SDK rather than to a second copy of the formatting rules.
vi.mock("@trusttrove/sdk", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("@trusttrove/sdk")>();
  return {
    ...sdk,
    PoolClient: class {
      constructor(contractId: string) {
        mockCreateClient(contractId);
      }

      getLPPosition(...args: unknown[]) {
        return mockGetLPPosition(...args);
      }
    },
    configureSDK: () => {},
  };
});

import { lpPositionCommand } from "../src/commands/lp-position.js";
import { Command } from "commander";
import { registerLpPositionCommand } from "../src/commands/lp-position.js";

const LP = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const POOL_CONTRACT_ID =
  "CAKEWH7SJCXGV2MH2WZYIX3QDPTSSBQFXYVYBOWAGLNBBZMPLE2US6CS";

const makePosition = (overrides: Record<string, unknown> = {}) => ({
  shares: 1_000_000n,
  usdcValue: 26_000_000_000n,
  yieldEarned: 1_000_000_000n,
  depositCount: 3,
  ...overrides,
});

describe("lpPositionCommand", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;

  const stdout = () =>
    logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  const stderr = () =>
    errorSpy.mock.calls.map((call) => String(call[0])).join("\n");

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLPPosition.mockResolvedValue(makePosition());
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;
  });

  it("prints shares, estimated value, principal, and yield", async () => {
    await lpPositionCommand({
      address: LP,
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(mockCreateClient).toHaveBeenCalledWith(POOL_CONTRACT_ID);
    // With no --public-key, the LP address is used for the read simulation.
    expect(mockGetLPPosition).toHaveBeenCalledWith(LP, LP);

    const output = stdout();
    expect(output).toContain(`Pool contract: ${POOL_CONTRACT_ID}`);
    expect(output).toContain(`LP address: ${LP}`);
    expect(output).toContain("Shares: 1000000");
    expect(output).toContain("Estimated asset value: 2600.00 USDC");
    expect(output).toContain("Principal: 2500.00 USDC");
    expect(output).toContain("Yield earned: 100.00 USDC");
    expect(output).toContain("Deposits: 3");
    expect(process.exitCode).toBeUndefined();
  });

  it("rejects an invalid address before constructing a client", async () => {
    await lpPositionCommand({
      address: "not-a-stellar-address",
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(stderr()).toContain('Invalid LP address "not-a-stellar-address"');
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockGetLPPosition).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("renders a zero position for an address with no shares", async () => {
    mockGetLPPosition.mockResolvedValue(
      makePosition({
        shares: 0n,
        usdcValue: 0n,
        yieldEarned: 0n,
        depositCount: 0,
      }),
    );

    await lpPositionCommand({
      address: LP,
      poolContractId: POOL_CONTRACT_ID,
    });

    const output = stdout();
    expect(output).toContain("Shares: 0");
    expect(output).toContain("Estimated asset value: 0.00 USDC");
    expect(output).toContain("Principal: 0.00 USDC");
    expect(output).toContain("Yield earned: 0.00 USDC");
    expect(output).toContain("Deposits: 0");
    expect(process.exitCode).toBeUndefined();
  });

  it("surfaces simulation failures with the RPC exit code", async () => {
    mockGetLPPosition.mockRejectedValue(new Error("account not found"));

    await lpPositionCommand({
      address: LP,
      poolContractId: POOL_CONTRACT_ID,
    });

    expect(stderr()).toContain(
      "Error: Failed to fetch LP position: account not found",
    );
    expect(process.exitCode).toBe(2);
  });

  it("emits a structured usage error with --json", async () => {
    await lpPositionCommand({
      address: "GINVALID",
      poolContractId: POOL_CONTRACT_ID,
      json: true,
    });

    const payload = JSON.parse(stderr()) as {
      error: { code: string; exitCode: number };
    };
    expect(payload.error.code).toBe("USAGE_ERROR");
    expect(payload.error.exitCode).toBe(1);
  });
});

describe("lp position command wiring", () => {
  it("is reachable as `trusttrove lp position <address>`", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockGetLPPosition.mockResolvedValue(makePosition());

    const program = new Command();
    registerLpPositionCommand(program);
    await program.parseAsync([
      "node",
      "trusttrove",
      "lp",
      "position",
      LP,
      "--pool-contract-id",
      POOL_CONTRACT_ID,
    ]);

    expect(mockGetLPPosition).toHaveBeenCalledWith(LP, LP);
    expect(logSpy.mock.calls.flat().join("\n")).toContain("Principal:");
  });
});
