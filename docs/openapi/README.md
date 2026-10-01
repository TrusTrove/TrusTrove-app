# TrusTrove Indexer API Documentation

The OpenAPI 3.0 specification for the Go indexer/API lives in [`indexer.yaml`](./indexer.yaml).

It documents:

- `GET /health`
- SEP-10 authentication flow through `GET /auth` and `POST /auth`
- invoice listing, creation, and lookup endpoints
- protocol stats
- event listing
- pool stats and LP position lookup

Use any OpenAPI-compatible viewer, such as Swagger UI, Redoc, or Stoplight, to preview the API contract locally.
