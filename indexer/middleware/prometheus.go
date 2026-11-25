package middleware

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name: "http_request_duration_seconds",
		Help: "Duration of HTTP requests.",
	}, []string{"path"})
)

// PrometheusMiddleware records the duration of every request. It must run as
// global middleware (before routing) and read the matched chi route pattern
// after the inner handler returns: using r.URL.Path instead would create one
// time series per invoice id/address and unbounded cardinality.
func PrometheusMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		httpDuration.WithLabelValues(routePattern(r)).Observe(time.Since(start).Seconds())
	})
}

// routePattern returns the bounded chi route template for the request, or
// "unmatched" when no route was selected (404s and requests handled before
// routing), so the label value is never client-controlled.
func routePattern(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if pattern := rctx.RoutePattern(); pattern != "" {
			return pattern
		}
	}
	return "unmatched"
}
