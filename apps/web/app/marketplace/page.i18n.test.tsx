import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { Invoice } from "@/types";

// The marketplace's copy comes from the "Marketplace" namespace in
// messages/en.json. These tests render it with the real en messages (the
// helper throws on a missing key) and check the English output is unchanged.

const state = vi.hoisted(() => ({
  wallet: {
    connected: false,
    address: null as string | null,
    role: "issuer" as "issuer" | "buyer" | "lp",
  },
  isVerified: false,
  invoices: [] as Invoice[],
  isLoading: false,
  isStatsLoading: false,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));
vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: () => null,
}));
vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) =>
    selector ? selector(state.wallet) : state.wallet,
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ isVerified: state.isVerified }),
}));
vi.mock("@/hooks/useInvoices", () => ({
  useInvoiceList: () => ({
    invoices: state.invoices,
    isLoading: state.isLoading,
    total: state.invoices.length,
    totalPages: 1,
  }),
}));
vi.mock("@/hooks/usePool", () => ({
  usePool: () => ({
    stats: { availableLiquidity: 0n },
    isStatsLoading: state.isStatsLoading,
  }),
}));

import Marketplace from "@/app/marketplace/page";

const RAW_KEY = /\bMarketplace\.[a-zA-Z]/;

function listedInvoice(id: string): Invoice {
  return {
    id,
    issuer: "GISSUER",
    buyer: "GBUYER",
    faceValue: 10_000_0000000n,
    asset: "USDC",
    discountBps: 250,
    fundedAmount: 0n,
    dueDate: 1_900_000_000,
    status: "Listed",
    createdAt: 1_800_000_000,
    fundedAt: null,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  };
}

afterEach(() => {
  state.wallet = { connected: false, address: null, role: "issuer" };
  state.isVerified = false;
  state.invoices = [];
  state.isLoading = false;
  state.isStatsLoading = false;
});

describe("Marketplace translations", () => {
  it("renders the header, filters and empty states", () => {
    state.isStatsLoading = true;
    const { container } = renderWithProviders(<Marketplace />);

    expect(
      screen.getByRole("heading", { name: "Invoice Marketplace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Audit list of tokenized trade obligations listed on the Stellar Soroban network.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pool Liquidity Available")).toBeInTheDocument();
    expect(screen.getByText("Syncing...")).toBeInTheDocument();

    expect(screen.getByText("Maturity Status")).toBeInTheDocument();
    const options = Array.from(
      screen.getByRole("combobox").querySelectorAll("option"),
    ).map((option) => [option.value, option.textContent]);
    expect(options).toEqual([
      ["ALL", "All Invoices"],
      ["Created", "Created"],
      ["Listed", "Listed (Awaiting Liquidity)"],
      ["Funded", "Funded (USDC Deployed)"],
      ["Active", "Active (Shipped)"],
      ["Confirmed", "Confirmed (Delivered)"],
      ["Repaid", "Repaid (Settled)"],
      ["Defaulted", "Defaulted"],
    ]);
    expect(screen.getByLabelText("Min Value")).toHaveAttribute(
      "placeholder",
      "e.g. 5000",
    );
    expect(screen.getByLabelText("Max Value")).toHaveAttribute(
      "placeholder",
      "e.g. 50000",
    );
    expect(screen.getByText("Max Discount Rate")).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Maximum discount rate" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Available Invoices (0)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No invoices match your filters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try broadening the amount range or resetting the filters to reveal more listed invoices.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset Filters" }),
    ).toBeInTheDocument();

    expect(screen.getByText("NO INVOICE SELECTED")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select an obligation from the ledger table to view its parameters and execute smart contract actions.",
      ),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("keeps the verification banner sentence whole around its profile link", () => {
    state.wallet = { connected: true, address: "GABC", role: "lp" };
    const { container } = renderWithProviders(<Marketplace />);

    expect(
      screen.getByText("Profile Verification Required"),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "[Profile Page]" });
    expect(link).toHaveAttribute("href", "/profile");
    expect(link.parentElement).toHaveTextContent(
      "Your connected wallet address is not verified on-chain. To fund invoices or execute smart contract operations, you must register your business credentials. Go to the [Profile Page] to register.",
    );

    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("renders the LP funding preview for a selected listed invoice", () => {
    state.wallet = { connected: true, address: "GABC", role: "lp" };
    state.isVerified = true;
    state.isLoading = true;
    state.invoices = [listedInvoice("b".repeat(64))];
    const { container } = renderWithProviders(<Marketplace />);

    expect(
      screen.getByRole("heading", { name: "Available Invoices (1)" }),
    ).toBeInTheDocument();

    fireEvent.click(container.querySelector("tbody tr")!);

    const role = screen.getByText("lp");
    expect(role.tagName).toBe("STRONG");
    expect(role.parentElement).toHaveTextContent("Consoling role: lp");
    expect(
      screen.getByRole("button", { name: "Clear select" }),
    ).toBeInTheDocument();
    expect(screen.getByText("POOL FINANCING PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("Face Value:")).toBeInTheDocument();
    expect(screen.getByText("Funded Cost (at 250 bps):")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Funding this invoice deploys USDC from the pool contract into escrow. LPs earn the discount difference upon repayment.",
      ),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("labels a disconnected viewer as public view", () => {
    state.invoices = [listedInvoice("c".repeat(64))];
    const { container } = renderWithProviders(<Marketplace />);

    fireEvent.click(container.querySelector("tbody tr")!);

    const role = screen.getByText("PUBLIC VIEW");
    expect(role.tagName).toBe("STRONG");
    expect(role.parentElement).toHaveTextContent("Consoling role: PUBLIC VIEW");
    expect(container.textContent).not.toMatch(RAW_KEY);
  });
});
