# SDK Reference

The TypeScript SDK in `packages/sdk` wraps all Soroban contract calls.
Import from `@trusttrove/sdk` in the monorepo or use the workspace package.

## Setup

```typescript
import { configureSDK } from "@trusttrove/sdk";

configureSDK({
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractIds: {
    registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID!,
    invoice: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID!,
    pool: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID!,
    escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!,
  },
});
```

Then import the individual clients directly:

```typescript
import {
  RegistryClient,
  InvoiceClient,
  PoolClient,
  EscrowClient,
} from "@trusttrove/sdk";

const registry = new RegistryClient(process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID!);
const invoice = new InvoiceClient(process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID!);
const pool = new PoolClient(process.env.NEXT_PUBLIC_POOL_CONTRACT_ID!);
const escrow = new EscrowClient(process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!);
```

> **Note:** All write methods (`writeContract`) require a `signerPublicKey` argument — the Freighter wallet address that will sign the transaction. All read methods (`readContract`) also require it to build and simulate the transaction.

---

## Registry Client

```typescript
// Check if an address is verified
const verified = await registry.isVerified(publicKey, signerPublicKey);

// Get a full profile
const profile = await registry.getProfile(publicKey, signerPublicKey);
// profile.address, profile.role ("issuer" | "buyer"), profile.verified, profile.registeredAt

// Register as issuer (requires Freighter signature)
const txHash = await registry.registerIssuer(
  publicKey,
  { company: "Acme Ltd", country: "NG" },
  signerPublicKey,
);

// Register as buyer
await registry.registerBuyer(
  publicKey,
  { company: "Buyer Corp", country: "US" },
  signerPublicKey,
);

// Revoke an address (admin only)
await registry.revoke(publicKey, signerPublicKey);
```

---

## Invoice Client

```typescript
// Create an invoice
const txHash = await invoice.create(
  issuerPublicKey,
  buyerPublicKey,
  BigInt(10_000_000_000), // 1000 USDC in stroops
  Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60, // 60 days
  signerPublicKey,
);

// List for financing
await invoice.listForFinancing(invoiceIdHex, 200, signerPublicKey); // 200 bps = 2%

// Advance invoice lifecycle
await invoice.markShipped(invoiceIdHex, signerPublicKey);
await invoice.confirmDelivery(invoiceIdHex, confirmerAddress, signerPublicKey);
await invoice.repay(invoiceIdHex, signerPublicKey);
await invoice.triggerDefault(invoiceIdHex, signerPublicKey);

// Read invoices
const inv = await invoice.get(invoiceIdHex, signerPublicKey);
const byIssuer = await invoice.getByIssuer(issuerPublicKey, signerPublicKey);
const byBuyer = await invoice.getByBuyer(buyerPublicKey, signerPublicKey);
const listed = await invoice.getByStatus("Listed", signerPublicKey);
```

The returned `Invoice` object has the following shape:

```typescript
interface Invoice {
  id: string;              // hex string of BytesN<32>
  issuer: string;
  buyer: string;
  faceValue: bigint;       // in stroops
  asset: "USDC" | "XLM";
  discountBps: number;
  fundedAmount: bigint;
  dueDate: number;         // Unix timestamp (seconds)
  status: InvoiceStatus;   // "Created" | "Listed" | "Funded" | "Active" | "Confirmed" | "Repaid" | "Defaulted"
  createdAt: number;
  fundedAt: number | null;
  shippedAt: number | null;
  issuerConfirmed: boolean;
  buyerConfirmed: boolean;
  buyerConfirmedAt: number | null;
  repaidAt: number | null;
}
```

---

## Pool Client

