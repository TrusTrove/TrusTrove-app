import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

// The SDK's contract clients are replaced with a stub so the test exercises
// the command's flag handling, client calls, and output only — no network or
// Soroban RPC access.
const { mockGetByStatus, mockGetByIssuer, mockInstances, MockInvoiceClient } =
  vi.hoisted(() => {
    const mockGetByStatus = vi.fn();
    const mockGetByIssuer = vi.fn();
    const mockInstances: string[] = [];

    class MockInvoiceClient {
      constructor(contractId: string) {
        mockInstances.push(contractId);
      }

      getByStatus(...args: unknown[]) {
        return mockGetByStatus(...args);
      }

      getByIssuer(...args: unknown[]) {
        return mockGetByIssuer(...args);
      }
    }

    return {
      mockGetByStatus,
      mockGetByIssuer,
      mockInstances,
      MockInvoiceClient,
    };
  });

vi.mock("@trusttrove/sdk", () => ({
  InvoiceClient: MockInvoiceClient,
  // Minimal stand-in for the SDK's stroop formatter, so the mocked module does
  // not pull in the rest of the SDK graph.
  toUsdc: (stroops: bigint) => (Number(stroops) / 10_000_000).toFixed(2),
}));

import {
  formatInvoiceTable,
  formatTable,
  parseInvoiceStatus,
  registerListInvoicesCommand,
} from "../src/commands/list-invoices.js";
import type { Invoice } from "@trusttrove/sdk";

const ISSUER = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const BUYER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
// Any Stellar public key works here: the simulation call is mocked, and the
// command only forwards the key it was given.
const PUBLIC_KEY = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const CONTRACT_ID = "CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B";
const INVOICE_ID =
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: INVOICE_ID,
  status: "Funded",
  issuer: ISSUER,
  buyer: BUYER,
  faceValue: 1_000_000_000n,
  asset: "USDC",
  discountBps: 500,
  fundedAmount: 900_000_000n,
  dueDate: 1_735_689_600, // 2025-01-01T00:00:00Z
  createdAt: 1_735_430_400,
  fundedAt: 1_735_500_000,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  ...overrides,
});

async function runCli(args: string[]) {
  const program = new Command();
  registerListInvoicesCommand(program);
  await program.parseAsync(["node", "trusttrove", "list-invoices", ...args]);
}

