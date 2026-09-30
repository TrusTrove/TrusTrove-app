import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import type { EventLog, Invoice } from "@/types";

// The dashboard's copy comes from the "Dashboard" namespace in
// messages/en.json. These tests render it with the real en messages (the
// helper throws on a missing key) and check the English output is unchanged.

const NOW = 1_800_000_000;

const state = vi.hoisted(() => ({
  wallet: {
    connected: false,
    address: null as string | null,
    role: "issuer" as "issuer" | "buyer" | "lp",
  },
  isVerified: false,
  invoices: [] as Invoice[],
  events: [] as EventLog[],
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="invoice-form" />,
}));
vi.mock("@/components/shared/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/shared/WalletConnect", () => ({
  WalletConnect: () => <button>Connect</button>,
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
    isLoading: false,
    total: state.invoices.length,
    totalPages: 1,
  }),
}));
vi.mock("@/hooks/useEvents", () => ({
  useRecentEvents: () => ({ events: state.events, isLoading: false }),
}));

import SMEDashboard from "@/app/dashboard/page";

const RAW_KEY = /\bDashboard\.[a-zA-Z]/;

function event(
  id: number,
  event_type: string,
  secondsAgo: number,
  data: Record<string, string> = {},
): EventLog {
  return {
    id,
    event_id: `evt-${id}`,
    contract_id: "C",
    ledger: id,
    ledger_closed_at: NOW - secondsAgo,
    event_type,
    data,
  };
}

function invoice(id: string, status: Invoice["status"]): Invoice {
  return {
    id,
    issuer: "GISSUER",
    buyer: "GBUYER",
    faceValue: 10_000_0000000n,
    asset: "USDC",
    discountBps: 200,
    fundedAmount: 0n,
    dueDate: NOW + 86400,
    status,
    createdAt: NOW,
    fundedAt: null,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  };
}

function connect(isVerified: boolean) {
  state.wallet = {
    connected: true,
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    role: "issuer",
  };
  state.isVerified = isVerified;
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
});

afterEach(() => {
  vi.restoreAllMocks();
  state.wallet = { connected: false, address: null, role: "issuer" };
  state.isVerified = false;
  state.invoices = [];
  state.events = [];
});

describe("SME dashboard translations", () => {
  it("renders the connect-wallet prompt when disconnected", () => {
    const { container } = renderWithProviders(<SMEDashboard />);

    expect(
      screen.getByRole("heading", { name: "Connect Your Wallet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Connect your Freighter wallet to access the SME Financing Dashboard, issue invoices, and request immediate liquidity.",
      ),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("renders the header, onboarding checklist, stats and empty states", () => {
    connect(false);
    const { container } = renderWithProviders(<SMEDashboard />);

    expect(
      screen.getByRole("heading", { name: "SME Financing Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("OPERATOR: GABCDE...4567 | ROLE: ISSUER"),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle(
        "Please complete your profile registration to unlock invoice creation",
      ),
    ).toHaveTextContent("Create Invoice");

    expect(screen.getByText("Get Started")).toBeInTheDocument();
    expect(
      screen.getByText("Wallet connected successfully"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Complete Profile Registration" }),
    ).toHaveAttribute("href", "/profile");

    for (const label of [
      "Created",
      "Currently Listed",
      "Funded & Active",
      "Total Repaid",
      "Total Financed",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Invoice table empty state (copy passed down as props).
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create your first invoice to populate the dashboard and unlock the financing flow.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Your First Invoice" }),
    ).toBeInTheDocument();

    // Activity log and management console empty states.
    expect(screen.getByText("No events recorded yet.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select an obligation from the table to load actions in the operator console.",
      ),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("interpolates activity log labels, details and relative times", () => {
    connect(true);
    state.events = [
      event(1, "InvoiceCreated", 30, {
        invoice_id: "abcdef",
        buyer: "GBUYERXYZ",
      }),
      event(2, "create", 120, { invoice_id: "123456" }),
      event(3, "confirm_delivery", 7200, { invoice_id: "fedcba" }),
      event(4, "InvoiceDefaulted", 3 * 86400, { invoice_id: "999999" }),
      event(5, "SomeFutureEvent", 30),
    ];
    const { container } = renderWithProviders(<SMEDashboard />);

    expect(screen.getAllByText("Invoice Created")).toHaveLength(2);
    expect(
      screen.getByText("INV#abcd... created for buyer GBUY..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("INV#1234... created for buyer unknown"),
    ).toBeInTheDocument();
    expect(screen.getByText("Delivery Confirmed")).toBeInTheDocument();
    expect(
      screen.getByText("Buyer confirmed delivery for INV#fedc..."),
    ).toBeInTheDocument();
    expect(screen.getByText("INV#9999... defaulted")).toBeInTheDocument();
    // Unknown event types fall back to the raw type and a generic detail.
    expect(screen.getByText("SomeFutureEvent")).toBeInTheDocument();
    expect(screen.getByText("Event occurred")).toBeInTheDocument();

    expect(screen.getAllByText("just now")).toHaveLength(2);
    expect(screen.getByText("2 min ago")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("3d ago")).toBeInTheDocument();

    expect(container.textContent).not.toMatch(RAW_KEY);
  });

  it("renders the selected-invoice console and the create-invoice dialog", () => {
    connect(true);
    state.invoices = [invoice("a".repeat(64), "Listed")];
    const { container } = renderWithProviders(<SMEDashboard />);

    fireEvent.click(container.querySelector("tbody tr")!);
    expect(screen.getByText("Selected invoice details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear console" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View audit ledger" }),
    ).toHaveAttribute("href", `/invoice/${"a".repeat(64)}`);

    fireEvent.click(screen.getByRole("button", { name: "Create Invoice" }));
    expect(
      screen.getByRole("dialog", { name: "Create Invoice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("New Invoice")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "[Close Esc]" }),
    ).toBeInTheDocument();

    expect(document.body.textContent).not.toMatch(RAW_KEY);
  });
});
