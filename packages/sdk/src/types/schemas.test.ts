/**
 * Unit tests for parsePoolStats — feat/sdk-poolstats-totalshares
 *
 * Tests that:
 *  1. totalShares is parsed correctly from a plain JS object (camelCase key)
 *  2. totalShares is parsed correctly from a Map with snake_case key
 *     (mirrors the output of scValToNative on a Soroban ScVal map)
 *  3. totalShares defaults to 0n when the field is absent (backward compat)
 *  4. The PoolStats TypeScript interface includes totalShares: bigint
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  parsePoolStats,
  parseProfile,
  parseInvoice,
  parseLPPosition,
  parseAgent,
} from "./schemas.js";
import type {
  PoolStats,
  Profile,
  Invoice,
  LPPosition,
  Agent,
} from "./index.js";

const ISSUER = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const BUYER = "GB6JHURPFJNYYVV4KTZM5MZXP3QHSVQ3MJLYHPSZAMBTX73E6QQ7FCZL";
const INVOICE_ID = "ab".repeat(32);

// Helper: build a minimal valid PoolStats plain object with all required fields.
function baseStats(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    total_deposits: 1_000_000n,
    total_funded: 500_000n,
    available_liquidity: 500_000n,
    utilization_rate_bps: 5000,
    total_yield_distributed: 10_000n,
    active_invoice_count: 3,
    ...overrides,
  };
}

describe("parsePoolStats — totalShares", () => {
  it("parses total_shares from a plain object (snake_case keys from scValToNative)", () => {
    const raw = baseStats({ total_shares: 250_000n });
    const result: PoolStats = parsePoolStats(raw);

    expect(typeof result.totalShares, "totalShares should be a bigint").toBe(
      "bigint",
    );
    expect(result.totalShares, "totalShares should equal the input value").toBe(
      250_000n,
    );
  });

  it("parses total_shares from a Map (scValToNative returns Map for Soroban struct)", () => {
    const map = new Map<string, unknown>([
      ["total_deposits", 1_000_000n],
      ["total_funded", 500_000n],
      ["available_liquidity", 500_000n],
      ["utilization_rate_bps", 5000],
      ["total_yield_distributed", 10_000n],
      ["active_invoice_count", 3],
      ["total_shares", 999_888n], // ← the field under test
    ]);

    const result: PoolStats = parsePoolStats(map);
    expect(
      result.totalShares,
      "totalShares should be correctly read from a Map with snake_case key",
    ).toBe(999_888n);
  });

  it("coerces numeric total_shares to bigint", () => {
    // Contract may return number for small values depending on SDK version.
    const raw = baseStats({ total_shares: 42 });
    const result: PoolStats = parsePoolStats(raw);

    expect(
      result.totalShares,
      "numeric total_shares should be coerced to bigint",
    ).toBe(42n);
  });

  it("coerces string total_shares to bigint", () => {
    const raw = baseStats({ total_shares: "123456789012345678901234567890" });
    const result: PoolStats = parsePoolStats(raw);

    expect(
      result.totalShares,
      "string total_shares should be coerced to bigint",
    ).toBe(123456789012345678901234567890n);
  });

  it("defaults totalShares to 0n when field is absent (backward compatibility)", () => {
    // Old contract responses without total_shares should still parse safely.
    const raw = baseStats(); // no total_shares key
    const result: PoolStats = parsePoolStats(raw);

    expect(
      result.totalShares,
      "absent total_shares should default to 0n via bigintSchema preprocess",
    ).toBe(0n);
  });

  it("parses all existing PoolStats fields alongside totalShares (no regression)", () => {
    const raw = baseStats({ total_shares: 777n });
    const result: PoolStats = parsePoolStats(raw);

    expect(result.totalDeposits).toBe(1_000_000n);
    expect(result.totalFunded).toBe(500_000n);
    expect(result.availableLiquidity).toBe(500_000n);
    expect(result.utilizationRateBps).toBe(5000);
    expect(result.totalYieldDistributed).toBe(10_000n);
    expect(result.activeInvoiceCount).toBe(3);
    expect(result.totalShares).toBe(777n);
  });

  it("TypeScript interface check — totalShares: bigint is assignable", () => {
    // Compile-time + runtime check: if `PoolStats` is missing `totalShares`,
    // the literal below fails TypeScript; the runtime assertion is a
    // belt-and-suspenders confirmation that the field is a bigint.
    const stats: PoolStats = {
      totalDeposits: 1_000_000n,
      totalFunded: 500_000n,
      availableLiquidity: 500_000n,
      utilizationRateBps: 5000,
      totalYieldDistributed: 10_000n,
      activeInvoiceCount: 3,
      totalShares: 250_000n, // ← must compile without error
    };
    expect(typeof stats.totalShares, "totalShares should be a bigint").toBe(
      "bigint",
    );
  });
});

/** scValToNative hands a Soroban struct back as a Map with snake_case keys. */
function asMap(raw: Record<string, unknown>): Map<string, unknown> {
  return new Map(Object.entries(raw));
}

