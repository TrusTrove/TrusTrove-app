package db

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

// The tests below cover the atomic claiming added for issue #933: two workers
// (or two replicas of the indexer) must never hand the same delivery row to two
// goroutines, because both would then POST the same event.

// newClaimTestSubscription creates an active subscription with a unique event
// type, so it only ever receives the deliveries this test queues.
func newClaimTestSubscription(t *testing.T, ctx context.Context, tag string) *WebhookSubscription {
	t.Helper()

	sub := &WebhookSubscription{
		TargetURL:     fmt.Sprintf("https://example.invalid/hook-%s", tag),
		EventTypes:    []string{fmt.Sprintf("invoice.%s", tag)},
		SigningSecret: "synthetic-secret",
		Active:        true,
	}
	if err := CreateWebhookSubscription(ctx, sub); err != nil {
		t.Fatalf("CreateWebhookSubscription: %v", err)
	}
	t.Cleanup(func() {
		if Pool != nil {
			Pool.Exec(ctx, "DELETE FROM webhook_deliveries WHERE subscription_id = $1", sub.ID)
			Pool.Exec(ctx, "DELETE FROM webhook_subscriptions WHERE id = $1", sub.ID)
		}
	})
	return sub
}

// queueClaimTestDeliveries inserts count pending rows for sub and returns their
// database ids in insertion order.
func queueClaimTestDeliveries(t *testing.T, ctx context.Context, sub *WebhookSubscription, tag string, count int) []int64 {
	t.Helper()

	ids := make([]int64, 0, count)
	for i := 0; i < count; i++ {
		eventID := fmt.Sprintf("%s-evt-%d-%d", tag, i, time.Now().UnixNano())
		payload := json.RawMessage(fmt.Sprintf(`{"n":%d}`, i))
		if err := CreateWebhookDelivery(ctx, sub.ID, sub.EventTypes[0], eventID, payload); err != nil {
			t.Fatalf("CreateWebhookDelivery: %v", err)
		}
		var id int64
		if err := Pool.QueryRow(ctx,
			"SELECT id FROM webhook_deliveries WHERE subscription_id = $1 AND event_id = $2", sub.ID, eventID,
		).Scan(&id); err != nil {
			t.Fatalf("look up queued delivery id: %v", err)
		}
		ids = append(ids, id)
	}
	return ids
}

// filterMine keeps only the deliveries belonging to sub, so rows queued by
// other tests in a shared database cannot skew the counts.
func filterMine(deliveries []*WebhookDelivery, subID uuid.UUID) []*WebhookDelivery {
	var out []*WebhookDelivery
	for _, d := range deliveries {
		if d.SubscriptionID == subID {
			out = append(out, d)
		}
	}
	return out
}

func deliveryIDs(deliveries []*WebhookDelivery) []int64 {
	ids := make([]int64, 0, len(deliveries))
	for _, d := range deliveries {
		ids = append(ids, d.ID)
	}
	return ids
}

// lockWindowSeconds measures how far in the future locked_until sits according
// to the database clock. Comparing inside Postgres keeps the assertion
// independent of the Go process timezone, which locked_until (a TIMESTAMP
// without time zone) is otherwise sensitive to.
func lockWindowSeconds(t *testing.T, ctx context.Context, deliveryID int64) float64 {
	t.Helper()
	var secs float64
	if err := Pool.QueryRow(ctx, `
		SELECT EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP))::float8
		FROM webhook_deliveries WHERE id = $1`, deliveryID,
	).Scan(&secs); err != nil {
		t.Fatalf("measure lock window: %v", err)
	}
	return secs
}

