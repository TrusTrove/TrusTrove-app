# Invoice Financing Cost & Advance

## Overview

When creating or listing an invoice for LP financing, users configure the financing discount rate using basis points (bps) alongside percentage representation. The system uses bigint-safe arithmetic (stroops / 10,000,000) to calculate the exact discount amount and net advance payout in the selected invoice asset.

## User Interaction

- **Financing Cost Slider**: Adjusts the discount rate in basis points (e.g. 50 bps to 500 bps).
- **Dual Representation**: The UI displays both basis points and the calculated currency fee (e.g., `200 bps (2.00%) • 1,000 USDC`).
- **Review Preview**: Step 2 summarizes the invoice face value, fee, and net advance payout before submission.
