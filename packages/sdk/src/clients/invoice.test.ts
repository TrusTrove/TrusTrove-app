import { describe, it, expect, vi, beforeEach } from "vitest";
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import { InvoiceClient } from "./invoice.js";

vi.mock("../base.js", () => {
  return {
    BaseContractClient: class {
      contractId: string;
      constructor(contractId: string) {
        this.contractId = contractId;
      }
      writeContract = vi.fn();
      readContract = vi.fn();
    },
  };
});

describe("InvoiceClient", () => {
  let client: InvoiceClient;

  beforeEach(() => {
    client = new InvoiceClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );
  });

  describe("submitAttestation", () => {
    const invoiceIdHex =
      "1111111111111111111111111111111111111111111111111111111111111111";
    // 65 bytes, the size of the contract's `BytesN<65>` signature parameter.
    const signature = new Uint8Array(65).fill(7);
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const signerPublicKey =
      "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

    it("calls writeContract with submit_attestation and returns the tx hash", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.submitAttestation(
        invoiceIdHex,
        payload,
        signature,
        signerPublicKey,
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "submit_attestation",
        expect.any(Array),
        signerPublicKey,
      );
    });

    it("encodes the invoice id, payload and signature as bytes arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      await client.submitAttestation(
        invoiceIdHex,
        payload,
        signature,
        signerPublicKey,
      );

      const args = vi.mocked(client["writeContract"]).mock
        .calls[0][1] as xdr.ScVal[];

      expect(args).toEqual([
        xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
        xdr.ScVal.scvBytes(Buffer.from(payload)),
        xdr.ScVal.scvBytes(Buffer.from(signature)),
      ]);
    });

    it("passes the signature bytes through intact and in contract argument order", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      await client.submitAttestation(
        invoiceIdHex,
        payload,
        signature,
        signerPublicKey,
      );

      const args = vi.mocked(client["writeContract"]).mock
        .calls[0][1] as xdr.ScVal[];

      expect(Buffer.from(scValToNative(args[0]) as Uint8Array)).toEqual(
        Buffer.from(invoiceIdHex, "hex"),
      );
      expect(Buffer.from(scValToNative(args[1]) as Uint8Array)).toEqual(
        Buffer.from(payload),
      );
      expect(Buffer.from(scValToNative(args[2]) as Uint8Array)).toEqual(
        Buffer.from(signature),
      );
    });
  });

  describe("initialize", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const adminAddress =
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
      const signerPublicKey =
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

      const result = await client.initialize(adminAddress, signerPublicKey);

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "initialize",
        [new Address(adminAddress).toScVal()],
        signerPublicKey,
      );
    });
  });

  describe("create", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.create(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        1000n,
        1234567890,
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "create",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("listForFinancing", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.listForFinancing(
        "abcd",
        500,
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "list_for_financing",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("markShipped", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.markShipped(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "mark_shipped",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("confirmDelivery", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.confirmDelivery(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "confirm_delivery",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("repay", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.repay(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "repay",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("triggerDefault", () => {
    it("calls writeContract with correct arguments", async () => {
      vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");

      const result = await client.triggerDefault(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toBe(true);
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "trigger_default",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );
    });
  });

  describe("get", () => {
    it("calls readContract with correct arguments", async () => {
      const mockInvoice = { id: "abcd", status: "created" };
      vi.mocked(client["readContract"]).mockResolvedValue(mockInvoice);

      const result = await client.get(
        "abcd",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockInvoice);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getByStatus", () => {
    it("calls readContract with correct arguments", async () => {
      const mockInvoices = [{ id: "abcd", status: "created" }];
      vi.mocked(client["readContract"]).mockResolvedValue(mockInvoices);

      const result = await client.getByStatus(
        "created" as any,
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockInvoices);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_by_status",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getByIssuer", () => {
    it("calls readContract with correct arguments", async () => {
      const mockInvoices = [{ id: "abcd", status: "created" }];
      vi.mocked(client["readContract"]).mockResolvedValue(mockInvoices);

      const result = await client.getByIssuer(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockInvoices);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_by_issuer",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });

  describe("getByBuyer", () => {
    it("calls readContract with correct arguments", async () => {
      const mockInvoices = [{ id: "abcd", status: "created" }];
      vi.mocked(client["readContract"]).mockResolvedValue(mockInvoices);

      const result = await client.getByBuyer(
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result).toEqual(mockInvoices);
      expect(client["readContract"]).toHaveBeenCalledWith(
        "get_by_buyer",
        expect.any(Array),
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        expect.any(Function),
      );
    });
  });
});
