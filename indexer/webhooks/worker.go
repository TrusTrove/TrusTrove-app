package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"trusttrove/indexer/db"
)

// WorkerConfig holds configuration for the webhook delivery worker.
type WorkerConfig struct {
	PollInterval time.Duration
	BatchSize    int
	HTTPTimeout  time.Duration
	MaxAttempts  int
}

// DefaultWorkerConfig returns sensible defaults for the webhook worker.
func DefaultWorkerConfig() WorkerConfig {
	return WorkerConfig{
		PollInterval: 5 * time.Second,
		BatchSize:    50,
		HTTPTimeout:  10 * time.Second,
		MaxAttempts:  5,
	}
}

// DeliveryWorker processes webhook deliveries from the database queue.
// It runs as a background goroutine, polling for pending deliveries and
// attempting HTTP POST to subscriber URLs with HMAC-SHA256 signatures.
type DeliveryWorker struct {
	cfg WorkerConfig
}

// NewDeliveryWorker creates a new webhook delivery worker.
func NewDeliveryWorker(cfg WorkerConfig) *DeliveryWorker {
	return &DeliveryWorker{
		cfg: cfg,
	}
}

// Start begins the worker's delivery loop. It blocks until ctx is cancelled.
func (w *DeliveryWorker) Start(ctx context.Context) error {
	slog.Info("Starting webhook delivery worker", "poll_interval", w.cfg.PollInterval, "batch_size", w.cfg.BatchSize)

	ticker := time.NewTicker(w.cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Webhook delivery worker stopping")
			return ctx.Err()
		case <-ticker.C:
			w.processBatch(ctx)
		}
	}
}

// processBatch fetches and processes a batch of pending deliveries.
func (w *DeliveryWorker) processBatch(ctx context.Context) {
	deliveries, err := db.GetPendingDeliveries(ctx, w.cfg.BatchSize)
	if err != nil {
		slog.Error("webhook worker: get pending deliveries failed", "error", err)
		return
	}

	if len(deliveries) == 0 {
		return
	}

	slog.Debug("webhook worker: processing batch", "count", len(deliveries))

	for _, delivery := range deliveries {
		w.attemptDelivery(ctx, delivery)
	}
}

// attemptDelivery performs a single HTTP delivery attempt with signing.
func (w *DeliveryWorker) attemptDelivery(ctx context.Context, delivery *db.WebhookDelivery) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := sign(delivery.EndpointSecret, ts, delivery.Payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, delivery.EndpointURL, bytes.NewReader(delivery.Payload))
	if err != nil {
		w.handleFailure(ctx, delivery, nil, fmt.Sprintf("build request: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-TrusTrove-Timestamp", ts)
	req.Header.Set("X-TrusTrove-Signature", "sha256="+sig)

	client := &http.Client{Timeout: w.cfg.HTTPTimeout}
	resp, err := client.Do(req)
	if err != nil {
		w.handleFailure(ctx, delivery, nil, fmt.Sprintf("http: %v", err))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	bodyStr := string(body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if dbErr := db.MarkDeliverySuccess(ctx, delivery.ID, resp.StatusCode, bodyStr); dbErr != nil {
			slog.Error("webhook worker: mark success failed", "delivery_id", delivery.ID, "error", dbErr)
		}
		slog.Info("webhook worker: delivered", "delivery_id", delivery.ID, "endpoint", delivery.EndpointURL, "status", resp.StatusCode)
		return
	}

	sc := resp.StatusCode
	w.handleFailure(ctx, delivery, &sc, fmt.Sprintf("non-2xx response: %d", sc))
}

// handleFailure processes a failed delivery attempt, scheduling retry or dead-lettering.
func (w *DeliveryWorker) handleFailure(ctx context.Context, delivery *db.WebhookDelivery, statusCode *int, errMsg string) {
	nextAttempt := delivery.Attempts + 1
	slog.Warn("webhook worker: delivery failed",
		"delivery_id", delivery.ID,
		"attempt", nextAttempt,
		"max_attempts", delivery.MaxAttempts,
		"endpoint", delivery.EndpointURL,
		"error", errMsg,
	)

	if nextAttempt >= delivery.MaxAttempts {
		if err := db.MarkDeliveryDeadLetter(ctx, delivery.ID, errMsg); err != nil {
			slog.Error("webhook worker: mark dead_letter failed", "delivery_id", delivery.ID, "error", err)
		}
		slog.Error("webhook worker: delivery dead-lettered", "delivery_id", delivery.ID, "endpoint", delivery.EndpointURL)
		return
	}

	// Exponential backoff: backoffBase * 2^attempt (10s, 20s, 40s, 80s)
	delay := backoffBase * (1 << uint(nextAttempt))
	nextAt := time.Now().Add(delay)
	if err := db.MarkDeliveryRetry(ctx, delivery.ID, nextAt, statusCode, errMsg); err != nil {
		slog.Error("webhook worker: mark retry failed", "delivery_id", delivery.ID, "error", err)
	}
}

const (
	backoffBase = 10 * time.Second
)

// sign returns the HMAC-SHA256 hex digest of "<timestamp>.<payload>".
func sign(secret, timestamp string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
