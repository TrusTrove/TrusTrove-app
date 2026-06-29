# SDK Reference

The TypeScript SDK in `packages/sdk` wraps all Soroban contract calls.
Import from `@trusttrove/sdk` in the monorepo or use the workspace package.

## Setup

```typescript
import { createSdkClients } from "@trusttrove/sdk";

const clients = createSdkClients({
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  registryContractId: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID!,
  invoiceContractId: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID!,
  poolContractId: process.env.NEXT_PUBLIC_POOL_CONTRACT_ID!,
  escrowContractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!,
});
```

## Registry Client

```typescript
// Check if an address is verified
const verified = await clients.registry.isVerified(publicKey);

// Register as issuer (requires Freighter signature)
const txHash = await clients.registry.registerIssuer(publicKey, {
  company: "Acme Ltd",
  country: "NG",
});
```

## Invoice Client

```typescript
// Create an invoice
const invoiceId = await clients.invoice.create({
  issuer: issuerPublicKey,
  buyer: buyerPublicKey,
  faceValue: BigInt(10_000_000_000), // 1000 USDC in stroops
  dueDate: Math.floor(Date.now() / 1000) + 60 * 24 * 60 * 60, // 60 days
});

// List for financing
await clients.invoice.listForFinancing(invoiceId, 200); // 200 bps = 2%

// Get an invoice
const invoice = await clients.invoice.get(invoiceId);

// Get all invoices for an issuer
const invoices = await clients.invoice.getByIssuer(publicKey);
```

## Pool Client

```typescript
// Get pool stats
const stats = await clients.pool.getStats();
// stats.availableLiquidity — BigInt, in stroops
// stats.utilizationRateBps — number

// Deposit USDC
const shares = await clients.pool.deposit(publicKey, BigInt(1_000_000_000_000));

// Get LP position
const position = await clients.pool.getLpPosition(publicKey);
// position.usdcValue — current USDC value of shares
// position.yieldEarned — total yield earned

// Fund an invoice
await clients.pool.fundInvoice(invoiceId);
```

## Amount formatting

All amounts in the SDK are `BigInt` in stroops. Use these helpers to convert:

```typescript
import { toUsdc, fromUsdc } from "@trusttrove/sdk";

toUsdc(BigInt(10_000_000)); // → "1.00"
fromUsdc("1000.50"); // → BigInt(10005000000)
```

Never pass `number` to amount arguments — JavaScript numbers cannot represent
u128 values accurately. Always use `BigInt`.
