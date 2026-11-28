package webhooks

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

// TestRunbookSignatureSample proves the sample request published in
// docs/developer-guide/webhook-operations-runbook.md is internally consistent:
// the stated secret and timestamp produce the stated signature, and the
// receiver verifier accepts it only inside the documented 5-minute window.
func TestRunbookSignatureSample(t *testing.T) {
	path := filepath.Join("..", "..", "docs", "developer-guide", "webhook-operations-runbook.md")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read runbook: %v", err)
	}
	doc := string(raw)

	secret := firstMatch(t, doc, `"secret": "([0-9a-f]{64})"`, "subscription secret")
	timestamp := firstMatch(t, doc, `X-TrusTrove-Timestamp: ([0-9]+)`, "sample timestamp")
	signature := firstMatch(t, doc, `X-TrusTrove-Signature: (sha256=[0-9a-f]{64})`, "sample signature")
	body := blockAfter(t, doc, "This is a complete sample request.", "```text\n", "\n```")

	if got, want := "sha256="+sign(secret, timestamp, []byte(body)), signature; got != want {
		t.Fatalf("documented signature does not match the sample body:\n got %s\nwant %s", got, want)
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		t.Fatalf("sample timestamp %q is not an integer: %v", timestamp, err)
	}
	sentAt := time.Unix(ts, 0)

	// The envelope's occurred_at is the repayment ledger's close time, so the
	// sample should at least be internally coherent: a receiver must not see an
	// invoice.repaid event dated before its own lifecycle timestamps.
	var envelope struct {
		EventType  string `json:"event_type"`
		OccurredAt string `json:"occurred_at"`
		Data       struct {
			RepaidAt int64 `json:"repaid_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(body), &envelope); err != nil {
		t.Fatalf("sample body is not valid JSON: %v", err)
	}
	if envelope.EventType != "invoice.repaid" {
		t.Errorf("sample event_type: got %q, want invoice.repaid", envelope.EventType)
	}
	if got, want := envelope.OccurredAt, sentAt.UTC().Format(time.RFC3339); got != want {
		t.Errorf("sample occurred_at: got %q, want the signed timestamp %q", got, want)
	}
	if envelope.Data.RepaidAt != ts {
		t.Errorf("sample repaid_at: got %d, want the signed timestamp %d", envelope.Data.RepaidAt, ts)
	}
	if !verifyTrusTroveSignature(secret, []byte(body), timestamp, signature, sentAt) {
		t.Error("sample signature should verify at its own timestamp")
	}
	if !verifyTrusTroveSignature(secret, []byte(body), timestamp, signature, sentAt.Add(5*time.Minute)) {
		t.Error("sample signature should verify exactly 5 minutes later")
	}
	if verifyTrusTroveSignature(secret, []byte(body), timestamp, signature, sentAt.Add(5*time.Minute+time.Second)) {
		t.Error("sample signature should be rejected more than 5 minutes later")
	}
	if verifyTrusTroveSignature(secret, []byte(body), timestamp, signature, sentAt.Add(-5*time.Minute-time.Second)) {
		t.Error("sample signature should be rejected when it is more than 5 minutes in the future")
	}
	if verifyTrusTroveSignature(secret, []byte(body+" "), timestamp, signature, sentAt) {
		t.Error("sample signature should be rejected after the body changes")
	}
}

// TestRunbookRetryScheduleMatchesWorker keeps the operator-facing retry table
// tied to the worker defaults rather than copied prose.
func TestRunbookRetryScheduleMatchesWorker(t *testing.T) {
	path := filepath.Join("..", "..", "docs", "developer-guide", "webhook-operations-runbook.md")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read runbook: %v", err)
	}
	doc := string(raw)

	cfg := DefaultWorkerConfig()
	if cfg.MaxAttempts != 5 {
		t.Fatalf("MaxAttempts: got %d, want 5", cfg.MaxAttempts)
	}
	if cfg.PollInterval != 5*time.Second {
		t.Errorf("PollInterval: got %s, want 5s", cfg.PollInterval)
	}
	if cfg.HTTPTimeout != 10*time.Second {
		t.Errorf("HTTPTimeout: got %s, want 10s", cfg.HTTPTimeout)
	}

	requireDocContains(t, doc,
		"5 attempts",
		"20 seconds",
		"40 seconds",
		"80 seconds",
		"160 seconds",
		"5 seconds",
		"10-second timeout",
	)

	for nextAttempt := 1; nextAttempt <= 4; nextAttempt++ {
		delay := backoffBase * (1 << uint(nextAttempt))
		if got, want := delay, []time.Duration{20 * time.Second, 40 * time.Second, 80 * time.Second, 160 * time.Second}[nextAttempt-1]; got != want {
			t.Errorf("retry delay after attempt %d: got %s, want %s", nextAttempt, got, want)
		}
	}
}

// TestRunbookOperatorChecklist covers the non-numeric promises the runbook
// makes: a stable idempotency key, a timestamp window, and secrets that never
// leave the secret manager.
func TestRunbookOperatorChecklist(t *testing.T) {
	path := filepath.Join("..", "..", "docs", "developer-guide", "webhook-operations-runbook.md")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read runbook: %v", err)
	}
	doc := string(raw)

	requireDocContains(t, doc,
		"does **not** send an `Idempotency-Key` header",
		"`event_id`",
		"±5 minutes",
		"300 seconds",
		"secret manager",
		"never Git",
		"Do not log the",
		"dead_letter",
		"GET /webhooks",
		`POST "$API_BASE_URL/webhooks"`,
		`DELETE "$API_BASE_URL/webhooks/$OLD_SUBSCRIPTION_ID"`,
	)

	// The runbook must also cover the empty and permission boundaries, not just
	// the happy path: no subscriptions, a missing JWT, and another user's row.
	requireDocContains(t, doc,
		"## Permission and empty-state checks",
		"`200 {\"data\":[]}`",
		"`401 unauthorized`",
		"`404`, not `403`",
	)
}

func firstMatch(t *testing.T, doc, pattern, label string) string {
	t.Helper()
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(doc)
	if len(match) < 2 {
		t.Fatalf("could not find %s in runbook", label)
	}
	return match[1]
}

func blockAfter(t *testing.T, doc, marker, open, close string) string {
	t.Helper()
	idx := strings.Index(doc, marker)
	if idx < 0 {
		t.Fatalf("marker %q not found in runbook", marker)
	}
	rest := doc[idx:]
	start := strings.Index(rest, open)
	if start < 0 {
		t.Fatalf("opening %q after %q not found", open, marker)
	}
	rest = rest[start+len(open):]
	end := strings.Index(rest, close)
	if end < 0 {
		t.Fatalf("closing %q after %q not found", close, marker)
	}
	return rest[:end]
}

func requireDocContains(t *testing.T, doc string, values ...string) {
	t.Helper()
	for _, value := range values {
		if !strings.Contains(doc, value) {
			t.Errorf("runbook is missing %q", value)
		}
	}
}
