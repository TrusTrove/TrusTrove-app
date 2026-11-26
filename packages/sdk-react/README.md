# @trusttrove/sdk-react

React hooks and providers for the [TrusTrove TypeScript SDK](../sdk).

## Installation

```bash
npm install @trusttrove/sdk-react @trusttrove/sdk
# or
pnpm add @trusttrove/sdk-react @trusttrove/sdk
```

## Usage

```tsx
import { TrusTroveProvider, useInvoices } from "@trusttrove/sdk-react";

function App() {
  return (
    <TrusTroveProvider
      sorobanRpcUrl="https://soroban-testnet.stellar.org"
      networkPassphrase="Test SDF Network ; September 2015"
      invoiceContractId="CA4O..."
    >
      <InvoiceList />
    </TrusTroveProvider>
  );
}

function InvoiceList() {
  const { invoices, isLoading } = useInvoices({ issuer: "G..." });
  if (isLoading) return <p>Loading...</p>;
  return (
    <ul>
      {invoices.map((inv) => (
        <li key={inv.id}>{inv.id}</li>
      ))}
    </ul>
  );
}
```

## Documentation

Full API reference and guides live in the [TrusTrove developer docs](https://github.com/TrusTrove/TrusTrove-app/tree/main/docs).

## License

[MIT](../../LICENSE)
