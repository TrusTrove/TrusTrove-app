# Webhook System

The TrusTrove indexer provides a webhook system for external systems to subscribe to real-time event notifications.

## Overview

Webhooks allow external systems to receive HTTP POST notifications when specific events occur on-chain. The system supports:

- **Invoice lifecycle events**: created, funded, repaid, defaulted, listed, shipped, confirmed
- **Pool events**: deposit, withdrawal, yield distribution

## Architecture

### Payload Schema (v1.0)

All webhook deliveries use a versioned envelope:

```json
{
  "schema_version": "1.0",
  "event_type": "invoice.created",
  "event_id": "evt_abc123",
  "occurred_at": "2024-12-30T00:00:00Z",
  "ledger": 1234567,
  "contract_id": "CABGWVIZFF62FG67ZGFEP67NEEY4WYTMFURDMFTKKNRDAFPKPOJDTN4C",
  "data": {
    "invoice_id": "INV1234567890abcdef",
    "issuer": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    "buyer": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    "face_value": "1000000000",
    "due_date": 1735689600,
    "status": "Created",
    "created_at": 1735516800
  }
}
```

### Supported Event Types

| Event Type               | Description                  |
| ------------------------ | ---------------------------- |
| `invoice.created`        | New invoice created          |
| `invoice.funded`         | Invoice funded by pool       |
| `invoice.repaid`         | Invoice repaid by buyer      |
| `invoice.defaulted`      | Invoice defaulted            |
| `invoice.listed`         | Invoice listed for financing |
| `invoice.shipped`        | Invoice marked as shipped    |
| `invoice.confirmed`      | Delivery confirmed by buyer  |
| `pool.deposit`           | User deposited to pool       |
| `pool.withdrawal`        | User withdrew from pool      |
| `pool.yield_distributed` | Yield distributed to LPs     |

### Security

Each webhook delivery is signed with HMAC-SHA256 using the subscription's secret:

```
X-TrusTrove-Signature: sha256=<hex_digest>
X-TrusTrove-Timestamp: <unix_timestamp>
```

The signature is computed as `HMAC_SHA256(secret, timestamp + "." + payload)`.

### Retry Logic

Failed deliveries are retried with exponential backoff:

- Attempt 1: 10 seconds
- Attempt 2: 20 seconds
- Attempt 3: 40 seconds
- Attempt 4: 80 seconds
- Attempt 5: 160 seconds (then dead-lettered)

### Subscription Management

Webhook subscriptions are managed via the database. Use the following tables:

- `webhook_subscriptions`: Stores subscriber URLs, event types, secrets, and active status
- `webhook_deliveries`: Tracks delivery attempts, status, and responses

## Implementation Details

The webhook system was implemented in three phases:

1. **Payload Schema** (#804): Defined versioned JSON envelope and event types in `indexer/webhooks/payload.go`
2. **Subscriptions Table** (#805): Added database schema and Go accessors in `indexer/db/webhooks.go` and migration `009_add_webhook_subscriptions.sql`
3. **Delivery Worker** (#806): Implemented background worker with signing, retry, and dead-letter handling in `indexer/webhooks/worker.go` and `indexer/webhook/dispatcher.go`

All components are integrated in `indexer/main.go` and run as background goroutines alongside the event listener.
