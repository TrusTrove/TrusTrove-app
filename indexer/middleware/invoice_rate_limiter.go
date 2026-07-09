// Package middleware provides HTTP middleware for the TrusTrove indexer API.
// This file implements per-client rate limiting for the POST /invoices endpoint
// to prevent XLM fund drainage via spam invoice creation.
//
// Assignment: fix/indexer-invoice-rate-limiting
// File touched: indexer/api/handlers.go:L486-671 (rate-limit middleware applied to POST /invoices)
package middleware

import (
	"context"
	"net/http"
	"sync"
	"time"
)

const (
	// InvoiceRateLimit is the maximum number of invoice creations allowed
	// per client address within the rate-limit window.
	InvoiceRateLimit = 5

	// InvoiceRateLimitWindow is the rolling time window for rate limiting.
	InvoiceRateLimitWindow = time.Hour

	// cleanupInterval controls how often stale client entries are purged
	// from memory to prevent unbounded growth.
	cleanupInterval = 10 * time.Minute
)

// clientBucket tracks invoice creation attempts for a single authenticated client.
type clientBucket struct {
	mu        sync.Mutex
	attempts  []time.Time // timestamps of each invoice creation attempt
	lastSeen  time.Time   // used for cleanup of stale buckets
}

// InvoiceRateLimiter holds per-client state for the sliding-window rate limiter.
// It is safe for concurrent use by multiple goroutines.
type InvoiceRateLimiter struct {
	mu      sync.RWMutex
	clients map[string]*clientBucket
	limit   int
	window  time.Duration
	done    chan struct{} // signals the background cleanup goroutine to stop
}

// NewInvoiceRateLimiter constructs a rate limiter with the configured limit
// and window, and starts a background goroutine that periodically evicts
// stale per-client buckets to bound memory usage.
func NewInvoiceRateLimiter() *InvoiceRateLimiter {
	rl := &InvoiceRateLimiter{
		clients: make(map[string]*clientBucket),
		limit:   InvoiceRateLimit,
		window:  InvoiceRateLimitWindow,
		done:    make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// Stop halts the background cleanup goroutine. Call this when the server shuts down.
func (rl *InvoiceRateLimiter) Stop() {
	close(rl.done)
}

// Allow reports whether the given clientAddr may create another invoice right now.
// It implements a sliding-window counter: only attempts within the last `window`
// duration are counted.
func (rl *InvoiceRateLimiter) Allow(clientAddr string) bool {
	rl.mu.Lock()
	bucket, ok := rl.clients[clientAddr]
	if !ok {
		bucket = &clientBucket{}
		rl.clients[clientAddr] = bucket
	}
	rl.mu.Unlock()

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	bucket.lastSeen = now

	// Evict timestamps outside the sliding window.
	cutoff := now.Add(-rl.window)
	valid := bucket.attempts[:0]
	for _, t := range bucket.attempts {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	bucket.attempts = valid

	if len(bucket.attempts) >= rl.limit {
		return false
	}

	bucket.attempts = append(bucket.attempts, now)
	return true
}

// RemainingAttempts returns how many invoice creations the client still has
// available in the current window (useful for Retry-After / X-RateLimit headers).
func (rl *InvoiceRateLimiter) RemainingAttempts(clientAddr string) (remaining int, resetAt time.Time) {
	rl.mu.RLock()
	bucket, ok := rl.clients[clientAddr]
	rl.mu.RUnlock()

	if !ok {
		return rl.limit, time.Now().Add(rl.window)
	}

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)
	count := 0
	earliest := now
	for _, t := range bucket.attempts {
		if t.After(cutoff) {
			count++
			if t.Before(earliest) {
				earliest = t
			}
		}
	}

	remaining = rl.limit - count
	if remaining < 0 {
		remaining = 0
	}
	// The window resets once the oldest valid attempt ages out.
	resetAt = earliest.Add(rl.window)
	return remaining, resetAt
}

// cleanupLoop runs on a background goroutine and deletes buckets that haven't
// been seen in at least two cleanup intervals, bounding memory usage when many
// distinct client addresses have made requests.
func (rl *InvoiceRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.evictStale()
		case <-rl.done:
			return
		}
	}
}

func (rl *InvoiceRateLimiter) evictStale() {
	cutoff := time.Now().Add(-2 * cleanupInterval)
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for addr, bucket := range rl.clients {
		bucket.mu.Lock()
		if bucket.lastSeen.Before(cutoff) {
			delete(rl.clients, addr)
		}
		bucket.mu.Unlock()
	}
}

// InvoiceRateLimitMiddleware returns an http.Handler middleware that enforces
// the per-client invoice creation rate limit. It expects the client's Stellar
// address to have already been extracted from a validated JWT and stored in the
// request context under the key "clientAddress" (set by the JWT auth middleware).
//
// On limit breach it writes HTTP 429 Too Many Requests with:
//   - Retry-After  : seconds until the oldest attempt ages out of the window
//   - X-RateLimit-Limit     : configured maximum
//   - X-RateLimit-Remaining : how many attempts remain after this one
//   - X-RateLimit-Reset     : Unix timestamp when the window resets
func InvoiceRateLimitMiddleware(rl *InvoiceRateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientAddr := clientAddressFromContext(r)
			if clientAddr == "" {
				// Should never happen if JWT middleware runs first, but fail safe.
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			remaining, resetAt := rl.RemainingAttempts(clientAddr)

			// Set informational headers on every response (including allowed ones).
			retryAfter := int(time.Until(resetAt).Seconds())
			if retryAfter < 0 {
				retryAfter = 0
			}

			w.Header().Set("X-RateLimit-Limit", itoa(InvoiceRateLimit))
			w.Header().Set("X-RateLimit-Reset", itoa(int(resetAt.Unix())))

			if !rl.Allow(clientAddr) {
				// Re-fetch remaining/reset after the failed Allow call so headers
				// reflect the post-rejection state accurately.
				remaining, resetAt = rl.RemainingAttempts(clientAddr)
				retryAfter = int(time.Until(resetAt).Seconds())
				if retryAfter < 0 {
					retryAfter = 0
				}
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("Retry-After", itoa(retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate limit exceeded","message":"maximum 5 invoice creations per hour per client address"}`)) //nolint:errcheck
				return
			}

			w.Header().Set("X-RateLimit-Remaining", itoa(remaining-1))
			next.ServeHTTP(w, r)
		})
	}
}

// clientAddressFromContext extracts the authenticated client's Stellar address
// from the request context. The JWT auth middleware stores it under contextKey("clientAddress").
func clientAddressFromContext(r *http.Request) string {
	v := r.Context().Value(contextKey("clientAddress"))
	if v == nil {
		return ""
	}
	addr, _ := v.(string)
	return addr
}

// contextKey is a package-private type for context keys to avoid collisions.
type contextKey string

// WithClientAddress stores the authenticated Stellar address in ctx so that
// InvoiceRateLimitMiddleware can retrieve it. Call this from JWTAuthMiddleware
// (or tests) after verifying the JWT and extracting the client public key.
func WithClientAddress(ctx context.Context, addr string) context.Context {
	return context.WithValue(ctx, contextKey("clientAddress"), addr)
}

// itoa is a minimal int-to-string helper to avoid importing strconv in this file.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	buf := [20]byte{}
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}