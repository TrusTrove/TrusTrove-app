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
