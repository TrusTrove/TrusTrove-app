package api

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestCORSMiddleware_AllowsConfiguredOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://trustrove.vercel.app")
	rr := httptest.NewRecorder()

	handler := CORSMiddleware([]string{"https://trustrove.vercel.app", "http://localhost:3000"})(next)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusTeapot {
		t.Fatalf("expected status %d, got %d", http.StatusTeapot, rr.Code)
	}

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://trustrove.vercel.app" {
		t.Fatalf("expected allowed origin to be forwarded, got %q", got)
	}
}

func TestCORSMiddleware_RejectsUnlistedOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()

	handler := CORSMiddleware([]string{"https://trustrove.vercel.app", "http://localhost:3000"})(next)
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header for rejected origin, got %q", got)
	}
}

func TestHealthEndpoint_Returns200WhenListenerAndDBAreHealthy(t *testing.T) {
	h := newTestHandler(t)
	h.dbHealthChecker = func(context.Context) error { return nil }
	h.listenerHealth = NewListenerHealth()
	h.listenerHealth.MarkStarted()

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status": "ok"`) {
		t.Fatalf("expected healthy payload, got %s", rr.Body.String())
	}
}

func TestHealthEndpoint_Returns503WhenListenerStops(t *testing.T) {
	h := newTestHandler(t)
	h.dbHealthChecker = func(context.Context) error { return nil }
	h.listenerHealth = NewListenerHealth()
	h.listenerHealth.MarkStopped()

	router := NewRouter(h)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status %d, got %d; body: %s", http.StatusServiceUnavailable, rr.Code, rr.Body.String())
	}
	if !strings.Contains(rr.Body.String(), `"status": "degraded"`) {
		t.Fatalf("expected degraded payload, got %s", rr.Body.String())
	}
}

func createTestJWT(secret, sub string) string {
	claims := jwt.MapClaims{
		"sub": sub,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, _ := token.SignedString([]byte(secret))
	return tokenStr
}

func TestAuthMiddleware_StrictHeaderParsing(t *testing.T) {
	secret := "test-secret"
	validToken := createTestJWT(secret, "G1234567890")

	tests := []struct {
		name       string
		authHeader string
		wantCode   int
		wantSub    string
	}{
		{
			name:       "missing authorization header",
			authHeader: "",
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "wrong scheme",
			authHeader: "Basic " + validToken,
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "no space after bearer",
			authHeader: "Bearer",
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "bearer with empty token",
			authHeader: "Bearer ",
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "bearer with whitespace only token",
			authHeader: "Bearer \t ",
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "bearer with inner whitespace in token",
			authHeader: "Bearer " + validToken + " extra",
			wantCode:   http.StatusUnauthorized,
		},
		{
			name:       "lowercase bearer scheme",
			authHeader: "bearer " + validToken,
			wantCode:   http.StatusOK,
			wantSub:    "G1234567890",
		},
		{
			name:       "uppercase bearer scheme",
			authHeader: "BEARER " + validToken,
			wantCode:   http.StatusOK,
			wantSub:    "G1234567890",
		},
		{
			name:       "valid standard bearer token",
			authHeader: "Bearer " + validToken,
			wantCode:   http.StatusOK,
			wantSub:    "G1234567890",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var capturedSub string
			var handlerCalled bool

			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handlerCalled = true
				sub, ok := GetUserAddress(r.Context())
				if ok {
					capturedSub = sub
				}
				w.WriteHeader(http.StatusOK)
			})

			mw := AuthMiddleware(secret)(next)
			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			rr := httptest.NewRecorder()

			mw.ServeHTTP(rr, req)

			if rr.Code != tt.wantCode {
				t.Fatalf("authHeader %q: got status %d, want %d", tt.authHeader, rr.Code, tt.wantCode)
			}

			if tt.wantCode == http.StatusOK {
				if !handlerCalled {
					t.Fatalf("expected next handler to be called for header %q", tt.authHeader)
				}
				if capturedSub != tt.wantSub {
					t.Fatalf("expected captured sub %q, got %q", tt.wantSub, capturedSub)
				}
			}
		})
	}
}

