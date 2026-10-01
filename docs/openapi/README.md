# TrusTrove Indexer API Documentation

The OpenAPI 3.0 specification for the Go indexer/API lives in [`indexer.yaml`](./indexer.yaml).

It documents:

- `GET /metrics` — Prometheus metrics (text/plain)
- `GET /health` — health check (`200 ok` / `503 degraded`)
- SEP-10 authentication flow through `GET /auth` and `POST /auth`
- invoice listing, creation, and lookup (`GET /invoices`, `GET /invoices/{id}`, `POST /invoices`)
- protocol stats (`GET /stats`)
- event listing (`GET /events`)
- pool stats, snapshots, and LP position lookup (`GET /pool/stats`, `GET /pool/snapshots`, `GET /pool/position/{address}`)
- webhook subscription management (`POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/{id}`)

Rate-limited endpoints may return `429 Too Many Requests` with a `Retry-After` header. Most error bodies are plain text; see the `Error` schema description in `indexer.yaml` for details.

Use any OpenAPI-compatible viewer, such as Swagger UI, Redoc, or Stoplight, to preview the API contract locally.

## Linting

```bash
npx @redocly/cli lint docs/openapi/indexer.yaml
```