/**
 * Runs a parser that must reject its input and returns the Zod issue path, so a
 * test can prove the malformed *field* was the thing rejected — not some
 * unrelated failure, and not a silent default.
 */
function rejectedPath(parse: () => unknown): unknown[] {
  try {
    parse();
  } catch (error) {
    if (error instanceof ZodError && error.issues.length > 0) {
      return error.issues[0].path;
    }
    throw error;
  }
  throw new Error("expected the parser to throw, but it returned normally");
}

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    address: ISSUER,
    role: "issuer",
    verified: true,
    registered_at: 1_735_689_600,
    ...overrides,
  };
}

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    issuer: ISSUER,
    buyer: BUYER,
    face_value: 1_000_000_000n,
    asset: "USDC",
    discount_bps: 500,
    funded_amount: 900_000_000n,
    due_date: 1_767_225_600,
    status: "Funded",
    created_at: 1_735_689_600,
    funded_at: 1_736_000_000,
    shipped_at: null,
    issuer_confirmed: false,
    buyer_confirmed: false,
    repaid_at: null,
    ...overrides,
  };
}

function baseLPPosition(overrides: Record<string, unknown> = {}) {
  return {
    shares: 1_000_000n,
    usdc_value: 950_000n,
    yield_earned: 50_000n,
    deposit_count: 2,
    ...overrides,
  };
}

function baseAgent(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: "uw-01",
    pubkey: BUYER,
    active: true,
    registered_at: 1_735_689_600,
    ...overrides,
  };
}

describe("parseProfile", () => {
  it("parses a snake_case Map", () => {
    const profile: Profile = parseProfile(asMap(baseProfile()));

    expect(profile).toEqual({
      address: ISSUER,
      role: "issuer",
      verified: true,
      registeredAt: 1_735_689_600,
    });
  });

  it("parses a camelCase plain object", () => {
    const profile: Profile = parseProfile({
      address: BUYER,
      role: "buyer",
      verified: false,
      registeredAt: 1_700_000_000,
    });

    expect(profile.address).toBe(BUYER);
    expect(profile.role).toBe("buyer");
    expect(profile.verified).toBe(false);
    expect(profile.registeredAt).toBe(1_700_000_000);
  });

  it("coerces a numeric verified flag the way scValToNative delivers booleans", () => {
    const profile = parseProfile(asMap(baseProfile({ verified: 1 })));

    expect(profile.verified).toBe(true);
  });

  it.each([
    ["address", "GNOTAVALIDSTRKEY"],
    ["role", "seller"],
  ])("throws on a malformed %s rather than defaulting it", (field, value) => {
    expect(
      rejectedPath(() => parseProfile(asMap(baseProfile({ [field]: value })))),
    ).toEqual([field]);
  });

  it("throws when the address is absent", () => {
    const raw = baseProfile();
    delete (raw as Record<string, unknown>).address;

    expect(rejectedPath(() => parseProfile(asMap(raw)))).toEqual(["address"]);
  });
});