```typescript
// Get pool stats
const stats = await pool.getStats(signerPublicKey);
// stats.availableLiquidity   — bigint, in stroops
// stats.totalDeposits        — bigint
// stats.totalFunded          — bigint
// stats.utilizationRateBps   — number
// stats.totalYieldDistributed — bigint
// stats.activeInvoiceCount   — number

// Get utilization rate as a standalone call
const rateBps = await pool.getUtilizationRate(signerPublicKey);

// Deposit USDC (returns tx hash)
const txHash = await pool.deposit(lpPublicKey, BigInt(1_000_000_000_000), signerPublicKey);

// Withdraw by share amount
await pool.withdraw(lpPublicKey, shareAmount, signerPublicKey);

// Get LP position
const position = await pool.getLPPosition(lpPublicKey, signerPublicKey);
// position.shares        — bigint
// position.usdcValue     — bigint, current USDC value of shares
// position.yieldEarned   — bigint
// position.depositCount  — number

// Fund an invoice from pool liquidity
await pool.fundInvoice(invoiceIdHex, signerPublicKey);

// Record a repayment back into the pool
await pool.receiveRepayment(invoiceIdHex, repaymentAmount, signerPublicKey);
```

---

## Escrow Client

```typescript
// Lock USDC in escrow for an invoice
await escrow.lock(invoiceIdHex, amount, signerPublicKey);

// Release locked funds to the issuer (on successful delivery)
await escrow.releaseToIssuer(invoiceIdHex, signerPublicKey);

// Release funds back to the pool with repayment amount
await escrow.releaseToPool(invoiceIdHex, repaymentAmount, signerPublicKey);

// Handle a default event
await escrow.handleDefault(invoiceIdHex, signerPublicKey);

// Read currently locked amount
const locked = await escrow.getLocked(invoiceIdHex, signerPublicKey);
```

---

## Simulating Transactions

Every client inherits `simulateTransaction` from `BaseContractClient`. Use it to estimate fees and preview return values **without** submitting to the network. This is useful for building confirmation UIs or checking whether a call will succeed.

```typescript
import { nativeToScVal, xdr, Address } from "@stellar/stellar-sdk";

// Simulate a deposit to estimate fees before signing
const simulation = await pool.simulateTransaction(
  "deposit",
  [
    new Address(lpPublicKey).toScVal(),
    nativeToScVal(BigInt(1_000_000_000_000), { type: "u128" }),
  ],
  signerPublicKey,
);

console.log(simulation.functionName);     // "deposit"
console.log(simulation.estimatedFeeXlm); // e.g. "0.0001234"
console.log(simulation.expectedResult);  // parsed return value (if any)
console.log(simulation.footprintSize);   // number of ledger entries touched
```

The return type is:

```typescript
{
  estimatedFeeXlm: string;   // total fee (base + resource) in XLM
  functionName: string;      // the method name you passed in
  expectedResult: any;       // scValToNative() of the retval, or undefined
  footprintSize: number;     // read-only + read-write ledger entry count
}
```

`simulateTransaction` throws if the simulation itself fails (e.g. bad arguments, insufficient liquidity), so you can catch errors early before asking the user to sign.

---

## Amount Formatting

All amounts in the SDK are `bigint` in stroops (1 USDC = 10,000,000 stroops). Use these helpers to convert:

```typescript
import { toUsdc, fromUsdc } from "@trusttrove/sdk";

toUsdc(BigInt(10_000_000));  // → "1.00"
fromUsdc("1000.50");          // → BigInt(10005000000)
```

> Never pass `number` to amount arguments — JavaScript numbers cannot represent `u128` values accurately. Always use `BigInt`.

---

## Error Handling

All SDK calls throw on failure. Common patterns:

```typescript
try {
  const txHash = await invoice.create(...);
  console.log("Created:", txHash);
} catch (err) {
  if (err instanceof TransactionTimeoutError) {
    // Transaction was sent but confirmation timed out
    console.warn("Timed out, tx hash:", err.txHash);
  } else {
    // Simulation error, signing error, or network error
    console.error(err.message);
  }
}
```

Import `TransactionTimeoutError` from `@trusttrove/sdk` to distinguish polling timeouts from other failures. The SDK automatically retries transient network errors up to 3 times with exponential backoff before throwing.
