package listener

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/xdrutil"

	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// SyncPoolStats retrieves latest pool statistics from the contract on-chain and updates the database
func SyncPoolStats(ctx context.Context, cfg *config.Config, serverKP *keypair.Full) error {
	slog.Info("Syncing pool stats from chain...")

	// Read stats from pool contract on-chain
	scValResult, err := api.ReadContract(cfg.SorobanRPCURL, cfg.PoolContractID, "get_stats", []xdr.ScVal{}, serverKP)
	if err != nil {
		return fmt.Errorf("sync pool stats: read contract: %w", err)
	}

	totalDeposits := "0"
	totalFunded := "0"
	availableLiquidity := "0"
	utilizationRateBps := 0
	totalYieldDistributed := "0"
	activeInvoiceCount := 0
	totalShares := "0"

	if val, ok := xdrutil.GetMapVal(scValResult, "total_deposits"); ok {
		totalDeposits = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "total_funded"); ok {
		totalFunded = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "available_liquidity"); ok {
		availableLiquidity = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "utilization_rate_bps"); ok {
		utilizationRateBps = int(xdrutil.ParseU32(val))
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "total_yield_distributed"); ok {
		totalYieldDistributed = xdrutil.ParseU128(val)
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "active_invoice_count"); ok {
		activeInvoiceCount = int(xdrutil.ParseU32(val))
	}
	if val, ok := xdrutil.GetMapVal(scValResult, "total_shares"); ok {
		totalShares = xdrutil.ParseU128(val)
	}

	dbStats := &db.DbPoolStats{
		TotalDeposits:         totalDeposits,
		TotalFunded:           totalFunded,
		AvailableLiquidity:    availableLiquidity,
		UtilizationRateBps:    utilizationRateBps,
		TotalYieldDistributed: totalYieldDistributed,
		ActiveInvoiceCount:    activeInvoiceCount,
		TotalShares:           totalShares,
	}

	err = db.UpdatePoolStats(ctx, dbStats)
	if err != nil {
		return fmt.Errorf("sync pool stats: database update: %w", err)
	}

	slog.Info("Pool stats successfully synced", "deposits", totalDeposits, "funded", totalFunded)
	return nil
}

// Event-specific handlers called by the listener loop

func (l *EventListener) handleInvoiceCreated(ctx context.Context, event SorobanEvent, ledgerClosedAt int64) error {
	var val xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Value, &val)
	if err != nil {
		return fmt.Errorf("parse value: %w", err)
	}

	// Parse invoice struct/map fields
	id := ""
	issuer := ""
	buyer := ""
	faceValue := "0"
	dueDate := int64(0)

	if idVal, ok := xdrutil.GetMapVal(val, "id"); ok {
		id = xdrutil.ParseBytes(idVal)
	}
	if issuerVal, ok := xdrutil.GetMapVal(val, "issuer"); ok {
		issuer = xdrutil.ParseAddress(issuerVal)
	}
	if buyerVal, ok := xdrutil.GetMapVal(val, "buyer"); ok {
		buyer = xdrutil.ParseAddress(buyerVal)
	}
	if faceVal, ok := xdrutil.GetMapVal(val, "face_value"); ok {
		faceValue = xdrutil.ParseU128(faceVal)
	}
	if dueVal, ok := xdrutil.GetMapVal(val, "due_date"); ok {
		dueDate = xdrutil.ParseU64(dueVal)
	}

	if id == "" || issuer == "" || buyer == "" {
		return fmt.Errorf("event value missing required invoice fields: id=%s, issuer=%s, buyer=%s", id, issuer, buyer)
	}

	dbInvoice := &db.DbInvoice{
		ID:              id,
		Issuer:          issuer,
		Buyer:           buyer,
		FaceValue:       faceValue,
		DiscountBps:     0,
		FundedAmount:    "0",
		DueDate:         dueDate,
		Status:          "Created",
		CreatedAt:       ledgerClosedAt,
		IssuerConfirmed: false,
		BuyerConfirmed:  false,
	}

	err = db.InsertInvoice(ctx, dbInvoice)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceCreated", "id", id, "issuer", issuer, "faceValue", faceValue)
	return nil
}

func (l *EventListener) handleInvoiceListed(ctx context.Context, event SorobanEvent) error {
	// Topic format: ["InvoiceListed" / "list_for_financing", invoice_id_bytes]
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for list event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	var val xdr.ScVal
	err = xdr.SafeUnmarshalBase64(event.Value, &val)
	if err != nil {
		return fmt.Errorf("parse value: %w", err)
	}
	discountBps := int(xdrutil.ParseU32(val))

	err = db.UpdateInvoiceListed(ctx, invoiceID, "Listed", discountBps)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceListed", "id", invoiceID, "discountBps", discountBps)
	return nil
}

