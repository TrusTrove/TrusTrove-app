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

#### Where each field comes from

Envelope fields are on-chain facts taken from the event that triggered the
delivery, not from the moment the worker sent it:

- `event_id`, `ledger` and `contract_id` come from the Soroban event itself, so
  a re-indexed historical event keeps its original identity.
- `occurred_at` is the **ledger close time** of that ledger, never the indexer's
  wall clock. A delivery retried an hour later, or an event replayed after a
  resync, still reports when it happened on-chain.

`data` is read back from the invoice row the listener just updated, so it
reflects post-transaction state rather than what happened to be in the event
arguments:

- Invoice events (`invoice.*`) carry `invoice_id`, `issuer`, `buyer`,
  `face_value`, `discount_bps`, `funded_amount`, `due_date`, `status`,
  `created_at` and the lifecycle timestamps `funded_at`, `shipped_at`,
  `buyer_confirmed_at`, `repaid_at`.
- Lifecycle timestamps that have not happened yet are **absent** from the
  payload, not zero. Treat a missing key as "not reached".
- Pool events (`pool.*`) carry `account`, `amount` and, when the contract
  reports them, `shares`, `new_balance`, `yield_amount` and `total_shares`.

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

### Delivery Guarantees

**Delivery is at-least-once, never exactly-once.** Subscribe idempotently and
de-duplicate on `event_id`: a subscriber that returns 2xx slowly, an indexer
that is killed mid-attempt, or two indexer replicas running during a rolling
deploy can all result in the same `event_id` being delivered more than once.

The queue guarantees the weaker property that no delivery is lost and no two
workers attempt the same row at the same time:

- `db.GetPendingDeliveries` **claims** rows instead of merely reading them. The
  read is a single statement that locks the candidate rows with
  `SELECT … FOR UPDATE SKIP LOCKED` and stamps `locked_until`, so a concurrent
  claim by another worker (or another replica of the same indexer) gets a
  disjoint batch.
- A claimed row is invisible to other workers until either the attempt records
  an outcome (`MarkDeliverySuccess`, `MarkDeliveryRetry` and
  `MarkDeliveryDeadLetter` all clear `locked_until`) or the lock expires.
- If a worker dies after claiming and before recording an outcome, the row
  stays `pending` and becomes claimable again once `locked_until` passes. That
  is the case in which a subscriber may see an event twice.
- Rows are never deleted on success; they move to `delivered`, so the queue can
  be audited.

### Worker Configuration

The delivery worker attempts a batch of deliveries from a bounded pool that
shares a single `http.Client`, so TCP/TLS connections are reused across
deliveries instead of paying a handshake per POST. Environment variables read
by `indexer/config`:

- `WEBHOOK_WORKER_CONCURRENCY` (default `8`): how many deliveries one batch
  attempts in parallel. Keep it small when your subscribers rate-limit inbound
  traffic. Non-positive values fall back to the default.
- The claim lock TTL is `db.DefaultClaimLockTTL` (60s) and must stay comfortably
  above the worker's HTTP timeout so an in-flight attempt is never handed to a
  second worker.

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
- `webhook_deliveries`: Tracks delivery attempts, status, and responses.
  `locked_until` holds the current claim (see
  [Delivery Guarantees](#delivery-guarantees)) and is `NULL` when the row is
  free; migration `010_add_webhook_delivery_locking.sql` added the column.

## Implementation Details

The webhook system was implemented in three phases:

1. **Payload Schema** (#804): Defined versioned JSON envelope and event types in `indexer/webhooks/payload.go`
2. **Subscriptions Table** (#805): Added database schema and Go accessors in `indexer/db/webhooks.go` and migration `009_add_webhook_subscriptions.sql`
3. **Delivery Worker** (#806): Implemented background worker with signing, retry, and dead-letter handling in `indexer/webhooks/worker.go` and `indexer/webhook/dispatcher.go`

All components are integrated in `indexer/main.go` and run as background goroutines alongside the event listener.