// TestGetPendingDeliveriesClaimsRows is the read-path half of #933: the plain
// SELECT became a claim, so returned rows carry locked_until, keep the
// denormalized endpoint fields, and are hidden from the next claim.
func TestGetPendingDeliveriesClaimsRows(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	sub := newClaimTestSubscription(t, ctx, "claims")
	queued := queueClaimTestDeliveries(t, ctx, sub, "claims", 3)

	claimed, err := GetPendingDeliveries(ctx, 50)
	if err != nil {
		t.Fatalf("GetPendingDeliveries: %v", err)
	}
	mine := filterMine(claimed, sub.ID)
	if len(mine) != len(queued) {
		t.Fatalf("claimed %d of this test's rows (%v), want all %d", len(mine), deliveryIDs(mine), len(queued))
	}

	for _, d := range mine {
		if d.LockedUntil == nil {
			t.Errorf("delivery %d came back unclaimed (locked_until NULL)", d.ID)
			continue
		}
		if d.EndpointURL != sub.TargetURL {
			t.Errorf("delivery %d EndpointURL: got %q, want %q", d.ID, d.EndpointURL, sub.TargetURL)
		}
		if d.EndpointSecret != sub.SigningSecret {
			t.Errorf("delivery %d lost its signing secret through the CTE", d.ID)
		}
	}

	// The claim outlives the statement, so none of these rows is offered again.
	again, err := GetPendingDeliveries(ctx, 50)
	if err != nil {
		t.Fatalf("second GetPendingDeliveries: %v", err)
	}
	if relocked := filterMine(again, sub.ID); len(relocked) != 0 {
		t.Errorf("rows re-claimed before their lock expired: %v", deliveryIDs(relocked))
	}
	if n := unclaimedCount(t, ctx, sub.ID); n != 0 {
		t.Errorf("%d rows still report themselves claimable after the batch was claimed", n)
	}
}

// unclaimedCount reports how many of sub's rows are still free, i.e. pending
// with no live lock.
func unclaimedCount(t *testing.T, ctx context.Context, subID uuid.UUID) int {
	t.Helper()
	var n int
	if err := Pool.QueryRow(ctx, `
		SELECT count(*) FROM webhook_deliveries
		WHERE subscription_id = $1 AND status = 'pending'
		  AND next_attempt_at <= CURRENT_TIMESTAMP
		  AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)`, subID,
	).Scan(&n); err != nil {
		t.Fatalf("count unclaimed: %v", err)
	}
	return n
}

// TestClaimPendingDeliveriesHonoursLimit: a batch claim leaves the rest of the
// queue untouched rather than locking everything the worker could not attempt.
func TestClaimPendingDeliveriesHonoursLimit(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	sub := newClaimTestSubscription(t, ctx, "limit")
	queueClaimTestDeliveries(t, ctx, sub, "limit", 3)

	claimed, err := ClaimPendingDeliveries(ctx, 2, time.Minute)
	if err != nil {
		t.Fatalf("ClaimPendingDeliveries: %v", err)
	}
	mine := filterMine(claimed, sub.ID)
	if len(mine) != 2 {
		t.Fatalf("claimed %d of this test's rows, want exactly 2 (the limit)", len(mine))
	}
	if n := unclaimedCount(t, ctx, sub.ID); n != 1 {
		t.Errorf("unclaimed rows for this subscription: got %d, want 1", n)
	}
}

// TestConcurrentGetPendingDeliveriesNeverOverlap is the acceptance criterion for
// #933: two concurrent GetPendingDeliveries calls never return the same
// delivery id.
func TestConcurrentGetPendingDeliveriesNeverOverlap(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	sub := newClaimTestSubscription(t, ctx, "conc")
	const total = 10
	queued := queueClaimTestDeliveries(t, ctx, sub, "conc", total)

	const claimers = 2
	results := make([][]int64, claimers)
	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		errs []error
	)
	start := make(chan struct{})

	for i := 0; i < claimers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start // release both claims at once
			got, err := GetPendingDeliveries(ctx, total/claimers)
			if err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
				return
			}
			results[i] = deliveryIDs(filterMine(got, sub.ID))
		}(i)
	}
	close(start)
	wg.Wait()

	if len(errs) > 0 {
		for _, err := range errs {
			t.Errorf("concurrent claim failed: %v", err)
		}
		t.FailNow()
	}

	seen := map[int64]int{}
	for i, ids := range results {
		t.Logf("claimer %d took %v", i, ids)
		for _, id := range ids {
			seen[id]++
		}
	}
	for _, id := range queued {
		if seen[id] != 1 {
			t.Errorf("delivery %d was returned %d times by concurrent GetPendingDeliveries calls, want exactly 1", id, seen[id])
		}
	}
	if len(seen) != total {
		t.Errorf("concurrent claims covered %d of %d rows, want all %d (results: %v, %v)", len(seen), total, total, results[0], results[1])
	}

	// A third claim now sees the whole batch locked.
	later, err := GetPendingDeliveries(ctx, total)
	if err != nil {
		t.Fatalf("third GetPendingDeliveries: %v", err)
	}
	if stillLocked := filterMine(later, sub.ID); len(stillLocked) != 0 {
		t.Errorf("rows claimed again before their lock expired: %v", deliveryIDs(stillLocked))
	}
}