func (l *EventListener) handleInvoiceFunded(ctx context.Context, event SorobanEvent, serverKP *keypair.Full, ledgerClosedAt int64) error {
	// Topic format: ["InvoiceFunded" / "fund_invoice", invoice_id_bytes]
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for funded event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	var val xdr.ScVal
	err = xdr.SafeUnmarshalBase64(event.Value, &val)
	if err != nil {
		return fmt.Errorf("parse value: %w", err)
	}
	fundedAmount := xdrutil.ParseU128(val)

	err = db.UpdateInvoiceFunded(ctx, invoiceID, "Funded", fundedAmount, ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceFunded", "id", invoiceID, "fundedAmount", fundedAmount)

	// Sync pool stats after funding invoice
	_ = SyncPoolStats(ctx, l.cfg, serverKP)
	return nil
}

func (l *EventListener) handleInvoiceShipped(ctx context.Context, event SorobanEvent, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for shipped event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceShipped(ctx, invoiceID, "Active", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceShipped", "id", invoiceID)
	return nil
}

func (l *EventListener) handleDeliveryConfirmed(ctx context.Context, event SorobanEvent, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for confirmed event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceDeliveryConfirmed(ctx, invoiceID, "Confirmed", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: DeliveryConfirmed", "id", invoiceID)
	return nil
}

func (l *EventListener) handleInvoiceRepaid(ctx context.Context, event SorobanEvent, serverKP *keypair.Full, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for repaid event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceRepaid(ctx, invoiceID, "Repaid", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceRepaid", "id", invoiceID)

	// Sync pool stats after repayment
	_ = SyncPoolStats(ctx, l.cfg, serverKP)
	return nil
}

func (l *EventListener) handleInvoiceDefaulted(ctx context.Context, event SorobanEvent, serverKP *keypair.Full) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for default event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceStatus(ctx, invoiceID, "Defaulted")
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceDefaulted", "id", invoiceID)

	// Sync pool stats after default
	_ = SyncPoolStats(ctx, l.cfg, serverKP)
	return nil
}

func (l *EventListener) handleEvent(ctx context.Context, event SorobanEvent) error {
	if len(event.Topic) == 0 {
		return fmt.Errorf("event topic is empty")
	}

	var topicVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[0], &topicVal)
	if err != nil {
		return fmt.Errorf("parse first topic: %w", err)
	}
	if topicVal.Sym == nil {
		return fmt.Errorf("first topic is not a symbol")
	}
	eventName := string(*topicVal.Sym)

	serverKP, err := api.GetServerKeypair(l.cfg.ServerSeed)
	if err != nil && l.cfg.JWTSecret != "" {
		serverKP, err = api.GetServerKeypair(l.cfg.JWTSecret)
	}
	if err != nil {
		return fmt.Errorf("get server keypair: %w", err)
	}

	// Parse ledger closed time
	ledgerClosedAt := time.Now().Unix()
	if event.LedgerClosedAt != "" {
		if t, err := time.Parse(time.RFC3339, event.LedgerClosedAt); err == nil {
			ledgerClosedAt = t.Unix()
		}
	}

	var data map[string]interface{}
	_ = json.Unmarshal([]byte(event.Value), &data) // Unmarshal if it's JSON, ignore if it fails

	switch eventName {
	case "create", "InvoiceCreated":
		err = l.handleInvoiceCreated(ctx, event, ledgerClosedAt)
	case "list_for_financing", "InvoiceListed":
		err = l.handleInvoiceListed(ctx, event)
	case "fund_invoice", "InvoiceFunded":
		err = l.handleInvoiceFunded(ctx, event, serverKP, ledgerClosedAt)
	case "mark_shipped", "InvoiceShipped":
		err = l.handleInvoiceShipped(ctx, event, ledgerClosedAt)
	case "confirm_delivery", "DeliveryConfirmed":
		err = l.handleDeliveryConfirmed(ctx, event, ledgerClosedAt)
	case "repay", "InvoiceRepaid":
		err = l.handleInvoiceRepaid(ctx, event, serverKP, ledgerClosedAt)
	case "trigger_default", "InvoiceDefaulted":
		err = l.handleInvoiceDefaulted(ctx, event, serverKP)
	default:
		slog.Debug("Skipping unhandled contract event", "name", eventName)
		return nil
	}

	if err != nil {
		return fmt.Errorf("handler for %s failed: %w", eventName, err)
	}

	// Build structured data for the event log
	logData := map[string]interface{}{}

	// Try to extract invoice_id from topic[1] for events that carry it
	if len(event.Topic) >= 2 && eventName != "create" && eventName != "InvoiceCreated" {
		var topicVal xdr.ScVal
		if err := xdr.SafeUnmarshalBase64(event.Topic[1], &topicVal); err == nil {
			invoiceID := xdrutil.ParseBytes(topicVal)
			if invoiceID != "" {
				logData["invoice_id"] = invoiceID
			}
		}
	}

	// For InvoiceCreated, extract from the value payload
	if eventName == "create" || eventName == "InvoiceCreated" {
		var val xdr.ScVal
		if err := xdr.SafeUnmarshalBase64(event.Value, &val); err == nil {
			if idVal, ok := xdrutil.GetMapVal(val, "id"); ok {
				logData["invoice_id"] = xdrutil.ParseBytes(idVal)
			}
			if issuerVal, ok := xdrutil.GetMapVal(val, "issuer"); ok {
				logData["issuer"] = xdrutil.ParseAddress(issuerVal)
			}
			if buyerVal, ok := xdrutil.GetMapVal(val, "buyer"); ok {
				logData["buyer"] = xdrutil.ParseAddress(buyerVal)
			}
		}
	}

	// Log event in database to prevent double processing
	err = db.LogEvent(ctx, event.ID, event.ContractID, event.Ledger, ledgerClosedAt, eventName, logData)
	if err != nil {
		slog.Error("Failed to log event in DB", "eventId", event.ID, "error", err)
	}

	return nil
}
