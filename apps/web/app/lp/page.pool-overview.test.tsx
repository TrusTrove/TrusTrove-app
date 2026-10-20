import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LPDashboard from "@/app/lp/page";
import { parseRawPoolStats } from "@/lib/api";

const { wallet } = vi.hoisted(() => ({
  wallet: { connected: true, address: "GAAAAAAAA" as string | null },
}));

// The stats the page renders. Mutable so each test can feed the panel a
// different payload without re-declaring the whole hook shape.
const { pool } = vi.hoisted(() => ({
  pool: { stats: undefined as unknown, position: undefined as unknown },
}));
const { actions, confirmation } = vi.hoisted(() => ({
  actions: { deposit: vi.fn(), withdraw: vi.fn() },
  confirmation: { request: vi.fn() },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

vi.mock("@/hooks/usePool", () => ({
  usePool: () => ({
    stats: pool.stats,
    isStatsLoading: false,
    position: pool.position,
    isPositionLoading: false,
    deposit: actions.deposit,
    withdraw: actions.withdraw,
    isDepositing: false,
    isWithdrawing: false,
  }),
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => null,
}));

vi.mock("@/components/shared/SimulationPreview", () => ({
  SimulationPreview: () => null,
}));

vi.mock("@/store/confirmDialog", () => ({
  useConfirmDialogStore: (selector: any) =>
    selector ? selector(confirmation) : confirmation,
}));

/**
 * The documented `GET /pool/stats` payload
 * (docs/developer-guide/indexer-api-reference.md). These seven fields are the
 * whole contract — there is no share price on it.
 */
const RAW_POOL_STATS = {
  total_deposits: "1000000000000",
  total_funded: "500000000000",
  available_liquidity: "500000000000",
  utilization_rate_bps: 5000,
  total_yield_distributed: "10000000000",
  active_invoice_count: 10,
  total_shares: "1000000000000",
};

function renderPoolPanel(stats: unknown) {
  pool.stats = stats;
  return render(<LPDashboard />);
}

/** The `Stat` tile renders its value in the element after its label. */
function statValue(label: string): string | null {
  const labelEl = screen.queryByText(label);
  if (!labelEl) return null;
  return labelEl.nextElementSibling?.textContent ?? null;
}

describe("LP pool overview panel", () => {
  beforeEach(() => {
    wallet.connected = true;
    wallet.address = "GAAAAAAAA";
    pool.stats = undefined;
    pool.position = undefined;
    actions.deposit.mockClear();
    actions.withdraw.mockClear();
    confirmation.request.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders every metric the /pool/stats contract provides", () => {
    renderPoolPanel(parseRawPoolStats(RAW_POOL_STATS));

    expect(statValue("Total Deposits")).toBe("100,000.00 USDC");
    expect(statValue("Available Liquidity")).toBe("50,000.00 USDC");
    expect(statValue("Yield Distributed")).toBe("1,000.00 USDC");
    expect(statValue("Active Invoices")).toBe("10");
    // utilization_rate_bps is basis points: 5000 -> 50.0%.
    expect(screen.getByText("50.0%")).toBeInTheDocument();
  });

  it("renders no Share Price tile from the real API payload", () => {
    renderPoolPanel(parseRawPoolStats(RAW_POOL_STATS));

    expect(screen.queryByText("Share Price")).not.toBeInTheDocument();
    expect(statValue("Share Price")).toBeNull();
  });

  it("renders no Share Price tile even when stats carry the unused field", () => {
    // The shape the deleted code keyed off: an in-memory `sharePrice` that no
    // producer ever set. Nothing may render it, so the API contract and the UI
    // cannot drift apart again.
    const statsWithField = {
      ...parseRawPoolStats(RAW_POOL_STATS),
      sharePrice: 1.2345,
    };
    renderPoolPanel(statsWithField);

    expect(screen.queryByText("Share Price")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/share price/i, { selector: "span" }),
    ).not.toBeInTheDocument();
    // The four real tiles still render, so the panel is not silently empty.
    const panel = screen
      .getByText("Pool Overview")
      .closest("section") as HTMLElement;
    expect(within(panel).getByText("Total Deposits")).toBeInTheDocument();
    expect(within(panel).getByText("Active Invoices")).toBeInTheDocument();
  });

  it("keeps share price out of the normalized stats shape", () => {
    // A server that ever adds the field must not leak it into `PoolStats`.
    const parsed = parseRawPoolStats({
      ...RAW_POOL_STATS,
      share_price: "12345000",
    });

    expect(parsed).not.toHaveProperty("sharePrice");
    expect(parsed).not.toHaveProperty("share_price");
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "activeInvoiceCount",
        "availableLiquidity",
        "totalDeposits",
        "totalFunded",
        "totalShares",
        "totalYieldDistributed",
        "utilizationRateBps",
      ].sort(),
    );
  });

  it("shows and focuses an inline error for a non-positive deposit", () => {
    renderPoolPanel(undefined);
    const input = screen.getByLabelText("Deposit amount");

    fireEvent.submit(input.closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "deposit-amount-error");
    expect(document.activeElement).toBe(input);
    expect(actions.deposit).not.toHaveBeenCalled();
  });

  it("shows and focuses an inline error for a non-positive withdrawal", () => {
    pool.position = { shares: 100_000_000n };
    renderPoolPanel(undefined);
    const input = screen.getByLabelText("Shares to redeem");

    fireEvent.submit(input.closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an amount greater than zero.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      "withdraw-available",
    );
    expect(input.getAttribute("aria-describedby")).toContain(
      "withdraw-shares-error",
    );
    expect(document.activeElement).toBe(input);
    expect(confirmation.request).not.toHaveBeenCalled();
  });

  it("rejects withdrawals above redeemable shares before confirmation", () => {
    pool.position = { shares: 100_000_000n };
    renderPoolPanel(undefined);
    const input = screen.getByLabelText("Shares to redeem");

    fireEvent.change(input, { target: { value: "10.1" } });
    fireEvent.submit(input.closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Amount exceeds your redeemable shares.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(input);
    expect(confirmation.request).not.toHaveBeenCalled();
  });
});
