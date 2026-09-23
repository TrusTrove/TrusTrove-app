package main

import (
	"os"
	"strings"
)

func main() {
	b, err := os.ReadFile("indexer/api/router.go")
	if err != nil {
		panic(err)
	}
	content := string(b)
	
	// 1. Add prometheus imports
	content = strings.Replace(content, "\"github.com/go-chi/chi/v5\"", "\"github.com/go-chi/chi/v5\"\n\t\"github.com/prometheus/client_golang/prometheus\"\n\t\"github.com/prometheus/client_golang/prometheus/promauto\"\n\t\"github.com/prometheus/client_golang/prometheus/promhttp\"", 1)
	
	// 2. Add MetricsMiddleware function before NewRouter
	metricsStr := `var (
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
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			routeCtx := chi.RouteContext(r.Context())
			routePattern := "unknown"
			if routeCtx != nil && routeCtx.RoutePattern() != "" {
				routePattern = routeCtx.RoutePattern()
			}
			status := fmt.Sprintf("%d", ww.Status())
			if ww.Status() == 0 {
				status = "200"
			}
			httpRequestsTotal.WithLabelValues(routePattern, status).Inc()
			httpRequestDuration.WithLabelValues(routePattern, status).Observe(time.Since(start).Seconds())
		})
	}
}

func NewRouter(h *APIHandler) *chi.Mux {`
	content = strings.Replace(content, "func NewRouter(h *APIHandler) *chi.Mux {", metricsStr, 1)

	// 3. Add metrics middleware in NewRouter
	content = strings.Replace(content, "r.Use(RecoveryMiddleware())", "r.Use(RecoveryMiddleware())\n\tr.Use(MetricsMiddleware())", 1)
	
	// 4. Expose /metrics
	content = strings.Replace(content, "r.Get(\"/health\", func(w http.ResponseWriter, r *http.Request) {", "r.Get(\"/metrics\", promhttp.Handler().ServeHTTP)\n\tr.Get(\"/health\", func(w http.ResponseWriter, r *http.Request) {", 1)

	// 5. Update /health for ledgerLag
	oldHealth := `		if err := h.CheckHealth(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(` + "`" + `{"status": "degraded", "error": "listener or database unavailable"}` + "`" + `))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(` + "`" + `{"status": "ok"}` + "`" + `))`

	newHealth := `		lag := int32(0)
		if h.ListenerHealth() != nil {
			lag = h.ListenerHealth().GetLedgerLag()
		}
		lagField := fmt.Sprintf(` + "`" + `"ledgerLag": %d` + "`" + `, lag)

		if err := h.CheckHealth(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(fmt.Sprintf(` + "`" + `{"status": "degraded", "error": "listener or database unavailable", %s}` + "`" + `, lagField)))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(fmt.Sprintf(` + "`" + `{"status": "ok", %s}` + "`" + `, lagField)))`

	content = strings.Replace(content, oldHealth, newHealth, 1)

	os.WriteFile("indexer/api/router.go", []byte(content), 0644)
}
