# Webhook Operations Runbook

This runbook is for the team operating a TrusTrove webhook receiver. It covers
subscription setup, signature verification, retries, dead letters, and secret
rotation. The payload schema, event catalogue, and queue internals are documented
in [Webhooks](../webhooks.md); this page is the operational checklist.

This runbook documents the existing `/webhooks` API, delivery worker, and
`/metrics` counters. It adds no new public endpoint; dead-letter requeueing is an
operator-only database procedure.

## Prerequisites

| Item              | Detail                                                    |
| ----------------- | --------------------------------------------------------- |
| Receiver URL      | Public `https://` endpoint that accepts `POST`            |
| JWT               | A TrusTrove API token for the subscribing Stellar address |
| Secret store      | A secret manager or environment variable, never Git       |
| Clock             | NTP-synchronised; signatures tolerate only ±5 minutes     |
| Idempotency store | Persist `event_id` values you have already processed      |

Get a JWT with the SEP-10 flow: request a challenge from
`GET /auth?address=<stellar_address>`, sign the returned transaction, then
exchange it at `POST /auth` for `{ "token": "..." }`. Send the token as
`Authorization: Bearer <jwt>`. See the
[Indexer API Reference](../developer-guide/indexer-api-reference.md#get-auth)
for the request and response shapes.

## Create a subscription

```bash
curl -sS -X POST "$API_BASE_URL/webhooks" \
  -H "Authorization: Bearer $TRUSTROVE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ops.example.com/hooks/trustrove",
    "event_types": ["invoice.repaid", "invoice.defaulted"]
  }' | jq
```

A successful `201` response looks like this:

```json
{
  "id": "8f14e45f-ea2b-4c1e-9d6f-2f4a7c1b9e30",
  "user_address": "GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW",
  "url": "https://ops.example.com/hooks/trustrove",
  "secret": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "event_types": ["invoice.repaid", "invoice.defaulted"],
  "created_at": "2026-11-24T10:00:00Z"
}
```

> **The `secret` is returned only in this response.** `GET /webhooks` lists your
> subscriptions without it. Store it before closing the terminal.

Supported event types are `invoice.created`, `invoice.listed`, `invoice.funded`,
`invoice.shipped`, `invoice.confirmed`, `invoice.repaid`, `invoice.defaulted`,
`pool.deposit`, `pool.withdrawal`, and `pool.yield_distributed`.

### Create-response boundary cases

| Case                                                            | Result                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| No or expired JWT                                               | `401 unauthorized`                                     |
| Missing `url` or empty `event_types`                            | `400 url is required` or `400 event_types is required` |
| `http://` to a private, loopback, link-local, or multicast host | `400 invalid or unsafe url`                            |
| Unsupported or misspelled event name                            | `201`, but no delivery will ever match it              |
| Valid request                                                   | `201` with the one-time secret                         |

The last row is the dangerous one: subscription creation does **not** validate
`event_types` against the supported list. A typo produces a healthy-looking
subscription that never fires. Copy the names from the list above rather than
typing them.

## Verify a delivery

Every attempt is a `POST` with these headers:

```
Content-Type: application/json
X-TrusTrove-Timestamp: 1791000000
X-TrusTrove-Signature: sha256=4fc89805f9d4f406022da03d3fe26666abe271d9abcfdbbd3ffc98c62fbf47c9
```

The signature is:

```
sha256=hex(HMAC_SHA256(secret, timestamp + "." + raw_request_body))
```

This is a complete sample request. It was generated with the subscription secret
above and the exact body below (one line, no trailing newline). The `text` fence
preserves the signed bytes; a formatter that re-indents JSON would change the
signature:

```text
{"schema_version":"1.0","event_type":"invoice.repaid","event_id":"0021255638529081344-0000000001","occurred_at":"2026-10-03T04:00:00Z","ledger":4948964,"contract_id":"CA4O3MR7LWHRSUDBNU6FY6UDFFYBN7TGBZXBDZB4OYYXFYXIFJ6RJF6B","data":{"invoice_id":"9c4e1f0a7b3d52e8c6a1f4b09d7e3a5c2f8b6d0e4a19c7f3b5d2e8a6c0f4b1d9","issuer":"GCV5ODH3SMUDETURTOQPQ7TD2YI4YS6DZMMXDFLSWLGBFZTCHYL6LDNW","buyer":"GDSCOJVNZ4JUVWZ5O6VBTUGOH4ZE22QJ6WMOYWHB3FEDQ2APJ2RQEIHY","face_value":"1000000000","discount_bps":250,"funded_amount":"975000000","due_date":1798675200,"status":"Repaid","created_at":1790763125,"funded_at":1790764000,"shipped_at":1790800000,"buyer_confirmed_at":1790900000,"repaid_at":1791000000}}
```

The sample timestamp is fixed for reproducibility. A real delivery uses the Unix
time in seconds at the moment of the attempt, and every retry is signed again
with a fresh timestamp.

To verify a live request:

1. Read the **raw request body bytes** before JSON parsing. If your framework
   re-serialises the body, the signature will not match. In Express use
   `express.raw()`; in Go use `io.ReadAll(r.Body)` once.
2. Reject the request when `X-TrusTrove-Timestamp` is more than 300 seconds away
   from your clock, in either direction.
3. Recompute the expected signature and compare it with `crypto.timingSafeEqual`
   or `hmac.Equal`. Do not use `===` on attacker-controlled strings.
4. Only after verification, parse the JSON and enqueue the event.

The reference Node and Go verifiers, including the 5-minute window, are in
[Webhooks § Verifying signatures](../webhooks.md#verifying-signatures). If the
receiver is behind a proxy that changes the body (for example, a JSON
pretty-printer), verify at the first hop or disable the transformation.

### Idempotency and ordering

TrusTrove does **not** send an `Idempotency-Key` header. The idempotency key is
the envelope's `event_id` (the Soroban event ID, for example
`0021255638529081344-0000000001`).

- Delivery is at-least-once. Store `event_id` before acknowledging, and ignore a
  repeat with the same `event_id`.
- Deliveries are not ordered. Use `ledger` / `occurred_at`, or the invoice's
  lifecycle timestamps, to decide which event is newer.
- If your API gateway requires an `Idempotency-Key`, set it from `event_id` at
  your ingress. That header is internal to your system; TrusTrove does not send
  it.
- A subscription's queue row is unique per `event_id`, but the same row can be
  sent more than once after a slow response, a worker restart, or a rolling
  deploy. Treat duplicate HTTP requests as normal.

## Retries and dead letters

A delivery gets **5 attempts** in total: the initial attempt plus four retries.

| Attempt | Scheduled after the previous failure                |
| ------- | --------------------------------------------------- |
| 1       | Next worker poll after the event is indexed         |
| 2       | 20 seconds                                          |
| 3       | 40 seconds                                          |
| 4       | 80 seconds                                          |
| 5       | 160 seconds                                         |
| —       | After attempt 5 fails, status becomes `dead_letter` |

The worker polls every 5 seconds, so a retry can start up to 5 seconds after the
time shown. Each attempt has a 10-second timeout covering connect, send,
response headers, and response body. Any `2xx` is success; every other status or
network error is a failure. Redirects are followed until the request chain
reaches 10 requests (at most 9 redirects); every hop is re-checked against the
public-address guard.

Because the final failure marks the row `dead_letter` without incrementing the
counter, a worker-dead-lettered row normally shows `attempts = 4` even though it
received five requests. Use `created_at`, `updated_at`, and the receiver's own
logs to reconstruct the full timeline.

Delivery state is in `webhook_deliveries`:

| Column            | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `status`          | `pending`, `delivered`, or `dead_letter`                           |
| `attempts`        | Attempts recorded so far; incremented after each completed attempt |
| `max_attempts`    | Default `5`                                                        |
| `next_attempt_at` | When the row becomes claimable                                     |
| `last_status`     | HTTP status of the last attempt                                    |
| `last_error`      | Error text such as `non-2xx response: 500`                         |
| `last_response`   | First 4096 bytes of a successful response                          |
| `payload`         | The exact signed envelope                                          |

Find recent dead letters:

```sql
SELECT id, subscription_id, event_type, event_id, attempts, max_attempts,
       last_status, last_error, created_at
FROM webhook_deliveries
WHERE status = 'dead_letter'
ORDER BY created_at DESC
LIMIT 50;
```

There is **no public redelivery endpoint**. Fix the receiver first, then choose
one of these operator-only recovery paths:

1. **Requeue the stored row.** With database access:

   ```sql
   UPDATE webhook_deliveries
   SET status = 'pending', attempts = 0,
       next_attempt_at = CURRENT_TIMESTAMP, locked_until = NULL
   WHERE id = $1 AND status = 'dead_letter';
   ```

   The worker will claim it on the next poll and sign it with the subscription's
   current secret. This consumes the retry budget again and can produce a
   duplicate, so de-duplicate on `event_id`.

2. **Replay manually.** Read `payload` and the subscription's secret, then send
   the stored body with a **fresh** `X-TrusTrove-Timestamp` and a new signature.
   Never reuse an old signature: after 5 minutes it is rejected. Do not log the
   secret while doing this.

If the subscription itself was deleted, its delivery rows are removed by the
`ON DELETE CASCADE`, so there is nothing to requeue. If it was only deactivated
(`active = false`), the worker will not claim the row; re-activate the
subscription in the database or create a new one and wait for new events.

Metric counters on `GET /metrics`:

- `trustrove_webhook_deliveries_total{outcome="delivered"}`
- `trustrove_webhook_deliveries_total{outcome="retried"}`
- `trustrove_webhook_deliveries_total{outcome="dead_lettered"}`

Alert on a rising `dead_lettered` rate, a sustained `retried` rate, or a cluster
of `last_status = 401` / `403` (usually a secret mismatch) or `5xx` (receiver
failure).

## Rotate a secret

There is no rotate endpoint. The secret is set when the subscription is created
and is not returned again.

Zero-downtime rotation:

1. Create a second subscription to the same URL with the same `event_types`.
2. Store the new secret and deploy the receiver so it accepts both the old and
   new secrets.
3. Verify new deliveries with the new secret.
4. Delete the old subscription:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' \
     -X DELETE "$API_BASE_URL/webhooks/$OLD_SUBSCRIPTION_ID" \
     -H "Authorization: Bearer $TRUSTROVE_JWT"
   ```

   A successful delete returns `204`; a subscription that does not belong to
   your address returns `404`.

During the overlap both subscriptions receive the same events, so the receiver
must de-duplicate on `event_id`. If a zero-downtime cutover is not required,
delete the old subscription first and create the new one; there is a short gap
where events are not delivered.

Rotate immediately if the secret appears in a log, CI variable, browser bundle,
or support ticket. The signing secret is independent of the JWT: rotating one
does not rotate the other.

## Permission and empty-state checks

- `GET /webhooks` with no subscriptions returns `200 {"data":[]}`. That is an
  empty state, not an error.
- All `/webhooks` routes require a JWT. Without one, expect `401 unauthorized`.
- A user can only list and delete their own subscriptions. Deleting another
  user's subscription ID returns `404`, not `403`.
- Delivery rows are created only for active subscriptions that exist when the
  event is indexed. Creating a subscription after an event does not replay that
  event.
- The target URL is checked when the subscription is created **and again on
  every delivery and redirect**. A hostname that later resolves to a private
  address is refused at delivery time.
- `http://` is accepted but sends the payload and signature over plaintext. Use
  `https://` for anything beyond local testing.

## Closing checklist

- [ ] Receiver verifies the raw body, timestamp window, and HMAC in constant time.
- [ ] `event_id` is persisted before the `2xx` response and duplicates are ignored.
- [ ] Secret is in a secret manager, not in source control or logs.
- [ ] Subscription `event_types` are copied from the supported list.
- [ ] Alerts cover `dead_lettered`, `retried`, `401`/`403`, and `5xx`.
- [ ] Rotation procedure has been rehearsed with two overlapping subscriptions.
- [ ] Dead-letter query and replay/requeue procedure are documented for on-call.