describe("list-invoices command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let originalExitCode: typeof process.exitCode;
  let originalPublicKey: string | undefined;
  let originalContractId: string | undefined;

  const stdout = () =>
    logSpy.mock.calls.map((call) => String(call[0])).join("\n");
  const stderr = () =>
    errorSpy.mock.calls.map((call) => String(call[0])).join("\n");

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByStatus.mockResolvedValue([]);
    mockGetByIssuer.mockResolvedValue([]);
    mockInstances.length = 0;

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    originalExitCode = process.exitCode;
    process.exitCode = undefined;

    originalPublicKey = process.env.TRUSTTROVE_PUBLIC_KEY;
    originalContractId = process.env.INVOICE_CONTRACT_ID;
    delete process.env.TRUSTTROVE_PUBLIC_KEY;
    delete process.env.INVOICE_CONTRACT_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = originalExitCode;

    if (originalPublicKey === undefined) {
      delete process.env.TRUSTTROVE_PUBLIC_KEY;
    } else {
      process.env.TRUSTTROVE_PUBLIC_KEY = originalPublicKey;
    }
    if (originalContractId === undefined) {
      delete process.env.INVOICE_CONTRACT_ID;
    } else {
      process.env.INVOICE_CONTRACT_ID = originalContractId;
    }
  });

  it("lists invoices by status and prints a formatted table", async () => {
    mockGetByStatus.mockResolvedValue([makeInvoice()]);

    await runCli([
      "--status",
      "funded",
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    // Status matching is case-insensitive and forwarded in canonical form.
    expect(mockGetByStatus).toHaveBeenCalledWith("Funded", PUBLIC_KEY);
    expect(mockGetByIssuer).not.toHaveBeenCalled();
    expect(mockInstances).toEqual([CONTRACT_ID]);

    // Columns are padded to their widest cell, so each header is asserted
    // individually rather than as one contiguous line.
    const output = stdout();
    expect(output).toContain("ID");
    expect(output).toContain("ISSUER");
    expect(output).toContain("BUYER");
    expect(output).toContain("FACE VALUE");
    expect(output).toContain("STATUS");
    expect(output).toContain("DUE DATE");
    expect(output).toContain(INVOICE_ID);
    expect(output).toContain(ISSUER);
    expect(output).toContain(BUYER);
    expect(output).toContain("100.00 USDC");
    expect(output).toContain("Funded");
    expect(output).toContain("2025-01-01");
    expect(process.exitCode).toBeUndefined();
  });

  it("lists invoices by issuer", async () => {
    mockGetByIssuer.mockResolvedValue([
      makeInvoice({ status: "Active", dueDate: 1_735_689_600 }),
    ]);

    await runCli([
      "--issuer",
      ISSUER,
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    expect(mockGetByIssuer).toHaveBeenCalledWith(ISSUER, PUBLIC_KEY);
    expect(mockGetByStatus).not.toHaveBeenCalled();
    expect(stdout()).toContain("Active");
  });

  it("falls back to the public key and contract ID environment variables", async () => {
    process.env.TRUSTTROVE_PUBLIC_KEY = PUBLIC_KEY;
    process.env.INVOICE_CONTRACT_ID = CONTRACT_ID;
    mockGetByStatus.mockResolvedValue([makeInvoice()]);

    await runCli(["--status", "Funded"]);

    expect(mockGetByStatus).toHaveBeenCalledWith("Funded", PUBLIC_KEY);
    expect(mockInstances).toEqual([CONTRACT_ID]);
  });

  it("prints an empty table and a note when nothing matches", async () => {
    mockGetByStatus.mockResolvedValue([]);

    await runCli([
      "--status",
      "Repaid",
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    const output = stdout();
    expect(output).toContain("No invoices found.");
    expect(output).toContain("DUE DATE");
    expect(process.exitCode).toBeUndefined();
  });

  it("rejects an unknown status without calling the contract", async () => {
    await runCli([
      "--status",
      "Nope",
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    expect(stderr()).toContain('Unknown status "Nope"');
    expect(stderr()).toContain("Created, Listed, Funded");
    expect(mockGetByStatus).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("requires exactly one filter", async () => {
    await runCli(["--public-key", PUBLIC_KEY, "--contract-id", CONTRACT_ID]);

    expect(stderr()).toContain("A filter is required");
    expect(process.exitCode).toBe(1);
  });

  it("rejects --status together with --issuer", async () => {
    await runCli([
      "--status",
      "Funded",
      "--issuer",
      ISSUER,
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    expect(stderr()).toContain("Choose one filter");
    expect(mockGetByStatus).not.toHaveBeenCalled();
    expect(mockGetByIssuer).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("requires a public key", async () => {
    await runCli(["--status", "Funded", "--contract-id", CONTRACT_ID]);

    expect(stderr()).toContain("TRUSTTROVE_PUBLIC_KEY");
    expect(process.exitCode).toBe(1);
  });

  it("requires a contract ID", async () => {
    await runCli(["--status", "Funded", "--public-key", PUBLIC_KEY]);

    expect(stderr()).toContain("INVOICE_CONTRACT_ID");
    expect(process.exitCode).toBe(1);
  });

  it("surfaces simulation failures on stderr", async () => {
    mockGetByStatus.mockRejectedValue(new Error("Simulation failed"));

    await runCli([
      "--status",
      "Funded",
      "--public-key",
      PUBLIC_KEY,
      "--contract-id",
      CONTRACT_ID,
    ]);

    expect(stderr()).toContain("Error: Simulation failed");
    expect(process.exitCode).toBe(1);
  });
});

describe("list-invoices helpers", () => {
  it("parses every canonical status, case-insensitively", () => {
    for (const status of [
      "Created",
      "Listed",
      "Funded",
      "Active",
      "Confirmed",
      "Repaid",
      "Defaulted",
    ] as const) {
      expect(parseInvoiceStatus(status.toLowerCase())).toBe(status);
      expect(parseInvoiceStatus(` ${status} `)).toBe(status);
    }
  });

  it("throws on an unknown status", () => {
    expect(() => parseInvoiceStatus("Paid")).toThrow(/Unknown status "Paid"/);
  });

  it("pads table columns to the widest cell and trims trailing space", () => {
    const table = formatTable(
      ["A", "B"],
      [
        ["1", "a-long-value"],
        ["22", "x"],
      ],
    );

    expect(table.split("\n")).toEqual([
      "A   B",
      "--  ------------",
      "1   a-long-value",
      "22  x",
    ]);
  });

  it("renders the header row when there are no invoices", () => {
    const table = formatInvoiceTable([]);

    expect(table.split("\n")[0]).toBe(
      "ID  ISSUER  BUYER  FACE VALUE  STATUS  DUE DATE",
    );
  });
});
