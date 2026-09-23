import type {
  AssetType,
  EventLog,
  Invoice,
  InvoiceStatus,
  Profile,
  TxHistoryItem,
} from "@/types";
import type { SimulationResult } from "@trusttrove/sdk";

/**
 * Deterministic sample data for stories.
 *
 * Everything here is plain data with no network access, so a story renders the
 * exact same tree on every run and without a live API, Soroban RPC node, or
 * Freighter extension.
 */

/** A Stellar-looking issuer/connected account used across stories. */
export const STORY_ADDRESS =
  "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

/** A second Stellar-looking account, used as the invoice buyer. */
export const STORY_BUYER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const DAY_SECONDS = 24 * 60 * 60;
const USDC_STROOPS = 10_000_000;

/** Every lifecycle state an invoice can be in, in contract order. */
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "Created",
  "Listed",
  "Funded",
  "Active",
  "Confirmed",
  "Repaid",
  "Defaulted",
];

export function mockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: "9f2c1a4b7e8d3f6051a2b3c4d5e6f70819a2b3c4d5e6f70819a2b3c4d5e6f708",
    issuer: STORY_ADDRESS,
    buyer: STORY_BUYER,
    faceValue: 50_000n * BigInt(USDC_STROOPS), // 50,000.00 USDC
    asset: "USDC" as AssetType,
    discountBps: 200, // 2.00%
    fundedAmount: 49_000n * BigInt(USDC_STROOPS),
    dueDate: now + 60 * DAY_SECONDS,
    status: "Created",
    createdAt: now - 5 * DAY_SECONDS,
    fundedAt: null,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    buyerConfirmedAt: null,
    repaidAt: null,
    defaultedAt: null,
    attestationAgentId: null,
    riskScoreBps: null,
    evidenceHash: null,
    attestedAt: null,
    ...overrides,
  };
}

/**
 * An invoice shaped for each lifecycle state.
 *
 * The milestone timestamps/flags are filled in so `InvoiceStatusTimeline`
 * renders a realistic amount of progress for every status.
 */
export function mockInvoiceForStatus(status: InvoiceStatus): Invoice {
  const now = Math.floor(Date.now() / 1000);
  const created = now - 10 * DAY_SECONDS;

  const base = mockInvoice({ status, createdAt: created });

  switch (status) {
    case "Created":
      return base;
    case "Listed":
      return { ...base, fundedAt: null };
    case "Funded":
      return { ...base, fundedAt: now - 8 * DAY_SECONDS };
    case "Active":
      return {
        ...base,
        fundedAt: now - 8 * DAY_SECONDS,
        shippedAt: now - 4 * DAY_SECONDS,
        issuerConfirmed: true,
      };
    case "Confirmed":
      return {
        ...base,
        fundedAt: now - 8 * DAY_SECONDS,
        shippedAt: now - 4 * DAY_SECONDS,
        issuerConfirmed: true,
        buyerConfirmed: true,
        buyerConfirmedAt: now - 2 * DAY_SECONDS,
      };
    case "Repaid":
      return {
        ...base,
        fundedAt: now - 8 * DAY_SECONDS,
        shippedAt: now - 4 * DAY_SECONDS,
        issuerConfirmed: true,
        buyerConfirmed: true,
        buyerConfirmedAt: now - 2 * DAY_SECONDS,
        repaidAt: now - DAY_SECONDS,
        fundedAmount: base.faceValue,
      };
    case "Defaulted":
      return {
        ...base,
        fundedAt: now - 8 * DAY_SECONDS,
        shippedAt: now - 4 * DAY_SECONDS,
        issuerConfirmed: true,
        dueDate: now - 2 * DAY_SECONDS,
        defaultedAt: now - DAY_SECONDS,
      };
    default:
      return base;
  }
}

export function mockInvoices(count: number): Invoice[] {
  return Array.from({ length: count }, (_, index) =>
    mockInvoice({
      id: `${(index + 1).toString(16).padStart(64, "0")}`,
      status: INVOICE_STATUSES[index % INVOICE_STATUSES.length],
      faceValue: BigInt((index + 1) * 5_000) * BigInt(USDC_STROOPS),
      fundedAmount: BigInt((index + 1) * 4_900) * BigInt(USDC_STROOPS),
      discountBps: 100 + index * 25,
      riskScoreBps: index % 2 === 0 ? 150 + index * 10 : null,
    }),
  );
}

export function mockInvoiceList(count = 3) {
  const data = mockInvoices(count);
  return {
    data,
    total: count,
    totalPages: 1,
    page: 1,
    limit: 20,
  };
}

const EVENT_TYPES = [
  { event_type: "InvoiceCreated", key: "invoice_id" },
  { event_type: "InvoiceListed", key: "invoice_id" },
  { event_type: "InvoiceFunded", key: "funded_amount" },
  { event_type: "InvoiceShipped", key: "invoice_id" },
  { event_type: "DeliveryConfirmed", key: "invoice_id" },
  { event_type: "InvoiceRepaid", key: "repaid_amount" },
];

export function mockEventLog(overrides: Partial<EventLog> = {}): EventLog {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: 1,
    event_id: "0000000001-0000",
    contract_id: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    ledger: 1_234_567,
    ledger_closed_at: now - 45,
    event_type: "InvoiceFunded",
    data: {
      invoice_id: "9f2c1a4b7e8d",
      funded_amount: "49000000000",
      discount_bps: 200,
    },
    ...overrides,
  };
}

export function mockRecentEvents(count = 5): EventLog[] {
  const now = Math.floor(Date.now() / 1000);

  return Array.from({ length: count }, (_, index) => {
    const type = EVENT_TYPES[index % EVENT_TYPES.length];
    const hasAmount = type.key.includes("amount");

    return mockEventLog({
      id: index + 1,
      event_id: `${index + 1}`,
      ledger: 1_234_567 + index,
      ledger_closed_at: now - (index + 1) * 90,
      event_type: type.event_type,
      data: {
        invoice_id: `${(index + 1).toString(16).padStart(12, "0")}`,
        ...(hasAmount ? { [type.key]: "49000000000" } : {}),
        discount_bps: 150 + index * 25,
        issuer: STORY_ADDRESS,
        buyer: STORY_BUYER,
      },
    });
  });
}

export function mockTxHistoryItem(
  overrides: Partial<TxHistoryItem> = {},
): TxHistoryItem {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0",
    type: "Fund Invoice",
    amount: "5000",
    token: "USDC",
    timestamp: now - 3_600,
    hash: "d3adb33f0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4",
    status: "success",
    ...overrides,
  };
}

export function mockTxHistory(count = 3): TxHistoryItem[] {
  const now = Math.floor(Date.now() / 1000);
  const types = [
    "Fund Invoice",
    "Repay Invoice",
    "Create Invoice",
    "Confirm Delivery",
  ];

  return Array.from({ length: count }, (_, index) =>
    mockTxHistoryItem({
      id: `tx-${index}`,
      type: types[index % types.length],
      amount: `${5_000 + index * 250}`,
      timestamp: now - (index + 1) * 7_200,
      status: index % 4 === 3 ? "failed" : "success",
      hash: `${(index + 1).toString(16).repeat(64).slice(0, 64)}`,
    }),
  );
}

export const mockProfile: Profile = {
  address: STORY_ADDRESS,
  role: "issuer",
  verified: true,
  registeredAt: Math.floor(Date.now() / 1000) - 30 * DAY_SECONDS,
};

export const mockSimulation: SimulationResult = {
  estimatedFeeXlm: "0.0012345",
  functionName: "list_for_financing",
  expectedResult: null,
  footprintSize: 3,
};
