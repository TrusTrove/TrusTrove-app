package api

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// InvoicesIndexed counts the total number of invoice events processed by the indexer.
	InvoicesIndexed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "trustrove",
		Name:      "invoices_indexed_total",
		Help:      "Total number of invoice events indexed, partitioned by event type.",
	}, []string{"event_type"})

	// WebhookDeliveriesTotal tracks webhook delivery outcomes.
	WebhookDeliveriesTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "trustrove",
		Name:      "webhook_deliveries_total",
		Help:      "Total number of webhook delivery attempts, partitioned by outcome.",
	}, []string{"outcome"}) // delivered | retried | dead_lettered

	// ListenerLastLedger is the most recently processed ledger sequence number.
	ListenerLastLedger = promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: "trustrove",
		Name:      "listener_last_ledger",
		Help:      "Most recently processed Soroban ledger sequence number.",
	})

	// DBQueryDuration observes latencies for database queries.
	DBQueryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "trustrove",
		Name:      "db_query_duration_seconds",
		Help:      "Duration of database queries in seconds.",
		Buckets:   prometheus.DefBuckets,
	}, []string{"query"})
)

// MetricsHandler returns the Prometheus HTTP handler for the /metrics endpoint.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}
