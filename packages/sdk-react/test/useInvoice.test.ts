import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { InvoiceClient } from "@trusttrove/sdk";
import {
  useInvoice,
  useInvoicesByStatus,
  useInvoicesByIssuer,
  useInvoicesByBuyer,
  useInvoiceMutations,
  UseInvoiceOptions,
} from "../src/useInvoice.js";

vi.mock("@trusttrove/sdk", () => {
  class MockInvoiceClient {
    contractId: string;
    constructor(contractId: string) {
      this.contractId = contractId;
    }
    get = vi.fn();
    getByStatus = vi.fn();
    getByIssuer = vi.fn();
    getByBuyer = vi.fn();
    create = vi.fn();
    listForFinancing = vi.fn();
    markShipped = vi.fn();
    confirmDelivery = vi.fn();
    repay = vi.fn();
    triggerDefault = vi.fn();
  }
  return { InvoiceClient: MockInvoiceClient };
});

const INVOICE_HEX = "abcd";
const SIGNER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const ISSUER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const BUYER = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF";

function makeOptions(client?: Partial<InvoiceClient>): UseInvoiceOptions {
  return { client: (client ?? {}) as InvoiceClient };
}

describe("useInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useInvoice", () => {
    it("returns the invoice with loading/error/data state", async () => {
      const invoice = { id: INVOICE_HEX, status: "Created" };
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.get).mockResolvedValue(invoice as any);

      const { result } = renderHook(() =>
        useInvoice(INVOICE_HEX, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(invoice);
      expect(result.current.error).toBeNull();
      expect(client.get).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.get).mockRejectedValue(new Error("read failed"));

      const { result } = renderHook(() =>
        useInvoice(INVOICE_HEX, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("read failed"));
    });

    it("refetches when the invoice id changes", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.get).mockResolvedValue({ id: INVOICE_HEX } as any);

      const { result, rerender } = renderHook(
        ({ invoice }) => useInvoice(invoice, SIGNER, makeOptions(client)),
        { initialProps: { invoice: INVOICE_HEX } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.get).toHaveBeenNthCalledWith(1, INVOICE_HEX, SIGNER);

      rerender({ invoice: "ef01" });
      await waitFor(() => expect(client.get).toHaveBeenCalledTimes(2));
      expect(client.get).toHaveBeenNthCalledWith(2, "ef01", SIGNER);
    });
  });

  describe("useInvoicesByStatus", () => {
    it("returns invoices with loading/error/data state", async () => {
      const invoices = [
        { id: INVOICE_HEX, status: "Listed" },
        { id: "ef02", status: "Listed" },
      ];
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByStatus).mockResolvedValue(invoices as any);

      const { result } = renderHook(() =>
        useInvoicesByStatus("Listed", SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(invoices);
      expect(result.current.error).toBeNull();
      expect(client.getByStatus).toHaveBeenCalledWith("Listed", SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByStatus).mockRejectedValue(
        new Error("status read failed"),
      );

      const { result } = renderHook(() =>
        useInvoicesByStatus("Listed", SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("status read failed"));
    });

    it("refetches when the status changes", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByStatus).mockResolvedValue([]);

      const { result, rerender } = renderHook(
        ({ status }) =>
          useInvoicesByStatus(status, SIGNER, makeOptions(client)),
        { initialProps: { status: "Listed" } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getByStatus).toHaveBeenNthCalledWith(1, "Listed", SIGNER);

      rerender({ status: "Funded" });
      await waitFor(() => expect(client.getByStatus).toHaveBeenCalledTimes(2));
      expect(client.getByStatus).toHaveBeenNthCalledWith(2, "Funded", SIGNER);
    });
  });

  describe("useInvoicesByIssuer", () => {
    it("returns invoices with loading/error/data state", async () => {
      const invoices = [{ id: INVOICE_HEX, issuer: ISSUER }];
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByIssuer).mockResolvedValue(invoices as any);

      const { result } = renderHook(() =>
        useInvoicesByIssuer(ISSUER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(invoices);
      expect(result.current.error).toBeNull();
      expect(client.getByIssuer).toHaveBeenCalledWith(ISSUER, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByIssuer).mockRejectedValue(
        new Error("issuer read failed"),
      );

      const { result } = renderHook(() =>
        useInvoicesByIssuer(ISSUER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("issuer read failed"));
    });

    it("refetches when the issuer changes", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByIssuer).mockResolvedValue([]);

      const { result, rerender } = renderHook(
        ({ issuer }) =>
          useInvoicesByIssuer(issuer, SIGNER, makeOptions(client)),
        { initialProps: { issuer: ISSUER } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getByIssuer).toHaveBeenNthCalledWith(1, ISSUER, SIGNER);

      rerender({ issuer: BUYER });
      await waitFor(() => expect(client.getByIssuer).toHaveBeenCalledTimes(2));
      expect(client.getByIssuer).toHaveBeenNthCalledWith(2, BUYER, SIGNER);
    });
  });

  describe("useInvoicesByBuyer", () => {
    it("returns invoices with loading/error/data state", async () => {
      const invoices = [{ id: INVOICE_HEX, buyer: BUYER }];
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByBuyer).mockResolvedValue(invoices as any);

      const { result } = renderHook(() =>
        useInvoicesByBuyer(BUYER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(invoices);
      expect(result.current.error).toBeNull();
      expect(client.getByBuyer).toHaveBeenCalledWith(BUYER, SIGNER);
    });

    it("surfaces read errors", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByBuyer).mockRejectedValue(
        new Error("buyer read failed"),
      );

      const { result } = renderHook(() =>
        useInvoicesByBuyer(BUYER, SIGNER, makeOptions(client)),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(new Error("buyer read failed"));
    });

    it("refetches when the buyer changes", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.getByBuyer).mockResolvedValue([]);

      const { result, rerender } = renderHook(
        ({ buyer }) => useInvoicesByBuyer(buyer, SIGNER, makeOptions(client)),
        { initialProps: { buyer: BUYER } },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(client.getByBuyer).toHaveBeenNthCalledWith(1, BUYER, SIGNER);

      rerender({ buyer: ISSUER });
      await waitFor(() => expect(client.getByBuyer).toHaveBeenCalledTimes(2));
      expect(client.getByBuyer).toHaveBeenNthCalledWith(2, ISSUER, SIGNER);
    });
  });

  describe("useInvoiceMutations", () => {
    it("exposes create mutation with pending/error state", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.create).mockResolvedValue("mock-hash");

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      expect(result.current.create.isPending).toBe(false);

      let promise: Promise<string> | undefined;
      act(() => {
        promise = result.current.create.mutate(ISSUER, BUYER, 1000n, 1234);
      });
      await waitFor(() => expect(result.current.create.isPending).toBe(true));

      await act(async () => {
        await promise;
      });

      expect(await promise).toBe("mock-hash");
      expect(client.create).toHaveBeenCalledWith(
        ISSUER,
        BUYER,
        1000n,
        1234,
        SIGNER,
      );
      await waitFor(() => expect(result.current.create.isPending).toBe(false));
      expect(result.current.create.error).toBeNull();
    });

    it("exposes listForFinancing mutation", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.listForFinancing).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.listForFinancing.mutate(INVOICE_HEX, 500);
      });

      expect(client.listForFinancing).toHaveBeenCalledWith(
        INVOICE_HEX,
        500,
        SIGNER,
      );
    });

    it("exposes markShipped mutation", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.markShipped).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.markShipped.mutate(INVOICE_HEX);
      });

      expect(client.markShipped).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("exposes confirmDelivery mutation", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.confirmDelivery).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.confirmDelivery.mutate(INVOICE_HEX, BUYER);
      });

      expect(client.confirmDelivery).toHaveBeenCalledWith(
        INVOICE_HEX,
        BUYER,
        SIGNER,
      );
    });

    it("exposes repay mutation", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.repay).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.repay.mutate(INVOICE_HEX);
      });

      expect(client.repay).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("exposes triggerDefault mutation", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.triggerDefault).mockResolvedValue(true);

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      await act(async () => {
        await result.current.triggerDefault.mutate(INVOICE_HEX);
      });

      expect(client.triggerDefault).toHaveBeenCalledWith(INVOICE_HEX, SIGNER);
    });

    it("records and rethrows mutation errors", async () => {
      const client = new InvoiceClient(CONTRACT_ID);
      vi.mocked(client.repay).mockRejectedValue(new Error("repay failed"));

      const { result } = renderHook(() =>
        useInvoiceMutations(SIGNER, makeOptions(client)),
      );

      let errorValue: unknown;
      await act(async () => {
        try {
          await result.current.repay.mutate(INVOICE_HEX);
        } catch (err) {
          errorValue = err;
        }
      });

      expect(errorValue).toEqual(new Error("repay failed"));
      await waitFor(() =>
        expect(result.current.repay.error).toEqual(new Error("repay failed")),
      );
    });
  });
});