describe("parseInvoice", () => {
  it("parses every field from a snake_case Map", () => {
    const invoice: Invoice = parseInvoice(asMap(baseInvoice()));

    expect(invoice.id).toBe(INVOICE_ID);
    expect(invoice.issuer).toBe(ISSUER);
    expect(invoice.buyer).toBe(BUYER);
    expect(invoice.faceValue).toBe(1_000_000_000n);
    expect(invoice.asset).toBe("USDC");
    expect(invoice.discountBps).toBe(500);
    expect(invoice.fundedAmount).toBe(900_000_000n);
    expect(invoice.dueDate).toBe(1_767_225_600);
    expect(invoice.status).toBe("Funded");
    expect(invoice.createdAt).toBe(1_735_689_600);
    expect(invoice.fundedAt).toBe(1_736_000_000);
    expect(invoice.shippedAt).toBeNull();
    expect(invoice.issuerConfirmed).toBe(false);
    expect(invoice.buyerConfirmed).toBe(false);
    expect(invoice.repaidAt).toBeNull();
  });

  it("parses a camelCase plain object", () => {
    const invoice: Invoice = parseInvoice({
      id: "0".repeat(64),
      issuer: ISSUER,
      buyer: BUYER,
      faceValue: "250",
      asset: "XLM",
      discountBps: 250n,
      fundedAmount: 0,
      dueDate: "1767225600",
      status: "Created",
      createdAt: 1_735_689_600,
      fundedAt: 0,
      shippedAt: null,
      issuerConfirmed: 0,
      buyerConfirmed: null,
      repaidAt: null,
    });

    expect(invoice.faceValue).toBe(250n);
    expect(invoice.asset).toBe("XLM");
    expect(invoice.discountBps).toBe(250);
    expect(invoice.dueDate).toBe(1767225600);
    expect(invoice.status).toBe("Created");
    expect(
      invoice.fundedAt,
      "the contract stores 0 for an unset timestamp, which parses as null",
    ).toBeNull();
    expect(invoice.issuerConfirmed).toBe(false);
    expect(invoice.buyerConfirmed).toBe(false);
  });

  it("hex-encodes a Uint8Array id, as scValToNative returns BytesN", () => {
    const invoice = parseInvoice(
      asMap(baseInvoice({ id: new Uint8Array(32).fill(0xab) })),
    );

    expect(invoice.id).toBe(INVOICE_ID);
  });

  it("defaults asset to USDC when the contract omits it", () => {
    const raw = baseInvoice();
    delete (raw as Record<string, unknown>).asset;

    expect(parseInvoice(asMap(raw)).asset).toBe("USDC");
  });

  it.each([
    ["id", "not-a-32-byte-hash"],
    ["issuer", "GNOTAVALIDSTRKEY"],
    ["status", "Overdue"],
  ])("throws on a malformed %s rather than defaulting it", (field, value) => {
    expect(
      rejectedPath(() => parseInvoice(asMap(baseInvoice({ [field]: value })))),
    ).toEqual([field]);
  });

  it("throws when buyer is absent", () => {
    const raw = baseInvoice();
    delete (raw as Record<string, unknown>).buyer;

    expect(rejectedPath(() => parseInvoice(asMap(raw)))).toEqual(["buyer"]);
  });

  it("keeps the optional attestation fields absent rather than inventing them", () => {
    const invoice = parseInvoice(asMap(baseInvoice()));

    expect(invoice.attestationAgentId).toBeUndefined();
    expect(invoice.riskScoreBps).toBeUndefined();
    expect(invoice.evidenceHash).toBeUndefined();
    expect(invoice.attestedAt).toBeUndefined();
  });

  it("parses attestation fields when the indexer supplies them", () => {
    const invoice = parseInvoice(
      asMap(
        baseInvoice({
          attestation_agent_id: "uw-01",
          risk_score_bps: 320,
          evidence_hash: "ff".repeat(32),
          attested_at: 1_735_700_000,
        }),
      ),
    );

    expect(invoice.attestationAgentId).toBe("uw-01");
    expect(invoice.riskScoreBps).toBe(320);
    expect(invoice.evidenceHash).toBe("ff".repeat(32));
    expect(invoice.attestedAt).toBe(1_735_700_000);
  });
});

