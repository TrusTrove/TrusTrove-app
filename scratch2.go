package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"trusttrove/indexer/middleware"
	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v4"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "trusttrove_indexer_http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"route", "status"},
	)
	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "trusttrove_indexer_http_request_duration_seconds",
			Help:    "Histogram of response latency (seconds) of HTTP requests.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"route", "status"},
	)
)

func MetricsMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			
			// Use a response writer wrapper to capture status code
			// Assuming there is no easy chi way, we can do a simple wrapper
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			
			next.ServeHTTP(ww, r)
			
			routeCtx := chi.RouteContext(r.Context())
			routePattern := "unknown"
			if routeCtx != nil && routeCtx.RoutePattern() != "" {
				routePattern = routeCtx.RoutePattern()
			}
			status := fmt.Sprintf("%d", ww.Status())
			if ww.Status() == 0 {
				status = "200" // default if not written explicitly
			}
			
			httpRequestsTotal.WithLabelValues(routePattern, status).Inc()
			httpRequestDuration.WithLabelValues(routePattern, status).Observe(time.Since(start).Seconds())
		})
	}
}
