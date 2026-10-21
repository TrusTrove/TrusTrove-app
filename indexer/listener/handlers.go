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
	"trusttrove/indexer/soroban"
	"trusttrove/indexer/xdrutil"

	"github.com/jackc/pgx/v5"
	"github.com/stellar/go-stellar-sdk/keypair"
	"github.com/stellar/go-stellar-sdk/xdr"
)

// SyncPoolStats retrieves latest pool statistics from the contract on-chain and updates the database
func SyncPoolStats(ctx context.Context, cfg *config.Config, serverKP *keypair.Full) error {
	slog.Info("Syncing pool stats from chain...")

	// Read stats from pool contract on-chain
	scValResult, err := soroban.ReadContract(ctx, cfg.SorobanRPCURL, cfg.PoolContractID, "get_stats", []xdr.ScVal{}, serverKP)
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

// syncPoolStats refreshes the cached pool statistics after a state-changing
// invoice event. A failure is logged instead of returned: the invoice event
// itself was already indexed, so a transient chain/DB error here must not
// cause the whole event to be retried or dropped.
func (l *EventListener) syncPoolStats(ctx context.Context, eventName string, serverKP *keypair.Full) {
	if err := SyncPoolStats(ctx, l.cfg, serverKP); err != nil {
		slog.Warn("pool stats sync failed", "event", eventName, "error", err)
	}
}

// Event-specific handlers called by the listener loop

func (l *EventListener) handleInvoiceCreated(ctx context.Context, tx db.Querier, event SorobanEvent, ledgerClosedAt int64) error {
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

	inserted, err := db.InsertInvoice(ctx, tx, dbInvoice)
	if err != nil {
		return err
	}

	if inserted {
		slog.Info("Indexed event: InvoiceCreated", "id", id, "issuer", issuer, "faceValue", faceValue)
	} else {
		slog.Info("InvoiceCreated already indexed", "id", id)
	}
	return nil
}

func (l *EventListener) handleInvoiceListed(ctx context.Context, tx db.Querier, event SorobanEvent) error {
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

	err = db.UpdateInvoiceListed(ctx, tx, invoiceID, "Listed", discountBps)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceListed", "id", invoiceID, "discountBps", discountBps)
	return nil
}

func (l *EventListener) handleInvoiceFunded(ctx context.Context, tx db.Querier, event SorobanEvent, serverKP *keypair.Full, ledgerClosedAt int64) error {
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

	err = db.UpdateInvoiceFunded(ctx, tx, invoiceID, "Funded", fundedAmount, ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceFunded", "id", invoiceID, "fundedAmount", fundedAmount)

	// Sync pool stats after funding invoice
	l.syncPoolStats(ctx, "invoice.funded", serverKP)
	return nil
}

func (l *EventListener) handleInvoiceShipped(ctx context.Context, tx db.Querier, event SorobanEvent, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for shipped event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceShipped(ctx, tx, invoiceID, "Active", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceShipped", "id", invoiceID)
	return nil
}

func (l *EventListener) handleDeliveryConfirmed(ctx context.Context, tx db.Querier, event SorobanEvent, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for confirmed event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceDeliveryConfirmed(ctx, tx, invoiceID, "Confirmed", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: DeliveryConfirmed", "id", invoiceID)
	return nil
}

func (l *EventListener) handleInvoiceRepaid(ctx context.Context, tx db.Querier, event SorobanEvent, serverKP *keypair.Full, ledgerClosedAt int64) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for repaid event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceRepaid(ctx, tx, invoiceID, "Repaid", ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceRepaid", "id", invoiceID)

	// Sync pool stats after repayment
	l.syncPoolStats(ctx, "invoice.repaid", serverKP)
	return nil
}

func (l *EventListener) handleInvoiceDefaulted(ctx context.Context, tx db.Querier, event SorobanEvent, serverKP *keypair.Full) error {
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for default event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	err = db.UpdateInvoiceStatus(ctx, tx, invoiceID, "Defaulted")
	if err != nil {
		return err
	}

	slog.Info("Indexed event: InvoiceDefaulted", "id", invoiceID)

	// Sync pool stats after default
	l.syncPoolStats(ctx, "invoice.defaulted", serverKP)
	return nil
}

func (l *EventListener) handleAttestationSubmitted(ctx context.Context, tx db.Querier, event SorobanEvent, ledgerClosedAt int64) error {
	// Topic format: ["AttestationSubmitted" / "submit_attestation", invoice_id_bytes, agent_id_symbol]
	// Value: risk_score (u32)
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for attestation event")
	}

	var idVal xdr.ScVal
	err := xdr.SafeUnmarshalBase64(event.Topic[1], &idVal)
	if err != nil {
		return fmt.Errorf("parse topic invoice_id: %w", err)
	}
	invoiceID := xdrutil.ParseBytes(idVal)

	// Parse agent_id from topic[2] if present
	agentID := ""
	if len(event.Topic) >= 3 {
		var agentVal xdr.ScVal
		err = xdr.SafeUnmarshalBase64(event.Topic[2], &agentVal)
		if err == nil && agentVal.Sym != nil {
			agentID = string(*agentVal.Sym)
		}
	}

	// Parse risk_score from value
	riskScoreBps := 0
	var val xdr.ScVal
	err = xdr.SafeUnmarshalBase64(event.Value, &val)
	if err == nil {
		riskScoreBps = int(xdrutil.ParseU32(val))
	}

	err = db.UpdateInvoiceAttestation(ctx, tx, invoiceID, agentID, "", riskScoreBps, ledgerClosedAt)
	if err != nil {
		return err
	}

	slog.Info("Indexed event: AttestationSubmitted", "id", invoiceID, "agentID", agentID, "riskScoreBps", riskScoreBps)
	return nil
}
func (l *EventListener) handleRegistrationEvent(ctx context.Context, tx db.Querier, event SorobanEvent, ledgerClosedAt int64, eventName string) error {
	// Topic format: ["issuer_registered" / "buyer_registered", account_address]
	if len(event.Topic) < 2 {
		return fmt.Errorf("invalid topic length for registration event")
	}

	var addrVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(event.Topic[1], &addrVal); err != nil {
		return fmt.Errorf("parse registration address topic: %w", err)
	}
	address := xdrutil.ParseAddress(addrVal)
	if address == "" {
		return fmt.Errorf("registration event value: topic address is not a valid address")
	}

	logData := map[string]interface{}{
		"address": address,
	}
	if err := db.LogEvent(ctx, tx, event.ID, event.ContractID, event.Ledger, ledgerClosedAt, eventName, logData); err != nil {
		return err
	}

	slog.Info("Indexed event: registration", "event", eventName, "address", address)
	return nil
}

// --- pool_contract event handlers ------------------------------------------
//
// Pool events change no invoice row, so these handlers only decode the topics
// and value into logData. The handleEvent tail then persists that data to
// events_log and enqueues the webhook deliveries in the same transaction as
// everything else — which is what finally lets the pool.* envelopes the
// webhook package already builds actually fire (issue #878).
//
// Topic/value layouts follow the contract event catalog
// (TrusTrove-contract: docs/EVENTS.md and contracts/pool/src/events.rs). Each
// event accepts both the published symbol (lp_deposited, lp_withdrawn,
// repayment_received, invoice_defaulted) and the function-style name the
// listener historically matched on, so renaming either side cannot silently
// drop the event again.

// handlePoolDeposit parses a pool deposit. Topic format:
// ["deposit"/"lp_deposited", lp_address]; value: (usdc_amount, shares_issued).
func (l *EventListener) handlePoolDeposit(event SorobanEvent, logData map[string]interface{}) error {
	account, amount, shares, err := parsePoolLPEvent(event, "deposit")
	if err != nil {
		return err
	}
	logData["account"] = account
	logData["amount"] = amount
	logData["shares"] = shares
	slog.Info("Indexed event: PoolDeposit", "account", account, "amount", amount, "shares", shares)
	return nil
}

// handlePoolWithdrawal parses a pool withdrawal. Topic format:
// ["withdraw"/"lp_withdrawn", lp_address]; value: (usdc_amount, shares_burned).
func (l *EventListener) handlePoolWithdrawal(event SorobanEvent, logData map[string]interface{}) error {
	account, amount, shares, err := parsePoolLPEvent(event, "withdraw")
	if err != nil {
		return err
	}
	logData["account"] = account
	logData["amount"] = amount
	logData["shares"] = shares
	slog.Info("Indexed event: PoolWithdrawal", "account", account, "amount", amount, "shares", shares)
	return nil
}

// handlePoolYieldDistributed parses the yield-distribution event emitted by
// receive_repayment(). Topic format: ["receive_repayment"/
// "repayment_received", invoice_id]; value: (amount, lp_yield[,
// protocol_cut]). The third tuple element is deliberately ignored — the
// pool.yield_distributed envelope has no field for the protocol's cut.
// invoice_id in topic[1] is picked up by the handleEvent tail.
func (l *EventListener) handlePoolYieldDistributed(event SorobanEvent, logData map[string]interface{}) error {
	var val xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(event.Value, &val); err != nil {
		return fmt.Errorf("parse pool yield value: %w", err)
	}
	amount, yieldAmount := parseU128Pair(val)
	logData["amount"] = amount
	logData["yield_amount"] = yieldAmount
	slog.Info("Indexed event: PoolYieldDistributed", "amount", amount, "yield", yieldAmount)
	return nil
}

// handlePoolDefault parses the pool's default-handling event: handle_default()
// publishes "invoice_defaulted" with the pool's loss. Topic format:
// ["invoice_defaulted", invoice_id]; value: u128 loss amount. invoice_id in
// topic[1] is picked up by the handleEvent tail.
func (l *EventListener) handlePoolDefault(event SorobanEvent, logData map[string]interface{}) error {
	var val xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(event.Value, &val); err != nil {
		return fmt.Errorf("parse pool default value: %w", err)
	}
	loss, _ := parseU128Pair(val)
	logData["amount"] = loss
	slog.Info("Indexed event: PoolDefaultHandled", "loss", loss)
	return nil
}

// parsePoolLPEvent decodes the shape the pool's deposit and withdraw events
// share: topic[1] is the LP address and the value is a 2-tuple of u128s
// (amount, shares issued/burned).
func parsePoolLPEvent(event SorobanEvent, kind string) (account, amount, shares string, err error) {
	if len(event.Topic) < 2 {
		return "", "", "", fmt.Errorf("invalid topic length for pool %s event", kind)
	}
	var addrVal xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(event.Topic[1], &addrVal); err != nil {
		return "", "", "", fmt.Errorf("parse pool %s lp topic: %w", kind, err)
	}
	account = xdrutil.ParseAddress(addrVal)
	if account == "" {
		return "", "", "", fmt.Errorf("pool %s event: topic lp address is not a valid address", kind)
	}
	var val xdr.ScVal
	if err := xdr.SafeUnmarshalBase64(event.Value, &val); err != nil {
		return "", "", "", fmt.Errorf("parse pool %s value: %w", kind, err)
	}
	amount, shares = parseU128Pair(val)
	return account, amount, shares, nil
}

// parseU128Pair reads the (primary, secondary) u128 pair the pool contract
// publishes as an ScVec tuple. A scalar u128 (primary only) and a missing
// secondary element are tolerated: xdrutil returns "0"/"" for anything that
// is not a u128, so an event whose contract reported fewer fields still
// indexes instead of wedging the poller on a retry loop.
func parseU128Pair(val xdr.ScVal) (string, string) {
	if val.Type != xdr.ScValTypeScvVec || val.Vec == nil || *val.Vec == nil {
		return xdrutil.ParseU128(val), ""
	}
	elems := **val.Vec
	primary := ""
	if len(elems) > 0 {
		primary = xdrutil.ParseU128(elems[0])
	}
	secondary := ""
	if len(elems) > 1 {
		secondary = xdrutil.ParseU128(elems[1])
	}
	return primary, secondary
}

// handleEvent applies one contract event atomically. The event's state
// change (invoice insert/update), its events_log row — which is what marks
// the event as processed for de-duplication — and its webhook_deliveries
// rows are all written in a single transaction (issue #925). Any failure
// rolls the whole unit of work back and is returned to the caller, so the
// poller retries the ledger instead of advancing past a half-processed event.
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

	return db.WithTx(ctx, func(tx pgx.Tx) error {
		// logData is the structured payload persisted with the event in
		// events_log and handed to the webhook dispatcher. Pool handlers fill
		// it while parsing; for invoice events the keys are extracted after
		// the switch below.
		logData := map[string]interface{}{}

		switch eventName {
		case "create", "InvoiceCreated":
			err = l.handleInvoiceCreated(ctx, tx, event, ledgerClosedAt)
		case "list_for_financing", "InvoiceListed":
			err = l.handleInvoiceListed(ctx, tx, event)
		case "fund_invoice", "InvoiceFunded":
			err = l.handleInvoiceFunded(ctx, tx, event, serverKP, ledgerClosedAt)
		case "mark_shipped", "InvoiceShipped":
			err = l.handleInvoiceShipped(ctx, tx, event, ledgerClosedAt)
		case "confirm_delivery", "DeliveryConfirmed":
			err = l.handleDeliveryConfirmed(ctx, tx, event, ledgerClosedAt)
		case "repay", "InvoiceRepaid":
			err = l.handleInvoiceRepaid(ctx, tx, event, serverKP, ledgerClosedAt)
		case "trigger_default", "InvoiceDefaulted":
			err = l.handleInvoiceDefaulted(ctx, tx, event, serverKP)
		case "submit_attestation", "AttestationSubmitted":
			err = l.handleAttestationSubmitted(ctx, tx, event, ledgerClosedAt)
		case "issuer_registered", "buyer_registered":
			// Registry contract registrations are logged (and de-duplicated)
			// via events_log inside this transaction but have no invoice
			// fan-out, so they short-circuit the tail below.
			return l.handleRegistrationEvent(ctx, tx, event, ledgerClosedAt, eventName)
		case "deposit", "lp_deposited":
			err = l.handlePoolDeposit(event, logData)
		case "withdraw", "lp_withdrawn":
			err = l.handlePoolWithdrawal(event, logData)
		case "receive_repayment", "repayment_received", "yield_distribution":
			err = l.handlePoolYieldDistributed(event, logData)
		case "handle_default", "invoice_defaulted":
			err = l.handlePoolDefault(event, logData)
		default:
			slog.Debug("Skipping unhandled contract event", "name", eventName)
			return nil
		}
		if err != nil {
			return fmt.Errorf("handler for %s failed: %w", eventName, err)
		}

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

		// Mark the event processed in the same transaction as the state
		// change: a failed insert must roll the state change back (and vice
		// versa) so the poller re-processes a consistent unit of work instead
		// of advancing past a half-applied event.
		if err := db.LogEvent(ctx, tx, event.ID, event.ContractID, event.Ledger, ledgerClosedAt, eventName, logData); err != nil {
			return fmt.Errorf("log event: %w", err)
		}

		// Enqueue webhook deliveries on the same transaction (issue #925):
		// the fan-out either commits with the event or is retried with it.
		// Events the switch above does not recognise never reach this point —
		// the default branch skips them before any row is written.
		if l.dispatcher != nil {
			if err := l.dispatcher.EnqueueDeliveries(ctx, tx, eventName, l.webhookDispatchData(ctx, tx, eventName, event, ledgerClosedAt, logData)); err != nil {
				return fmt.Errorf("enqueue webhook deliveries: %w", err)
			}
		}

		return nil
	})
}

// webhookDispatchData builds the data map webhook.Dispatcher turns into an
// envelope. The invoice fields come from the row the handler just wrote (read
// back through tx so an in-flight transaction sees its own writes) rather
// than from the event, so every documented payload field — status,
// face_value, due_date and the lifecycle timestamps — is populated.
func (l *EventListener) webhookDispatchData(ctx context.Context, tx db.Querier, eventName string, event SorobanEvent, ledgerClosedAt int64, logData map[string]interface{}) map[string]interface{} {
	data := make(map[string]interface{}, len(logData)+16)
	for k, v := range logData {
		data[k] = v
	}
	data["event_id"] = event.ID
	data["ledger"] = event.Ledger
	data["contract_id"] = event.ContractID
	// occurred_at in the envelope is derived from this, not from wall-clock
	// time, so a re-indexed historical event keeps its on-chain timestamp.
	data["ledger_closed_at"] = ledgerClosedAt

	invoiceID, _ := data["invoice_id"].(string)
	if invoiceID == "" {
		return data
	}

	invoice, err := db.GetInvoiceByID(ctx, tx, invoiceID)
	if err != nil {
		slog.Error("Failed to load invoice for webhook payload", "invoice_id", invoiceID, "error", err)
	} else if invoice != nil {
		addInvoiceFields(data, invoice)
	}

	return data
}

// addInvoiceFields copies the persisted invoice columns into the dispatch data
// under the keys webhook.BuildEnvelope reads.
func addInvoiceFields(data map[string]interface{}, invoice *db.DbInvoice) {
	data["issuer"] = invoice.Issuer
	data["buyer"] = invoice.Buyer
	data["face_value"] = invoice.FaceValue
	data["discount_bps"] = invoice.DiscountBps
	data["funded_amount"] = invoice.FundedAmount
	data["due_date"] = invoice.DueDate
	data["status"] = invoice.Status
	data["created_at"] = invoice.CreatedAt
	data["funded_at"] = invoice.FundedAt
	data["shipped_at"] = invoice.ShippedAt
	data["buyer_confirmed_at"] = invoice.BuyerConfirmedAt
	data["repaid_at"] = invoice.RepaidAt
}
