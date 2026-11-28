# Liquidity Provider (LP) Guide

Welcome to the TrusTrove Liquidity Provider guide. This document outlines how liquidity providers can interact with TrusTrove lending pools, deposit USDC, monitor yields, and analyze pool risk profiles.

## Pool Analytics & Maturity Distribution

To help liquidity providers assess capital commitment duration and portfolio risk, TrusTrove provides comprehensive pool analytics, including the **Maturity Distribution** breakdown.

### Due-Date Bands & Overdue Tracking

Active funded principal in the pool is categorized into standard due-date buckets based on each invoice's remaining duration until maturity:

- **0–30 days**: Short-term liquidity commitments.
- **31–60 days**: Medium-term liquidity commitments.
- **61–90 days**: Extended medium-term commitments.
- **90+ days**: Long-term capital commitments.
- **Overdue**: Active funded principal whose due date has passed without repayment or default resolution.

### Reconciliation with Active Exposure

The maturity distribution analytics widget calculates the sum of all funded principal across active invoices (excluding fully repaid or defaulted invoices) and reconciles the sum of all maturity bands directly to total active pool exposure. Each band displays both the absolute USDC amount and its percentage share of active exposure.
