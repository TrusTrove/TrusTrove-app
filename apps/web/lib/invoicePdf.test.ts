import { beforeEach, describe, expect, it, vi } from "vitest";

// jsPDF is replaced with a recording double: the tests assert on the text the
// exporter draws and the file it saves, without generating a real PDF.
const { mockText, mockSave, mockAddPage, mockInstances, pageSize, MockJsPDF } =
  vi.hoisted(() => {
    const mockText = vi.fn();
    const mockSave = vi.fn();
    const mockAddPage = vi.fn();
    const mockInstances: unknown[] = [];
    // Mutable so a test can shrink the page and force pagination.
    const pageSize = { width: 595.28, height: 841.89 };

    class MockJsPDF {
      internal = {
        pageSize: {
          getWidth: () => pageSize.width,
          getHeight: () => pageSize.height,
        },
      };

      constructor() {
        mockInstances.push(this);
      }

      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      splitTextToSize = (text: string) => [text];
      text = mockText;
      addPage = mockAddPage;
      save = mockSave;
    }

    return {
      mockText,
      mockSave,
      mockAddPage,
      mockInstances,
      pageSize,
      MockJsPDF,
    };
  });

vi.mock("jspdf", () => ({
  jsPDF: MockJsPDF as unknown as typeof import("jspdf").jsPDF,
}));

import {
  buildInvoicePdfContent,
  generateInvoicePdf,
  invoicePdfFileName,
} from "@/lib/invoicePdf";
import type { Invoice } from "@/types";

const ISSUER = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
const BUYER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const INVOICE_ID =
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: INVOICE_ID,
  status: "Funded",
  issuer: ISSUER,
  buyer: BUYER,
  faceValue: 1_000_000_000n, // 100.00 USDC
  asset: "USDC",
  discountBps: 500,
  fundedAmount: 900_000_000n, // 90.00 USDC
  dueDate: 1_735_689_600,
  createdAt: 1_735_430_400,
  fundedAt: 1_735_500_000,
  shippedAt: null,
  issuerConfirmed: false,
  buyerConfirmed: false,
  repaidAt: null,
  ...overrides,
});

/** Every string passed to `doc.text()`, in draw order. */
const drawnText = () => mockText.mock.calls.map((call) => String(call[0]));

const fieldValue = (invoice: Invoice, label: string) =>
  buildInvoicePdfContent(invoice).fields.find((field) => field.label === label)
    ?.value;

describe("invoicePdfFileName", () => {
  it("names the file after the invoice id prefix", () => {
    expect(invoicePdfFileName(makeInvoice())).toBe(
      "trusttrove-invoice-a1b2c3d4.pdf",
    );
  });
});

describe("buildInvoicePdfContent", () => {
  it("includes every required invoice field", () => {
    const content = buildInvoicePdfContent(makeInvoice());

    expect(content.title).toBe("TrusTrove Invoice");
    expect(content.fields.map((field) => field.label)).toEqual([
      "Invoice ID",
      "Status",
      "Face value",
      "Discount rate",
      "Funded amount",
      "Issuer",
      "Buyer",
      "Due date",
    ]);
  });

  it("formats amounts, the discount rate, and the due date", () => {
    const invoice = makeInvoice();

    expect(fieldValue(invoice, "Invoice ID")).toBe(INVOICE_ID);
    expect(fieldValue(invoice, "Status")).toBe("Funded");
    expect(fieldValue(invoice, "Face value")).toBe("100.00 USDC");
    expect(fieldValue(invoice, "Discount rate")).toBe("5.00%");
    expect(fieldValue(invoice, "Funded amount")).toBe("90.00 USDC");
    expect(fieldValue(invoice, "Issuer")).toBe(ISSUER);
    expect(fieldValue(invoice, "Buyer")).toBe(BUYER);
    // The formatter is locale/timezone dependent, so only assert that it
    // rendered a real date rather than an exact string.
    expect(fieldValue(invoice, "Due date")).toMatch(/\d{1,2}, \d{4}/);
  });

  it("renders a placeholder discount rate before the invoice is listed", () => {
    expect(fieldValue(makeInvoice({ discountBps: 0 }), "Discount rate")).toBe(
      "—",
    );
  });

  it("resolves the settled timeline entry from the invoice status", () => {
    expect(
      buildInvoicePdfContent(makeInvoice()).timeline.map(
        (entry) => entry.label,
      ),
    ).toEqual([
      "Created",
      "Listed for Financing",
      "Funded by Pool",
      "Marked as Shipped",
      "Delivery Confirmed - Issuer",
      "Delivery Confirmed - Buyer",
      "Repaid / Defaulted",
    ]);

    expect(
      buildInvoicePdfContent(makeInvoice({ status: "Repaid" })).timeline[6],
    ).toMatchObject({ label: "Repaid" });
    expect(
      buildInvoicePdfContent(makeInvoice({ status: "Defaulted" })).timeline[6],
    ).toMatchObject({ label: "Defaulted" });
  });

  it("carries timeline timestamps and transaction hashes through", () => {
    const content = buildInvoicePdfContent(
      makeInvoice({ status: "Active", shippedAt: 1_735_550_000 }),
    );

    const shipped = content.timeline.find(
      (entry) => entry.label === "Marked as Shipped",
    );
    expect(shipped?.timestampLabel).not.toBe("Pending");

    const pending = content.timeline[6];
    expect(pending.timestampLabel).toBe("Pending");
    expect(pending.txHash).toBeNull();
  });
});

describe("generateInvoicePdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInstances.length = 0;
    pageSize.width = 595.28;
    pageSize.height = 841.89;
  });

  it("draws the invoice details and status timeline, then saves the file", async () => {
    await generateInvoicePdf(makeInvoice());

    const text = drawnText();
    expect(text).toContain("TrusTrove Invoice");
    expect(text).toContain("Invoice details");
    expect(text).toContain("Status timeline");
    expect(text).toContain("INVOICE ID");
    expect(text).toContain(INVOICE_ID);
    expect(text).toContain("100.00 USDC");
    expect(text).toContain("5.00%");
    expect(text).toContain("90.00 USDC");
    expect(text).toContain(ISSUER);
    expect(text).toContain(BUYER);
    expect(text).toContain("CREATED");
    expect(text).toContain("REPAID / DEFAULTED");

    expect(mockInstances).toHaveLength(1);
    expect(mockSave).toHaveBeenCalledWith("trusttrove-invoice-a1b2c3d4.pdf");
  });

  it("renders without a connected wallet (no signer/contract access needed)", async () => {
    await expect(generateInvoicePdf(makeInvoice())).resolves.toBeUndefined();
  });

  it("records transaction hashes on the timeline entries", async () => {
    await generateInvoicePdf(
      makeInvoice({
        status: "Active",
        shippedAt: 1_735_550_000,
        ...({
          transactionHashes: { shipped: "shipped-transaction-hash" },
        } as Partial<Invoice>),
      }),
    );

    expect(
      drawnText().some((line) => line.includes("shipped-transaction-hash")),
    ).toBe(true);
  });

  it("keeps everything on one page for a normal invoice", async () => {
    await generateInvoicePdf(makeInvoice());

    expect(mockAddPage).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it("starts a new page when the content runs past the page height", async () => {
    // Force a page too short to hold the title plus the first section.
    pageSize.height = 120;

    await generateInvoicePdf(makeInvoice());

    expect(mockAddPage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
