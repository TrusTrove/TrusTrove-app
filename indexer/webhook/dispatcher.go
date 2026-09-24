package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"trusttrove/indexer/db"
)

const (
	maxAttempts  = 5
	pollInterval = 5 * time.Second
	httpTimeout  = 10 * time.Second
	// backoffBase is multiplied by 2^attempt to get the retry delay (seconds).
	backoffBase = 10 * time.Second
)

// Dispatcher fans out contract events to registered webhook endpoints and
// retries failed deliveries with exponential backoff up to maxAttempts times.
// Deliveries that exhaust all attempts are moved to dead-letter status.
type Dispatcher struct {
	client *http.Client
}

func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		client: &http.Client{Timeout: httpTimeout},
	}
}

// Payload is the JSON body sent to every webhook endpoint.
type Payload struct {
	EventType string                 `json:"event_type"`
	Timestamp int64                  `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// Dispatch enqueues a delivery for every active endpoint subscribed to eventType.
// It is non-blocking: it only writes delivery rows to the database.
func (d *Dispatcher) Dispatch(ctx context.Context, eventType string, data map[string]interface{}) {
	endpoints, err := db.ListActiveWebhookEndpointsForEvent(ctx, eventType)
	if err != nil {
		slog.Error("webhook: list endpoints failed", "event_type", eventType, "error", err)
		return
	}
	if len(endpoints) == 0 {
		return
	}

	p := Payload{
		EventType: eventType,
		Timestamp: time.Now().Unix(),
		Data:      data,
	}
	payloadBytes, err := json.Marshal(p)
	if err != nil {
		slog.Error("webhook: marshal payload failed", "event_type", eventType, "error", err)
		return
	}

	for _, ep := range endpoints {
		if err := db.CreateWebhookDelivery(ctx, ep.ID, eventType, payloadBytes); err != nil {
			slog.Error("webhook: create delivery failed", "endpoint_id", ep.ID, "error", err)
		}
	}
}

// RunWorker starts the retry loop. It blocks until ctx is cancelled.
func (d *Dispatcher) RunWorker(ctx context.Context) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	slog.Info("webhook worker started")
	for {
		select {
		case <-ctx.Done():
			slog.Info("webhook worker stopped")
			return
		case <-ticker.C:
			d.processPending(ctx)
		}
	}
}

func (d *Dispatcher) processPending(ctx context.Context) {
	deliveries, err := db.GetPendingDeliveries(ctx, 50)
	if err != nil {
		slog.Error("webhook: get pending deliveries failed", "error", err)
		return
	}

	for _, delivery := range deliveries {
		d.attempt(ctx, delivery)
	}
}

func (d *Dispatcher) attempt(ctx context.Context, delivery *db.WebhookDelivery) {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	sig := sign(delivery.EndpointSecret, ts, delivery.Payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, delivery.EndpointURL, bytes.NewReader(delivery.Payload))
	if err != nil {
		d.handleFailure(ctx, delivery, nil, fmt.Sprintf("build request: %v", err))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-TrusTrove-Timestamp", ts)
	req.Header.Set("X-TrusTrove-Signature", "sha256="+sig)

	resp, err := d.client.Do(req)
	if err != nil {
		d.handleFailure(ctx, delivery, nil, fmt.Sprintf("http: %v", err))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	bodyStr := string(body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		if dbErr := db.MarkDeliverySuccess(ctx, delivery.ID, resp.StatusCode, bodyStr); dbErr != nil {
			slog.Error("webhook: mark success failed", "delivery_id", delivery.ID, "error", dbErr)
		}
		slog.Info("webhook: delivered", "delivery_id", delivery.ID, "endpoint", delivery.EndpointURL, "status", resp.StatusCode)
		return
	}

	sc := resp.StatusCode
	d.handleFailure(ctx, delivery, &sc, fmt.Sprintf("non-2xx response: %d", sc))
}

func (d *Dispatcher) handleFailure(ctx context.Context, delivery *db.WebhookDelivery, statusCode *int, errMsg string) {
	nextAttempt := delivery.Attempts + 1
	slog.Warn("webhook: delivery failed",
		"delivery_id", delivery.ID,
		"attempt", nextAttempt,
		"max_attempts", delivery.MaxAttempts,
		"endpoint", delivery.EndpointURL,
		"error", errMsg,
	)

	if nextAttempt >= delivery.MaxAttempts {
		if err := db.MarkDeliveryDeadLetter(ctx, delivery.ID, errMsg); err != nil {
			slog.Error("webhook: mark dead_letter failed", "delivery_id", delivery.ID, "error", err)
		}
		slog.Error("webhook: delivery dead-lettered", "delivery_id", delivery.ID, "endpoint", delivery.EndpointURL)
		return
	}

	// Exponential backoff: backoffBase * 2^attempt (10s, 20s, 40s, 80s)
	delay := backoffBase * (1 << uint(nextAttempt))
	nextAt := time.Now().Add(delay)
	if err := db.MarkDeliveryRetry(ctx, delivery.ID, nextAt, statusCode, errMsg); err != nil {
		slog.Error("webhook: mark retry failed", "delivery_id", delivery.ID, "error", err)
	}
}

// sign returns the HMAC-SHA256 hex digest of "<timestamp>.<payload>".
func sign(secret, timestamp string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}
