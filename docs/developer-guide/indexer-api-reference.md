# Indexer API Reference

The Go indexer runs at `https://trusttrove-app.onrender.com` in production
and `http://localhost:8080` in local development.

All amounts are returned as strings to preserve u128 precision.

## GET /health

Health check. Returns 200 if the indexer is running.

```json
{ "status": "ok" }
```

## GET /invoices

Returns invoices with optional filtering.

**Query parameters:**

- `status` — filter by status: `Created`, `Listed`, `Funded`, `Active`, `Confirmed`, `Repaid`, `Defaulted`
- `issuer` — filter by issuer Stellar address
- `page` — page number (default: 1)
- `limit` — results per page (default: 20, max: 100)

**Response:**

```json
{
  "data": [
    {
      "id": "abc123...",
      "issuer": "GABC...",
      "buyer": "GDEF...",
      "face_value": "10000000000000",
      "funded_amount": "9800000000000",
      "discount_bps": 200,
      "due_date": 1750000000,
      "status": "Listed",
      "created_at": 1748000000
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20,
  "total_pages": 3
}
```

## GET /invoices/:id

Returns a single invoice by ID.

## GET /pool/stats

Returns current pool statistics aggregated from indexed events.

```json
{
  "total_deposits": "1000000000000000",
  "total_funded": "750000000000000",
  "available_liquidity": "250000000000000",
  "utilization_rate_bps": 7500,
  "total_yield_distributed": "15000000000000",
  "active_invoice_count": 12
}
```

## GET /pool/position/:address

Returns the LP position for a given Stellar address.

```json
{
  "shares": "1000000000000",
  "usdc_value": "1015000000000",
  "yield_earned": "15000000000",
  "deposit_count": 3
}
```

## GET /stats

Protocol-level aggregated statistics for the landing page.

```json
{
  "total_usdc_financed": "5000000000000000",
  "active_invoice_count": 12,
  "total_invoices": 47,
  "total_repaid": 31,
  "total_defaulted": 2,
  "average_yield_bps": 210,
  "pool_utilization_bps": 7500
}
```

## GET /auth

Requests a SEP-10 authentication challenge for a Stellar account. No JWT required.

**Query parameters:**

- `account` — the Stellar public key to authenticate (required)

**Response:**

```json
{
  "transaction": "AAAAAgAAA...",
  "network_passphrase": "Test SDF Network ; September 2015"
}
```

## POST /auth

Exchanges a signed SEP-10 challenge transaction for a JWT. No JWT required.

**Request body:**

```json
{
  "transaction": "AAAAAgAAA...signed..."
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400
}
```

## POST /invoices

Creates an off-chain/indexed invoice record. **Requires JWT** (`Authorization: Bearer <jwt>`).

**Request body:**

```json
{
  "buyer": "GBUYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "face_value": "1000.00",
  "due_date": 1735689600,
  "asset": "USDC"
}
```

**Response (201):**

```json
{
  "invoice_id": "a3f8c1d27e904b6a8d5f0139c2e7ab64f0d8c3b19a6e52f7b4c0d91e8a2735bc",
  "transaction_hash": "abc123...",
  "status": "SUCCESS"
}
```

## GET /events

Returns the most recent indexed Soroban events. No JWT required.

**Query parameters:**

- `limit` — number of events to return (default: 20)

**Response:**

```json
[
  {
    "id": 1,
    "event_id": "abc123...",
    "contract_id": "CABC...",
    "ledger": 12345,
    "ledger_closed_at": 1748000000,
    "event_type": "invoice_created",
    "data": {}
  }
]
```

## GET /pool/snapshots

Returns historical pool snapshots used for charts and trend analysis. No JWT required.

**Response:**

```json
[
  {
    "timestamp": 1748000000,
    "utilizationRateBps": 7500,
    "totalYieldDistributed": "15000000000000"
  }
]
```
