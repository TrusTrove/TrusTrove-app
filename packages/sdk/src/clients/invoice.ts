import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { BaseContractClient } from "../base.js";
import { Invoice, InvoiceStatus } from "../types/index.js";
import { parseInvoice } from "../types/schemas.js";

export class InvoiceClient extends BaseContractClient {
  /**
   * Initializes the invoice contract with its admin and registry contract.
   * Side effect: stores both addresses on-chain, plus the invoice counter. Can
   * only be called once — a second call panics.
   *
   * Mirrors the contract's
   * `initialize(env: Env, admin: Address, registry_contract: Address)`.
   * `registry_contract` is the registry that `create` checks issuer and buyer
   * against. The Underwrite agent-registry that `submit_attestation` verifies
   * signatures with is wired separately after deployment, through the contract's
   * admin-only `set_agent_registry_contract`.
   *
   * @param adminAddress - The Stellar address to set as the contract admin. Must sign.
   * @param registryContractAddress - The registry contract address the invoice contract stores as `RegistryContract`.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the deployer/admin.
   * @returns The transaction hash of the on-chain submission.
   * @throws If the contract is already initialized, the transaction simulation fails, or on-chain submission errors.
   */
  async initialize(
    adminAddress: string,
    registryContractAddress: string,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      new Address(adminAddress).toScVal(),
      new Address(registryContractAddress).toScVal(),
    ];
    return this.writeContract("initialize", args, signerPublicKey);
  }

  /**
   * Creates a new invoice on-chain in `Created` status.
   * Side effect: stores the invoice record and emits an event consumed by the indexer.
   * Both `issuer` and `buyer` must be registered in the registry contract.
   *
   * @param issuer - The Stellar address of the invoice issuer (SME). Must match `signerPublicKey` — `issuer.require_auth()` is enforced on-chain.
   * @param buyer - The Stellar address of the invoice buyer.
   * @param faceValue - The invoice face value in USDC stroops (1 USDC = 10,000,000 stroops).
   * @param dueDate - The invoice due date as a Unix timestamp in seconds.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice issuer.
   * @returns The transaction hash of the on-chain submission.
   * @throws If `issuer` or `buyer` is not registered in the registry contract, the transaction simulation fails, or on-chain submission errors.
   */
  async create(
    issuer: string,
    buyer: string,
    faceValue: bigint,
    dueDate: number,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      new Address(issuer).toScVal(),
      new Address(buyer).toScVal(),
      nativeToScVal(faceValue, { type: "u128" }),
      nativeToScVal(BigInt(dueDate), { type: "u64" }),
    ];
    return this.writeContract("create", args, signerPublicKey);
  }

  /**
   * Records a risk attestation produced off-chain by a registered Underwrite agent.
   * Side effect: stores an `Attestation` for the invoice and emits `AttestationSubmitted`.
   * This is a precondition for `listForFinancing`, which fails with `VerificationRequired`
   * until an attestation exists.
   *
   * The call is permissionless — there is no `require_auth` on the caller. Trust comes
   * entirely from `signature`: the contract recovers the signer's public key and matches
   * it against an active agent registered in the agent-registry contract.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param payload - The attested payload bytes, covering the domain separator, invoice ID, risk score, evidence hash, agent ID and nonce.
   * @param signature - The recoverable secp256k1 signature over the payload. Must be exactly 65 bytes, the size the contract's `BytesN<65>` parameter expects.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Any account may submit an attestation.
   * @returns The transaction hash of the on-chain submission.
   * @throws If the recovered key is not a registered active agent (`UntrustedSigner`), an attestation was already submitted for this invoice (`AlreadyAttested`), the transaction simulation fails, or on-chain submission errors.
   */
  async submitAttestation(
    invoiceIdHex: string,
    payload: Uint8Array,
    signature: Uint8Array,
    signerPublicKey: string,
  ): Promise<string> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      xdr.ScVal.scvBytes(Buffer.from(payload)),
      xdr.ScVal.scvBytes(Buffer.from(signature)),
    ];
    return this.writeContract("submit_attestation", args, signerPublicKey);
  }

  /**
   * Lists an existing invoice for public financing on the marketplace.
   * Side effect: the invoice status transitions to `Listed`.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param discountBps - The discount rate in basis points (e.g. 500 = 5%).
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice issuer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async listForFinancing(
    invoiceIdHex: string,
    discountBps: number,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      nativeToScVal(discountBps, { type: "u32" }),
    ];
    return this.writeContract("list_for_financing", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Marks an invoice as shipped on-chain.
   * Side effect: the invoice status transitions to `Active`.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice issuer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async markShipped(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("mark_shipped", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Confirms delivery of goods for an invoice on-chain.
   * Side effect: updates the confirmation status for the provided `confirmerAddress`.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param confirmerAddress - The Stellar address whose delivery confirmation is being recorded.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the buyer or issuer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async confirmDelivery(
    invoiceIdHex: string,
    confirmerAddress: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [
      xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex")),
      new Address(confirmerAddress).toScVal(),
    ];
    return this.writeContract("confirm_delivery", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Repays a financed invoice on-chain, returning funds to the liquidity pool.
   * Side effect: the invoice status transitions to `Repaid` and LP yield is distributed.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the invoice buyer.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the transaction simulation fails or the on-chain submission errors.
   */
  async repay(invoiceIdHex: string, signerPublicKey: string): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("repay", args, signerPublicKey).then(() => true);
  }

  /**
   * Triggers a default on an overdue invoice on-chain.
   * Side effect: the invoice status transitions to `Defaulted` and `pool_contract.handle_default()` is invoked.
   * Only callable by the contract admin or the pool contract, and only after the invoice's due date has passed.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key that will sign the transaction. Must be the contract admin.
   * @returns `true` when the transaction succeeds on-chain.
   * @throws If the invoice is not in `Funded`, `Active`, or `Confirmed` status, its due date has not passed, the transaction simulation fails, or on-chain submission errors.
   */
  async triggerDefault(
    invoiceIdHex: string,
    signerPublicKey: string,
  ): Promise<boolean> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.writeContract("trigger_default", args, signerPublicKey).then(
      () => true,
    );
  }

  /**
   * Retrieves a single invoice by its on-chain ID.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param invoiceIdHex - The invoice ID as a 32-byte hex string.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns The parsed {@link Invoice} object.
   * @throws If the simulation fails or the return value cannot be parsed.
   */
  async get(invoiceIdHex: string, signerPublicKey: string): Promise<Invoice> {
    const args = [xdr.ScVal.scvBytes(Buffer.from(invoiceIdHex, "hex"))];
    return this.readContract("get", args, signerPublicKey, (val) =>
      parseInvoice(scValToNative(val)),
    );
  }

  /**
   * Retrieves all invoices with the specified on-chain status.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param status - The {@link InvoiceStatus} to filter invoices by.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns An array of parsed {@link Invoice} objects matching the status, or an empty array when no invoices match.
   * @throws If the simulation fails or a returned invoice cannot be parsed.
   */
  async getByStatus(
    status: InvoiceStatus,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [nativeToScVal(status, { type: "symbol" })];
    return this.readContract("get_by_status", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }

  /**
   * Retrieves all invoices issued by a specific address.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param address - The Stellar address of the invoice issuer to filter by.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns An array of parsed {@link Invoice} objects issued by the address, or an empty array when none are found.
   * @throws If the address is invalid, the simulation fails, or a returned invoice cannot be parsed.
   */
  async getByIssuer(
    address: string,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract("get_by_issuer", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }

  /**
   * Retrieves all invoices associated with a specific buyer address.
   * This is a read-only (simulated) call — no on-chain side effects.
   *
   * @param address - The Stellar address of the buyer to filter by.
   * @param signerPublicKey - The Stellar public key used to simulate the read call.
   * @returns An array of parsed {@link Invoice} objects for the buyer, or an empty array when none are found.
   * @throws If the address is invalid, the simulation fails, or a returned invoice cannot be parsed.
   */
  async getByBuyer(
    address: string,
    signerPublicKey: string,
  ): Promise<Invoice[]> {
    const args = [new Address(address).toScVal()];
    return this.readContract("get_by_buyer", args, signerPublicKey, (val) => {
      const native = scValToNative(val);
      if (!Array.isArray(native)) return [];
      return native.map(parseInvoice);
    });
  }
}
