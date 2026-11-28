# Stale-Data Indicator

## Overview

The `StaleDataIndicator` component provides visibility into indexer state for indexed views such as invoices and liquidity pools. Since on-chain actions can succeed before indexers catch up, this indicator informs users whether the displayed data is fresh or potentially stale.

## User Interaction

- **Status Display**: Shows whether the view is synced or stale, along with the last indexed ledger number and timestamp.
- **Manual Refresh**: Users can click the **Refresh** button to request the latest indexer state without triggering or resubmitting any blockchain transactions.