// TestClaimPendingDeliveriesReclaimsExpiredLock covers the crash path: a worker
// that dies mid-attempt must not strand the row forever, otherwise the queue
// would be at-most-once and silently drop events.
func TestClaimPendingDeliveriesReclaimsExpiredLock(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	sub := newClaimTestSubscription(t, ctx, "expiry")
	queued := queueClaimTestDeliveries(t, ctx, sub, "expiry", 1)

	first, err := ClaimPendingDeliveries(ctx, 50, time.Minute)
	if err != nil {
		t.Fatalf("ClaimPendingDeliveries: %v", err)
	}
	claimed := filterMine(first, sub.ID)
	if len(claimed) != 1 || claimed[0].ID != queued[0] {
		t.Fatalf("first claim: got %v, want delivery %d", deliveryIDs(claimed), queued[0])
	}

	// Force the lock into the past, the way a dead worker's lock ages out.
	if _, err := Pool.Exec(ctx,
		"UPDATE webhook_deliveries SET locked_until = CURRENT_TIMESTAMP - interval '5 seconds' WHERE id = $1",
		queued[0],
	); err != nil {
		t.Fatalf("expire lock: %v", err)
	}

	again, err := ClaimPendingDeliveries(ctx, 50, time.Minute)
	if err != nil {
		t.Fatalf("ClaimPendingDeliveries after expiry: %v", err)
	}
	reclaimed := filterMine(again, sub.ID)
	if len(reclaimed) != 1 || reclaimed[0].ID != queued[0] {
		t.Fatalf("after lock expiry: got %v, want delivery %d again", deliveryIDs(reclaimed), queued[0])
	}
	if reclaimed[0].Attempts != 0 {
		t.Errorf("Attempts: got %d, want 0 (claiming is not an attempt)", reclaimed[0].Attempts)
	}
}

// TestClaimPendingDeliveriesLockDuration checks the configurable TTL and the
// fallback used when a caller passes a non-positive duration.
func TestClaimPendingDeliveriesLockDuration(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	cases := []struct {
		name             string
		lockFor          time.Duration
		wantMin, wantMax float64
	}{
		{"custom two hour lock", 2 * time.Hour, 7190, 7210},
		{"zero falls back to the default", 0, DefaultClaimLockTTL.Seconds() - 10, DefaultClaimLockTTL.Seconds() + 10},
		{"negative falls back to the default", -time.Minute, DefaultClaimLockTTL.Seconds() - 10, DefaultClaimLockTTL.Seconds() + 10},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sub := newClaimTestSubscription(t, ctx, "ttl")
			queued := queueClaimTestDeliveries(t, ctx, sub, "ttl", 1)

			claimed, err := ClaimPendingDeliveries(ctx, 1, tc.lockFor)
			if err != nil {
				t.Fatalf("ClaimPendingDeliveries: %v", err)
			}
			mine := filterMine(claimed, sub.ID)
			if len(mine) != 1 {
				t.Fatalf("claimed %d rows, want 1", len(mine))
			}
			if mine[0].LockedUntil == nil {
				t.Fatal("locked_until not written")
			}

			ahead := lockWindowSeconds(t, ctx, queued[0])
			if ahead < tc.wantMin || ahead > tc.wantMax {
				t.Errorf("lock held for %.1fs, want within [%.1f, %.1f]", ahead, tc.wantMin, tc.wantMax)
			}
			// A two-hour claim must also stay invisible to the next claim.
			if n := unclaimedCount(t, ctx, sub.ID); n != 0 {
				t.Errorf("%d rows still claimable right after a long claim", n)
			}
		})
	}
}

