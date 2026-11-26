# @trusttrove/sdk

TypeScript SDK for the [TrusTrove](https://github.com/TrusTrove/TrusTrove-app) decentralised trade-finance protocol on Stellar Soroban.

## Installation

```bash
npm install @trusttrove/sdk
# or
pnpm add @trusttrove/sdk
```

## Usage

```typescript
import { configureSDK, InvoiceClient } from "@trusttrove/sdk";

configureSDK({
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  invoiceContractId: "CA4O...",
});

const client = new InvoiceClient();
const invoices = await client.getInvoices({ issuer: "G..." });
```

## Documentation

Full API reference and guides live in the [TrusTrove developer docs](https://github.com/TrusTrove/TrusTrove-app/tree/main/docs).

## License

[MIT](../../LICENSE)
