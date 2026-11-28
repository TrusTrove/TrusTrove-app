# Amount Tooltips User Interaction

Every invoice amount, pool balance, or financial figure rendered across the web app is wrapped in an `AmountTooltip` component.

## User Interaction
- Hovering over any amount displays a native browser tooltip containing:
  - **Asset Code**: e.g., USDC or XLM
  - **Issuer**: The Stellar account ID of the asset issuer or "Native (none)"
  - **Network**: The active Stellar network (e.g., testnet or mainnet)
  - **Decimals**: The decimal precision (typically 7 for Stellar assets)
