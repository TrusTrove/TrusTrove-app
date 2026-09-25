- closes #810
- closes #811
- closes #812
- closes #813

- Instrumented HTTP handlers and event listener with Prometheus metrics
- Exposed indexer ledger lag in /health and /metrics
- Extended TTL response cache to /events and /pool/stats endpoints
- Added backfill CLI for re-indexing a historical ledger range
