- closes #813
- closes #812
- closes #811
- closes #810

### Issue #813: backfill CLI
- Extracted core event fetching logic from `pollEvents` into a new `FetchAndProcessRange` method in `indexer/listener/soroban.go`. This method can accept bounded `startLedger` and `endLedger` arguments for backfilling.
- Created `indexer/cmd/backfill/main.go` to provide a standalone CLI that accepts `--from-ledger`, `--to-ledger` and `--update-checkpoint` flags.
- Re-used `isEventProcessedFn` logic to ensure idempotent re-processing.
- Progress is logged periodically while fetching in chunks.
- Added tests in `soroban_test.go` to verify the backfill range logic and breaking condition.

### Issue #812: generic TTL cache
- Created a generic thread-safe `TTLCache[T]` in `indexer/api/cache.go` to handle lock/double-check pattern caching.
- Used the cache in `HandleGetPoolStats` and `HandleGetEvents` (for default/no filter limits) in `handlers_stats.go`.
- Set TTL to a documented constant `DefaultCacheTTL` (30 seconds).
- Per-address lookups in `/events` and `/pool/position/{address}` bypass the cache to prevent unbounded cardinality cache blowups. 
- Added unit tests mimicking DB calls for caching behaviors in `handlers_readonly_test.go`.

### Issue #811: indexer ledger lag
- Added `lastProcessedLedger` and `lastKnownChainTip` to `ListenerHealth` in `indexer/api/health.go` and surfaced them using `GetLedgerLag()` which computes the difference in ledgers.
- Exposed the numeric `ledgerLag` in the JSON response of `/health` in `indexer/api/router.go`.
- Created a Prometheus gauge `trusttrove_indexer_ledger_lag` that receives the value upon every ledger update.
- Updated the listener in `soroban.go` to correctly update the ledgers on `health`.
- Added unit tests to `health_test.go` and `router_test.go` to check health lag values.

### Issue #810: Prometheus metrics
- Introduced a `MetricsMiddleware` in `indexer/api/router.go` to measure HTTP request count (`trusttrove_indexer_http_requests_total`) and duration (`trusttrove_indexer_http_request_duration_seconds`) labeled by `route` and `status`.
- Registered counters in `indexer/listener/soroban.go`: `trusttrove_indexer_poll_iterations_total`, `trusttrove_indexer_events_processed_total`, `trusttrove_indexer_rpc_failures_total`. 
- Added a gauge `trusttrove_indexer_current_ledger` updated on every poll iteration.
- Registered `/metrics` using `promhttp.Handler()` directly in the router.
- Added test verifying the metrics endpoint and variables exposed on `/metrics`.