func TestPerClientRateLimiter_ClientIsolation(t *testing.T) {
	rl := newPerClientRateLimiter(10, 20, 1000)
	defer rl.Stop()

	// Simulate client A exhausting its rate limit
	clientA := "ip:192.168.1.100"
	for i := 0; i < 25; i++ {
		rl.allow(clientA)
	}

	// Client A should now be rate limited
	if rl.allow(clientA) {
		t.Error("client A should be rate limited after exhausting tokens")
	}

	// Client B should still be allowed (isolation)
	clientB := "ip:192.168.1.101"
	if !rl.allow(clientB) {
		t.Error("client B should not be affected by client A's rate limit")
	}
}

func TestPerClientRateLimiter_JWTvsIPKeys(t *testing.T) {
	rl := newPerClientRateLimiter(10, 20, 1000)
	defer rl.Stop()

	// Create a request with JWT context
	reqJWT := httptest.NewRequest(http.MethodPost, "/auth", nil)
	ctx := WithUserAddress(reqJWT.Context(), "G1234567890")
	reqJWT = reqJWT.WithContext(ctx)

	// Create a request without JWT (IP-based)
	reqIP := httptest.NewRequest(http.MethodPost, "/auth", nil)
	reqIP.RemoteAddr = "192.168.1.100:12345"

	keyJWT := getClientKey(reqJWT)
	keyIP := getClientKey(reqIP)

	if keyJWT != "jwt:G1234567890" {
		t.Errorf("expected JWT key 'jwt:G1234567890', got %s", keyJWT)
	}

	if !strings.HasPrefix(keyIP, "ip:") {
		t.Errorf("expected IP key to start with 'ip:', got %s", keyIP)
	}

	// Exhaust JWT client
	for i := 0; i < 25; i++ {
		rl.allow(keyJWT)
	}

	// JWT client should be rate limited
	if rl.allow(keyJWT) {
		t.Error("JWT client should be rate limited")
	}

	// IP client should still be allowed (different keys)
	if !rl.allow(keyIP) {
		t.Error("IP client should not be affected by JWT client's rate limit")
	}
}

func TestPerClientRateLimiter_MaxSizeEviction(t *testing.T) {
	maxSize := 10
	rl := newPerClientRateLimiter(10, 20, maxSize)
	defer rl.Stop()

	// Add more clients than maxSize
	for i := 0; i < maxSize+5; i++ {
		clientKey := fmt.Sprintf("ip:192.168.1.%d", i)
		rl.allow(clientKey)
	}

	rl.mu.RLock()
	bucketCount := len(rl.buckets)
	rl.mu.RUnlock()

	// Bucket count should not exceed maxSize significantly
	// (may be maxSize+1 due to race condition during eviction)
	if bucketCount > maxSize+1 {
		t.Errorf("bucket count %d exceeds maxSize %d", bucketCount, maxSize)
	}
}

func TestPerClientRateLimiter_StaleEviction(t *testing.T) {
	rl := newPerClientRateLimiter(10, 20, 1000)
	defer rl.Stop()

	// Add a client
	clientKey := "ip:192.168.1.100"
	rl.allow(clientKey)

	rl.mu.RLock()
	_, exists := rl.buckets[clientKey]
	rl.mu.RUnlock()

	if !exists {
		t.Error("client bucket should exist after allow")
	}

	// Manually set lastSeen to old time
	rl.mu.Lock()
	if bucket, ok := rl.buckets[clientKey]; ok {
		bucket.mu.Lock()
		bucket.last = time.Now().Add(-15 * time.Minute)
		bucket.mu.Unlock()
	}
	rl.mu.Unlock()

	// Trigger cleanup
	rl.evictStale()

	rl.mu.RLock()
	_, exists = rl.buckets[clientKey]
	rl.mu.RUnlock()

	if exists {
		t.Error("stale client bucket should be evicted")
	}
}

func TestPerClientRateLimiter_TokenRefill(t *testing.T) {
	rl := newPerClientRateLimiter(100, 20, 1000)
	defer rl.Stop()

	clientKey := "ip:192.168.1.100"

	// Exhaust burst
	for i := 0; i < 25; i++ {
		rl.allow(clientKey)
	}

	// Should be rate limited
	if rl.allow(clientKey) {
		t.Error("should be rate limited after exhausting burst")
	}

	// Wait for token refill
	time.Sleep(20 * time.Millisecond)

	// Should be allowed again after refill
	if !rl.allow(clientKey) {
		t.Error("should be allowed after token refill")
	}
}
