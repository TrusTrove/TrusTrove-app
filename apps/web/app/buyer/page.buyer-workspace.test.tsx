import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types";
import BuyerWorkspacePage from "@/app/buyer/page";

const { wallet } = vi.hoisted(() => {
  const wallet: { connected: boolean; address: string | null } = {
    connected: true,
    address: "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY",
  };
  return { wallet };
});

const { buyer } = vi.hoisted(() => ({
  buyer: {
    groups: [] as unknown[],
    invoices: [] as unknown[],
    actionableCount: 0,
    isLoading: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("@/store/wallet", () => ({
  useWalletStore: (selector: any) => (selector ? selector(wallet) : wallet),
}));

vi.mock("@/hooks/useBuyerInvoices", () => ({
  useBuyerInvoices: () => buyer,
}));

vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => <div>wallet connect</div>,
}));

// The card carries its own contract hooks; the workspace test only cares that
// the page mounts one per invoice with the buyer role.
vi.mock("@/components/invoice/InvoiceCard", () => ({
  InvoiceCard: ({
    invoice,
    role,
    onSelect,
  }: {
    invoice: Invoice;
    role?: string;
    onSelect?: () => void;
  }) => (
    <div data-testid="invoice-card" onClick={onSelect}>
      {invoice.id} ({role})
    </div>
  ),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function makeInvoice(id: string): Invoice {
  return {
    id,
    issuer: "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
    buyer: wallet.address!,
    faceValue: 1_000_000_000n,
    asset: "USDC",
    discountBps: 200,
    fundedAmount: 980_000_000n,
    dueDate: 1_900_000_000,
    status: "Confirmed",
    createdAt: 1_800_000_000,
    fundedAt: 1_800_100_000,
    shippedAt: 1_800_200_000,
    issuerConfirmed: true,
    buyerConfirmed: true,
    repaidAt: null,
  };
}

describe("Buyer workspace page", () => {
  beforeEach(() => {
    wallet.connected = true;
    wallet.address =
      "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY";
    buyer.groups = [];
    buyer.invoices = [];
    buyer.actionableCount = 0;
    buyer.isLoading = false;
    buyer.error = null;
    buyer.refetch.mockClear();
    push.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("asks a disconnected visitor to connect first", () => {
    wallet.connected = false;
    wallet.address = null;
    buyer.groups = [
      {
        key: "confirm-delivery",
        title: "Confirm delivery",
        description: "Goods have shipped.",
        invoices: [makeInvoice("inv-1")],
      },
    ];
    buyer.invoices = [makeInvoice("inv-1")];

    render(<BuyerWorkspacePage />);

    expect(screen.getByText("Connect Your Wallet")).toBeInTheDocument();
    expect(screen.getByText("wallet connect")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-card")).toBeNull();
    expect(screen.queryByText("Confirm delivery")).toBeNull();
  });

  it("renders groups and links invoices to the detail flow", () => {
    const invoice = makeInvoice("inv-confirm");
    buyer.groups = [
      {
        key: "confirm-delivery",
        title: "Confirm delivery",
        description: "Goods have shipped. Confirm receipt.",
        invoices: [invoice],
      },
    ];
    buyer.invoices = [invoice];
    buyer.actionableCount = 1;

    render(<BuyerWorkspacePage />);

    expect(screen.getByText("Buyer Workspace")).toBeInTheDocument();
    expect(screen.getByText("Confirm delivery")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-card")).toHaveTextContent(
      "inv-confirm (buyer)",
    );
    expect(
      screen.getByRole("link", { name: /open invoice details/i }),
    ).toHaveAttribute("href", "/invoice/inv-confirm");

    fireEvent.click(screen.getByTestId("invoice-card"));
    expect(push).toHaveBeenCalledWith("/invoice/inv-confirm");
  });

  it("renders an empty state when the buyer has no invoices", () => {
    render(<BuyerWorkspacePage />);

    expect(screen.getByText("No invoices assigned to you")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-card")).toBeNull();
  });

  it("surfaces a load failure with a retry action", () => {
    buyer.error = new Error("network down");

    render(<BuyerWorkspacePage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not load your invoices/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(buyer.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("invoice-card")).toBeNull();
  });
});
