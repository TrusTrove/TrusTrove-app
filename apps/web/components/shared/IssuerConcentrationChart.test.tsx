import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IssuerConcentrationChart } from "./IssuerConcentrationChart";
import type { Invoice } from "../../hooks/usePoolChartData";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => <>{React.cloneElement(children, { width: 600, height: 320 })}</>,
  };
});

const sampleInvoices: Invoice[] = [
  {
    id: "1",
    status: "Funded",
    issuer: "ISSUER_AAA111111111111111111111111111111",
    buyer: "BUYER1",
    faceValue: 100n,
    asset: "USDC",
    discountBps: 100,
    fundedAmount: 60_000_000n,
    dueDate: 100,
    createdAt: 10,
    fundedAt: 20,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  },
  {
    id: "2",
    status: "Active",
    issuer: "ISSUER_BBB222222222222222222222222222222",
    buyer: "BUYER2",
    faceValue: 100n,
    asset: "USDC",
    discountBps: 100,
    fundedAmount: 40_000_000n,
    dueDate: 100,
    createdAt: 10,
    fundedAt: 20,
    shippedAt: null,
    issuerConfirmed: false,
    buyerConfirmed: false,
    repaidAt: null,
  },
];

describe("IssuerConcentrationChart", () => {
  it("renders the loading skeleton when isLoading is true", () => {
    render(<IssuerConcentrationChart isLoading />);
    expect(
      screen.getByTestId("issuer-concentration-skeleton"),
    ).toBeInTheDocument();
  });

  it("renders an empty state when no active funded invoices exist", () => {
    render(<IssuerConcentrationChart invoices={[]} />);
    expect(
      screen.getByText(/no active funded invoices found/i),
    ).toBeInTheDocument();
  });

  it("renders an error state gracefully on failure", () => {
    render(<IssuerConcentrationChart error={new Error("fail")} />);
    expect(
      screen.getByText(/issuer concentration is temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders top issuers and reconciles totals to displayed exposure", () => {
    render(<IssuerConcentrationChart invoices={sampleInvoices} />);

    expect(
      screen.getByRole("heading", { name: "Issuer Concentration" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$10 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/2 invoices/i)).toBeInTheDocument();

    const imgRegion = screen.getByRole("img");
    expect(imgRegion).toHaveAttribute(
      "aria-label",
      expect.stringContaining("10 USDC"),
    );
  });
});
