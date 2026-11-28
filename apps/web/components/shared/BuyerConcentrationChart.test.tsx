import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { BuyerConcentrationChart } from "./BuyerConcentrationChart";
import type { Invoice } from "@/types";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => <>{React.cloneElement(children, { width: 600, height: 280 })}</>,
  };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const mockInvoices: Invoice[] = [
  {
    id: "inv-1",
    issuer: "issuer-addr",
    buyer: "GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY",
    asset: "USDC",
    status: "Funded",
    dueDate: 1798675200,
    createdAt: 1790763125,
    faceValue: 1000000000n,
    discountBps: 250,
    fundedAmount: 600000000n,
    fundedAt: 1790763200,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  },
  {
    id: "inv-2",
    issuer: "issuer-addr",
    buyer: "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
    asset: "USDC",
    status: "Funded",
    dueDate: 1798675200,
    createdAt: 1790763125,
    faceValue: 1000000000n,
    discountBps: 250,
    fundedAmount: 400000000n,
    fundedAt: 1790763200,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  },
];

describe("BuyerConcentrationChart", () => {
  it("renders loading skeleton when loading", () => {
    renderWithClient(<BuyerConcentrationChart isLoading />);
    expect(
      screen.getByTestId("buyer-concentration-skeleton"),
    ).toBeInTheDocument();
  });

  it("renders empty state when no invoices are funded", () => {
    renderWithClient(<BuyerConcentrationChart invoices={[]} />);
    expect(
      screen.getAllByText((content, node) => node?.textContent?.includes("No funded buyer exposure recorded yet") ?? false)[0],
    ).toBeInTheDocument();
  });

  it("renders error state gracefully", () => {
    renderWithClient(<BuyerConcentrationChart error={new Error("fail")} />);
    expect(
      screen.getByText(/buyer exposure data is temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders buyer concentration data with exact totals and percentages", () => {
    renderWithClient(<BuyerConcentrationChart invoices={mockInvoices} />);

    expect(
      screen.getByRole("heading", { name: "Buyer Concentration" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Total Funded: 100 USDC/i)).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Buyer Concentration chart"),
    );
  });

  it("shows unavailable/missing identity warning boundary when buyer identity data is missing", () => {
    const invoicesWithMissingBuyer: Invoice[] = [
      {
        id: "inv-3",
        issuer: "issuer-addr",
        buyer: "",
        asset: "USDC",
        status: "Funded",
        dueDate: 1798675200,
        createdAt: 1790763125,
        faceValue: 1000000000n,
        discountBps: 250,
        fundedAmount: 500000000n,
        fundedAt: 1790763200,
        shippedAt: null,
        issuerConfirmed: false,
        buyerConfirmed: false,
        repaidAt: null,
      },
    ];

    renderWithClient(
      <BuyerConcentrationChart invoices={invoicesWithMissingBuyer} />,
    );
    expect(
      screen.getByText(
        (content, node) => node?.textContent?.includes("Notice: Some funded exposure lacks complete buyer identity data") ?? false,
      ),
    ).toBeInTheDocument();
  });
});
