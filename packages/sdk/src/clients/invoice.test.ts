import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
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
      const registryContractAddress =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      const signerPublicKey =
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

      const result = await client.initialize(
        adminAddress,
        registryContractAddress,
        signerPublicKey,
      );

      expect(result).toBe("mock-hash");
      expect(client["writeContract"]).toHaveBeenCalledWith(
        "initialize",
        [
          new Address(adminAddress).toScVal(),
          new Address(registryContractAddress).toScVal(),
        ],
        signerPublicKey,
      );

      const args = vi.mocked(client["writeContract"]).mock
        .calls[0][1] as xdr.ScVal[];
      expect(args).toHaveLength(2);
      expect(
        args.map((arg) => arg.switch()),
        "initialize encodes admin then registry_contract, both Address ScVals",
      ).toEqual([xdr.ScValType.scvAddress(), xdr.ScValType.scvAddress()]);
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

const DOC_PATH = new URL(
  "../../../../docs/smart-contracts/invoice-contract.md",
  import.meta.url,
);

/**
 * Returns the parameter list inside the first balanced `(...)` of a
 * declaration, or null when the fence holds no call signature.
 */
function parametersOf(declaration: string): string | null {
  const open = declaration.indexOf("(");
  if (open === -1) return null;
  let depth = 0;
  for (let index = open; index < declaration.length; index += 1) {
    if (declaration[index] === "(") depth += 1;
    else if (declaration[index] === ")") {
      depth -= 1;
      if (depth === 0) return declaration.slice(open + 1, index);
    }
  }
  return null;
}

/** Split on commas that sit outside nested `<>`, `()`, `[]` and `{}`. */
function splitParameters(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of inner) {
    if ("([{<".includes(char)) depth += 1;
    else if (")]}>".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^env\s*:\s*Env$/.test(part));
}

/**
 * On-chain function name -> argument count the docs declare, with the leading
 * `env: Env` host parameter removed (it is never encoded by the SDK).
 */
function documentedSignatures(markdown: string): Map<string, number> {
  const signatures = new Map<string, number>();
  for (const section of markdown.split(/^### /m).slice(1)) {
    const name = section.split("\n", 1)[0].trim();
    const fence = section.match(/```rust\n([\s\S]*?)```/);
    if (!fence) continue;
    const declaration = fence[1].replace(/\s+/g, " ").trim();
    if (!declaration.startsWith(name)) continue;
    const inner = parametersOf(declaration);
    if (inner === null) continue;
    signatures.set(name, splitParameters(inner).length);
  }
  return signatures;
}

const SIGNATURES = documentedSignatures(readFileSync(DOC_PATH, "utf8"));

describe("InvoiceClient contract signature consistency", () => {
  const ADMIN = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";
  const REGISTRY = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
  const INVOICE_ID_HEX = "ab".repeat(32);

  let client: InvoiceClient;
  /** On-chain function name -> how many ScVals the wrapper actually encoded. */
  let encoded: Map<string, number>;

  beforeEach(async () => {
    client = new InvoiceClient(REGISTRY);
    vi.mocked(client["writeContract"]).mockResolvedValue("mock-hash");
    vi.mocked(client["readContract"]).mockResolvedValue([]);

    await client.initialize(ADMIN, REGISTRY, ADMIN);
    await client.create(ADMIN, ADMIN, 1000n, 1_700_000_000, ADMIN);
    await client.listForFinancing(INVOICE_ID_HEX, 500, ADMIN);
    await client.markShipped(INVOICE_ID_HEX, ADMIN);
    await client.confirmDelivery(INVOICE_ID_HEX, ADMIN, ADMIN);
    await client.repay(INVOICE_ID_HEX, ADMIN);
    await client.triggerDefault(INVOICE_ID_HEX, ADMIN);
    await client.get(INVOICE_ID_HEX, ADMIN);
    await client.getByStatus("Funded", ADMIN);
    await client.getByIssuer(ADMIN, ADMIN);
    await client.getByBuyer(ADMIN, ADMIN);

    encoded = new Map();
    const calls = [
      ...vi.mocked(client["writeContract"]).mock.calls,
      ...vi.mocked(client["readContract"]).mock.calls,
    ];
    for (const call of calls) {
      const [method, args] = call as [string, xdr.ScVal[]];
      encoded.set(method, args.length);
    }
  });

  it("documents every on-chain function the SDK calls", () => {
    for (const method of encoded.keys()) {
      expect(
        SIGNATURES.has(method),
        `${method} is called by the SDK but has no documented signature`,
      ).toBe(true);
    }
  });

  it("encodes exactly the documented argument count per function", () => {
    expect(
      SIGNATURES.size,
      "the invoice doc should declare call signatures",
    ).toBeGreaterThan(0);
    for (const [method, count] of encoded) {
      expect(
        SIGNATURES.get(method),
        `${method}: the SDK encodes ${count} argument(s) but docs/smart-contracts/invoice-contract.md declares ${SIGNATURES.get(method)}`,
      ).toBe(count);
    }
  });

  it("declares initialize with both the admin and the registry contract", () => {
    expect(
      SIGNATURES.get("initialize"),
      "initialize(env, admin: Address, registry_contract: Address) has two encoded args",
    ).toBe(2);
  });
});
