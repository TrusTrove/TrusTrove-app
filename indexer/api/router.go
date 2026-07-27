package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized: missing token", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, "Unauthorized: invalid header format", http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimSpace(parts[1])
			if tokenStr == "" || strings.ContainsAny(tokenStr, " \t\r\n") {
				http.Error(w, "Unauthorized: invalid header format", http.StatusUnauthorized)
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "Unauthorized: invalid or expired token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "Unauthorized: invalid claims", http.StatusUnauthorized)
				return
			}

			sub, ok := claims["sub"].(string)
			if !ok {
				http.Error(w, "Unauthorized: missing sub claim", http.StatusUnauthorized)
				return
			}

			ctx := WithUserAddress(r.Context(), sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		origin := strings.TrimSpace(o)
		if origin != "" {
			originSet[origin] = struct{}{}
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			if origin != "" {
				if _, ok := originSet[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
				} else {
					w.WriteHeader(http.StatusForbidden)
					return
				}
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeadersMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Security-Policy", "default-src 'self'")
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			next.ServeHTTP(w, r)
		})
	}
}

type clientBucket struct {
	mu     sync.Mutex
	tokens float64
	last   time.Time
}

type perClientRateLimiter struct {
	mu      sync.RWMutex
	buckets map[string]*clientBucket
	rps     float64
	burst   int
	maxSize int
	done    chan struct{}
}

func newPerClientRateLimiter(rps int, burst int, maxSize int) *perClientRateLimiter {
	rl := &perClientRateLimiter{
		buckets: make(map[string]*clientBucket),
		rps:     float64(rps),
		burst:   burst,
		maxSize: maxSize,
		done:    make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *perClientRateLimiter) Stop() {
	close(rl.done)
}

func (rl *perClientRateLimiter) allow(clientKey string) bool {
	rl.mu.Lock()
	bucket, ok := rl.buckets[clientKey]
	if !ok {
		bucket = &clientBucket{
			tokens: float64(rl.burst),
			last:   time.Now(),
		}
		rl.buckets[clientKey] = bucket
		if len(rl.buckets) > rl.maxSize {
			rl.evictOldest()
		}
	}
	rl.mu.Unlock()

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(bucket.last).Seconds()
	bucket.tokens += elapsed * rl.rps
	if bucket.tokens > float64(rl.burst) {
		bucket.tokens = float64(rl.burst)
	}
	bucket.last = now

	if bucket.tokens >= 1 {
		bucket.tokens--
		return true
	}
	return false
}

func (rl *perClientRateLimiter) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	for key, bucket := range rl.buckets {
		if oldestKey == "" || bucket.last.Before(oldestTime) {
			oldestKey = key
			oldestTime = bucket.last
		}
	}
	if oldestKey != "" {
		delete(rl.buckets, oldestKey)
	}
}

func (rl *perClientRateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
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

func (rl *perClientRateLimiter) evictStale() {
	cutoff := time.Now().Add(-10 * time.Minute)
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for key, bucket := range rl.buckets {
		bucket.mu.Lock()
		if bucket.last.Before(cutoff) {
			delete(rl.buckets, key)
		}
		bucket.mu.Unlock()
	}
}

func getClientKey(r *http.Request) string {
	if sub, ok := GetUserAddress(r.Context()); ok {
		return "jwt:" + sub
	}
	return "ip:" + r.RemoteAddr
}

func RateLimitMiddleware(rl *perClientRateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			clientKey := getClientKey(r)
			if !rl.allow(clientKey) {
				w.Header().Set("Retry-After", "1")
				http.Error(w, fmt.Sprintf("Too Many Requests (client: %s)", clientKey), http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func NewRouter(h *APIHandler) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(CORSMiddleware(h.cfg.CORSAllowedOrigins))
	r.Use(SecurityHeadersMiddleware())

	// Per-client rate limiter for auth and invoice creation
	// Max 1000 clients to bound memory usage
	rl := newPerClientRateLimiter(h.cfg.RateLimitRPS, h.cfg.RateLimitRPS*2, 1000)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := h.CheckHealth(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "degraded", "error": "listener or database unavailable"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok"}`))
	})

	// Unprotected authentication routes (rate limited)
	r.Group(func(r chi.Router) {
		r.Use(RateLimitMiddleware(rl))
		r.Get("/auth", h.HandleGetAuth)
		r.Post("/auth", h.HandlePostAuth)
	})

	// Public protocol stats (cached, no auth)
	r.Get("/stats", h.HandleGetStats)

	// Invoices, Events, and Pool routes
	r.Get("/events", h.HandleGetEvents)
	r.Get("/invoices/{id}", h.HandleGetInvoiceByID)
	r.Get("/invoices", h.HandleGetInvoices)
	r.Get("/pool/stats", h.HandleGetPoolStats)
	r.Get("/pool/position/{address}", h.HandleGetLPPosition)

	// Protected routes (rate limited)
	r.Group(func(r chi.Router) {
		r.Use(AuthMiddleware(h.cfg.JWTSecret))
		r.Use(RateLimitMiddleware(rl))
		r.Post("/invoices", h.HandleCreateInvoice)
	})

	return r
}
