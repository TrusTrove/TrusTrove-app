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
	"trusttrove/indexer/webhooks"
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

// SetHTTPTimeout allows overriding the HTTP client timeout (used by worker config).
func (d *Dispatcher) SetHTTPTimeout(timeout time.Duration) {
	d.client.Timeout = timeout
}

// Dispatch enqueues a delivery for every active subscription matching eventType.
// It constructs the full webhook envelope (with schema_version, event_id, etc.)
// and writes delivery rows to the database. Non-blocking.
func (d *Dispatcher) Dispatch(ctx context.Context, eventType string, data map[string]interface{}) {
	subs, err := db.ListActiveWebhookSubscriptionsForEvent(ctx, eventType)
	if err != nil {
		slog.Error("webhook: list subscriptions failed", "event_type", eventType, "error", err)
		return
	}
	if len(subs) == 0 {
		return
	}

	// Build the envelope data payload
	eventID := ""
	if v, ok := data["event_id"].(string); ok {
		eventID = v
	}
	if eventID == "" {
		eventID = fmt.Sprintf("evt_%d", time.Now().UnixNano())
	}

	contractID := ""
	if v, ok := data["contract_id"].(string); ok {
		contractID = v
	}

	ledger := uint32(0)
	if v, ok := data["ledger"]; ok {
		switch val := v.(type) {
		case int:
			ledger = uint32(val)
		case int32:
			ledger = uint32(val)
		case uint32:
			ledger = val
		case float64:
			ledger = uint32(val)
		}
	}

	occurredAt := time.Now()
	if v, ok := data["ledger_closed_at"].(int64); ok {
		occurredAt = time.Unix(v, 0)
	} else if v, ok := data["occurred_at"].(time.Time); ok {
		occurredAt = v
	}

	// Map the internal event type to the public webhook event type
	publicEventType := mapInternalEventType(eventType)

	// Build the appropriate data payload based on event type
	var envelope *webhooks.WebhookEnvelope
	switch publicEventType {
	case webhooks.EventInvoiceCreated, webhooks.EventInvoiceFunded, webhooks.EventInvoiceRepaid,
		webhooks.EventInvoiceDefaulted, webhooks.EventInvoiceListed, webhooks.EventInvoiceShipped,
		webhooks.EventInvoiceConfirmed:
		invoiceData := webhooks.InvoiceEventData{
			InvoiceID:        getString(data, "invoice_id"),
			Issuer:           getString(data, "issuer"),
			Buyer:            getString(data, "buyer"),
			FaceValue:        getString(data, "face_value"),
			DiscountBps:      getInt(data, "discount_bps"),
			FundedAmount:     getString(data, "funded_amount"),
			DueDate:          getInt64(data, "due_date"),
			Status:           getString(data, "status"),
			CreatedAt:        getInt64(data, "created_at"),
			FundedAt:         getInt64Ptr(data, "funded_at"),
			ShippedAt:        getInt64Ptr(data, "shipped_at"),
			BuyerConfirmedAt: getInt64Ptr(data, "buyer_confirmed_at"),
			RepaidAt:         getInt64Ptr(data, "repaid_at"),
		}
		var err error
		switch publicEventType {
		case webhooks.EventInvoiceCreated:
			envelope, err = webhooks.NewInvoiceCreatedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceFunded:
			envelope, err = webhooks.NewInvoiceFundedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceRepaid:
			envelope, err = webhooks.NewInvoiceRepaidPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceDefaulted:
			envelope, err = webhooks.NewInvoiceDefaultedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceListed:
			envelope, err = webhooks.NewInvoiceListedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceShipped:
			envelope, err = webhooks.NewInvoiceShippedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		case webhooks.EventInvoiceConfirmed:
			envelope, err = webhooks.NewInvoiceConfirmedPayload(eventID, contractID, ledger, occurredAt, invoiceData)
		}
		if err != nil {
			slog.Error("webhook: build invoice envelope failed", "event_type", eventType, "error", err)
			return
		}
	case webhooks.EventPoolDeposit, webhooks.EventPoolWithdrawal, webhooks.EventPoolYieldDistributed:
		poolData := webhooks.PoolEventData{
			Account:     getString(data, "account"),
			Amount:      getString(data, "amount"),
			Shares:      getString(data, "shares"),
			NewBalance:  getString(data, "new_balance"),
			YieldAmount: getString(data, "yield_amount"),
			TotalShares: getString(data, "total_shares"),
		}
		var err error
		switch publicEventType {
		case webhooks.EventPoolDeposit:
			envelope, err = webhooks.NewPoolDepositPayload(eventID, contractID, ledger, occurredAt, poolData)
		case webhooks.EventPoolWithdrawal:
			envelope, err = webhooks.NewPoolWithdrawalPayload(eventID, contractID, ledger, occurredAt, poolData)
		case webhooks.EventPoolYieldDistributed:
			envelope, err = webhooks.NewPoolYieldDistributedPayload(eventID, contractID, ledger, occurredAt, poolData)
		}
		if err != nil {
			slog.Error("webhook: build pool envelope failed", "event_type", eventType, "error", err)
			return
		}
	default:
		// Fallback for unknown event types - use generic payload
		payloadBytes, _ := json.Marshal(data)
		envelope = &webhooks.WebhookEnvelope{
			SchemaVersion: webhooks.SchemaVersion,
			EventType:     publicEventType,
			EventID:       eventID,
			OccurredAt:    occurredAt,
			Ledger:        ledger,
			ContractID:    contractID,
			Data:          payloadBytes,
		}
	}

	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		slog.Error("webhook: marshal envelope failed", "event_type", eventType, "error", err)
		return
	}

	for _, sub := range subs {
		if err := db.CreateWebhookDelivery(ctx, sub.ID, string(publicEventType), eventID, envelopeBytes); err != nil {
			slog.Error("webhook: create delivery failed", "subscription_id", sub.ID, "error", err)
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

// mapInternalEventType maps internal event names to public webhook event types.
func mapInternalEventType(internal string) webhooks.EventType {
	switch internal {
	case "create", "InvoiceCreated":
		return webhooks.EventInvoiceCreated
	case "list_for_financing", "InvoiceListed":
		return webhooks.EventInvoiceListed
	case "fund_invoice", "InvoiceFunded":
		return webhooks.EventInvoiceFunded
	case "mark_shipped", "InvoiceShipped":
		return webhooks.EventInvoiceShipped
	case "confirm_delivery", "DeliveryConfirmed":
		return webhooks.EventInvoiceConfirmed
	case "repay", "InvoiceRepaid":
		return webhooks.EventInvoiceRepaid
	case "trigger_default", "InvoiceDefaulted":
		return webhooks.EventInvoiceDefaulted
	case "deposit", "PoolDeposit":
		return webhooks.EventPoolDeposit
	case "withdraw", "PoolWithdrawal":
		return webhooks.EventPoolWithdrawal
	case "yield_distribution", "PoolYieldDistributed":
		return webhooks.EventPoolYieldDistributed
	default:
		return webhooks.EventType(internal)
	}
}

func getString(data map[string]interface{}, key string) string {
	if v, ok := data[key].(string); ok {
		return v
	}
	return ""
}

func getInt(data map[string]interface{}, key string) int {
	if v, ok := data[key].(int); ok {
		return v
	}
	if v, ok := data[key].(float64); ok {
		return int(v)
	}
	return 0
}

func getInt64(data map[string]interface{}, key string) int64 {
	if v, ok := data[key].(int64); ok {
		return v
	}
	if v, ok := data[key].(float64); ok {
		return int64(v)
	}
	if v, ok := data[key].(int); ok {
		return int64(v)
	}
	return 0
}

func getInt64Ptr(data map[string]interface{}, key string) *int64 {
	if v, ok := data[key].(int64); ok {
		return &v
	}
	if v, ok := data[key].(float64); ok {
		val := int64(v)
		return &val
	}
	if v, ok := data[key].(int); ok {
		val := int64(v)
		return &val
	}
	return nil
}
