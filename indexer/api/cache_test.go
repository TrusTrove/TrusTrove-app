package api

import (
	"testing"
	"time"
)

// TestTTLCache_SetGetRoundTrip covers the happy path: a value stored with a
// live TTL comes back on the first Get.
func TestTTLCache_SetGetRoundTrip(t *testing.T) {
	c := NewTTLCache()
	c.Set("pool:stats", 42, time.Minute)

	got, ok := c.Get("pool:stats")
	if !ok {
		t.Fatal("expected a cache hit for an entry stored with a minute left")
	}
	if got != 42 {
		t.Errorf("expected the stored value 42, got %v", got)
	}
}

// TestTTLCache_MissingKeyMisses guards the other half of the contract callers
// rely on: an absent key is a miss, not a zero value.
func TestTTLCache_MissingKeyMisses(t *testing.T) {
	c := NewTTLCache()

	got, ok := c.Get("events:20:")
	if ok {
		t.Error("expected a miss for a key that was never set")
	}
	if got != nil {
		t.Errorf("expected a nil value on a miss, got %v", got)
	}
}

// TestTTLCache_Expiry covers the TTL itself (#1078): once the window has passed
// the entry is a miss and is dropped from the map, so an expired response can
// never be served again. A nanosecond TTL makes the assertion deterministic
// without sleeping.
func TestTTLCache_Expiry(t *testing.T) {
	c := NewTTLCache()
	c.Set("events:20:", []string{"a"}, time.Nanosecond)

	if got, ok := c.Get("events:20:"); ok {
		t.Fatalf("expected an expired entry to miss, got %v", got)
	}

	// Get() deletes what it finds expired, so the entry must be gone from the
	// backing map rather than merely reported as stale.
	c.mu.RLock()
	_, present := c.items["events:20:"]
	c.mu.RUnlock()
	if present {
		t.Error("expected the expired entry to be evicted from the cache map")
	}
}

// TestTTLCache_SetOverwritesExpiry is what keeps a repeated Set from leaking a
// permanently-stale entry: refreshing a key must reset its clock.
func TestTTLCache_SetOverwritesExpiry(t *testing.T) {
	c := NewTTLCache()
	c.Set("pool:stats", "stale", time.Nanosecond)
	c.Set("pool:stats", "fresh", time.Minute)

	got, ok := c.Get("pool:stats")
	if !ok {
		t.Fatal("expected the refreshed entry to hit")
	}
	if got != "fresh" {
		t.Errorf("expected the refreshed value, got %v", got)
	}
}
