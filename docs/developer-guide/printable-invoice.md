# Printable Invoice Detail Layout

## Overview

Internal finance teams require a concise review artifact for invoices without navigation clutter, action buttons, or interactive widget headers.

## Printable Invoice Layout (`PrintableInvoice`)

The component located at `apps/web/components/invoice/PrintableInvoice.tsx` renders a clean, print-optimized document view containing:

- Parties (Issuer and Buyer Stellar addresses)
- Amounts (Face value, discount rate, funded amount, and asset type)
- Due Date formatted in readable local calendar date format
- Lifecycle status badge
- Contract ID
- Transaction references recorded across the invoice lifecycle

## Usage

Integrated directly into the invoice detail view (`InvoiceDetailClient.tsx`), hidden on standard screen viewports via Tailwind print utility classes and displayed when the browser print dialog (`window.print()`) is invoked.