describe("parseLPPosition", () => {
  it("parses a snake_case Map", () => {
    const position: LPPosition = parseLPPosition(asMap(baseLPPosition()));

    expect(position).toEqual({
      shares: 1_000_000n,
      usdcValue: 950_000n,
      yieldEarned: 50_000n,
      depositCount: 2,
    });
  });

  it("parses a camelCase plain object", () => {
    const position: LPPosition = parseLPPosition({
      shares: 7n,
      usdcValue: 8n,
      yieldEarned: 9n,
      depositCount: 3,
    });

    expect(position).toEqual({
      shares: 7n,
      usdcValue: 8n,
      yieldEarned: 9n,
      depositCount: 3,
    });
  });

  it("coerces numeric and string amounts to bigint and number", () => {
    const position = parseLPPosition(
      asMap(
        baseLPPosition({
          shares: "12345678901234567890",
          usdc_value: 42,
          yield_earned: 0,
          deposit_count: 5n,
        }),
      ),
    );

    expect(position.shares).toBe(12345678901234567890n);
    expect(position.usdcValue).toBe(42n);
    expect(position.yieldEarned).toBe(0n);
    expect(position.depositCount).toBe(5);
  });

  it("returns a zero position for an empty payload, matching get_lp_position", () => {
    // The contract hands back a zero-value LPPosition for an LP with no shares,
    // and every field here is a numeric coercion that defaults to zero — unlike
    // the address/enum fields in the other schemas, none of these can throw.
    const position: LPPosition = parseLPPosition(asMap({}));

    expect(position).toEqual({
      shares: 0n,
      usdcValue: 0n,
      yieldEarned: 0n,
      depositCount: 0,
    });
  });
});

describe("parseAgent", () => {
  it("parses a snake_case Map", () => {
    const agent: Agent = parseAgent(asMap(baseAgent()));

    expect(agent).toEqual({
      agentId: "uw-01",
      pubkey: BUYER,
      active: true,
      registeredAt: 1_735_689_600,
    });
  });

  it("parses a camelCase plain object", () => {
    const agent: Agent = parseAgent({
      agentId: "uw-02",
      pubkey: ISSUER,
      active: false,
      registeredAt: 1_700_000_000,
    });

    expect(agent.agentId).toBe("uw-02");
    expect(agent.pubkey).toBe(ISSUER);
    expect(agent.active).toBe(false);
    expect(agent.registeredAt).toBe(1_700_000_000);
  });

  it("throws on an empty agent id rather than accepting a blank identifier", () => {
    expect(
      rejectedPath(() => parseAgent(asMap(baseAgent({ agent_id: "" })))),
    ).toEqual(["agentId"]);
  });

  it("throws on a malformed pubkey", () => {
    expect(
      rejectedPath(() =>
        parseAgent(asMap(baseAgent({ pubkey: "0xdeadbeef" }))),
      ),
    ).toEqual(["pubkey"]);
  });

  it("throws when the agent id is missing entirely", () => {
    const raw = baseAgent();
    delete (raw as Record<string, unknown>).agent_id;

    expect(rejectedPath(() => parseAgent(asMap(raw)))).toEqual(["agentId"]);
  });
});

describe("normalize/toCamelCase (through the exported parsers)", () => {
  it("camel-cases multi-word snake_case keys", () => {
    const stats = parsePoolStats(
      asMap({
        total_deposits: 1n,
        total_funded: 1n,
        available_liquidity: 1n,
        utilization_rate_bps: 10,
        total_yield_distributed: 1n,
        active_invoice_count: 1,
        total_shares: 1n,
      }),
    );

    expect(stats).toEqual({
      totalDeposits: 1n,
      totalFunded: 1n,
      availableLiquidity: 1n,
      utilizationRateBps: 10,
      totalYieldDistributed: 1n,
      activeInvoiceCount: 1,
      totalShares: 1n,
    });
  });

  it("ignores Map entries whose keys are not strings", () => {
    const map = asMap(baseLPPosition());
    map.set(Symbol("shares" as never), 999n);
    map.set(0 as unknown as string, 999n);

    expect(parseLPPosition(map).shares).toBe(1_000_000n);
  });

  it("treats a non-object payload as empty", () => {
    expect(parseLPPosition(null)).toEqual({
      shares: 0n,
      usdcValue: 0n,
      yieldEarned: 0n,
      depositCount: 0,
    });
    expect(() => parseProfile("nope")).toThrow(ZodError);
  });
});
