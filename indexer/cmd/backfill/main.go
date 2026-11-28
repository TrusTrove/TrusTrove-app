package main

import (
	"context"
	"flag"
	"log"
	"log/slog"

	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/listener"
)

func main() {
	fromLedger := flag.Int("from-ledger", 0, "Ledger sequence to start backfilling from")
	toLedger := flag.Int("to-ledger", 0, "Ledger sequence to backfill to")
	flag.Parse()

	if *fromLedger <= 0 || *toLedger <= 0 {
		log.Fatal("invalid ledger flags: --from-ledger and --to-ledger must be positive")
	}
	if *fromLedger > *toLedger {
		log.Fatal("invalid ledger flags: --from-ledger must not be greater than --to-ledger")
	}
	if *fromLedger > 1<<31-1 || *toLedger > 1<<31-1 {
		log.Fatal("invalid ledger flags: ledger values must fit in a signed 32-bit integer")
	}

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := db.InitDB(ctx, cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Pool.Close()

	slog.Info("Starting backfill", "fromLedger", *fromLedger, "toLedger", *toLedger)
	eventListener := listener.NewEventListener(cfg, nil, nil)
	if err := eventListener.BackfillRange(ctx, int32(*fromLedger), int32(*toLedger)); err != nil {
		log.Fatalf("Backfill failed: %v", err)
	}
	slog.Info("Backfill complete", "fromLedger", *fromLedger, "toLedger", *toLedger)
}