// TestClaimPendingDeliveriesRejectsBadLimit: limit<=0 would generate `LIMIT 0`
// (silently claiming nothing) or, with no LIMIT clause at all, lock the whole
// queue. It is rejected before touching the pool, so this needs no database.
func TestClaimPendingDeliveriesRejectsBadLimit(t *testing.T) {
	ctx := context.Background()
	for _, limit := range []int{0, -1} {
		_, err := ClaimPendingDeliveries(ctx, limit, time.Minute)
		if err == nil {
			t.Fatalf("ClaimPendingDeliveries(limit=%d): expected an error, got nil", limit)
		}
		if want := fmt.Sprintf("limit must be positive, got %d", limit); !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not explain the limit (%q)", err, want)
		}
	}
}

// TestMarkDeliveryHelpersReleaseClaim: the claim must end when an outcome is
// recorded. Otherwise a retried delivery would wait out the lock TTL on top of
// its own backoff, and a successful one would keep holding a row it no longer
// owns.
func TestMarkDeliveryHelpersReleaseClaim(t *testing.T) {
	skipIfNoDB(t)
	ctx := context.Background()

	cases := []struct {
		name     string
		mark     func(ctx context.Context, id int64) error
		wantStat string
	}{
		{
			name:     "success",
			mark:     func(ctx context.Context, id int64) error { return MarkDeliverySuccess(ctx, id, 200, "OK") },
			wantStat: "delivered",
		},
		{
			name: "retry",
			mark: func(ctx context.Context, id int64) error {
				code := 500
				return MarkDeliveryRetry(ctx, id, time.Now().Add(time.Hour), &code, "boom")
			},
			wantStat: "pending",
		},
		{
			name:     "dead letter",
			mark:     func(ctx context.Context, id int64) error { return MarkDeliveryDeadLetter(ctx, id, "exhausted") },
			wantStat: "dead_letter",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sub := newClaimTestSubscription(t, ctx, "release")
			queued := queueClaimTestDeliveries(t, ctx, sub, "release", 1)

			claimed, err := GetPendingDeliveries(ctx, 50)
			if err != nil {
				t.Fatalf("GetPendingDeliveries: %v", err)
			}
			mine := filterMine(claimed, sub.ID)
			if len(mine) != 1 || mine[0].ID != queued[0] {
				t.Fatalf("expected to claim delivery %d, got %v", queued[0], deliveryIDs(mine))
			}
			if err := tc.mark(ctx, mine[0].ID); err != nil {
				t.Fatalf("mark: %v", err)
			}

			var (
				locked    *time.Time
				gotStatus string
			)
			if err := Pool.QueryRow(ctx,
				"SELECT locked_until, status FROM webhook_deliveries WHERE id = $1", mine[0].ID,
			).Scan(&locked, &gotStatus); err != nil {
				t.Fatalf("read back row: %v", err)
			}
			if locked != nil {
				t.Errorf("locked_until still set to %v after %s", *locked, tc.name)
			}
			if gotStatus != tc.wantStat {
				t.Errorf("status: got %q, want %q", gotStatus, tc.wantStat)
			}
		})
	}
}

// TestClaimPendingDeliveriesWrapsContextError keeps cancellation observable to
// the worker's retry loop instead of surfacing as an empty batch.
func TestClaimPendingDeliveriesWrapsContextError(t *testing.T) {
	skipIfNoDB(t)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := ClaimPendingDeliveries(ctx, 10, time.Minute)
	if err == nil {
		t.Fatal("expected an error from a cancelled context")
	}
	if !strings.Contains(err.Error(), "claim pending deliveries") {
		t.Errorf("error %q lost the db: claim pending deliveries prefix", err)
	}
}
