package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/listener"
)

func main() {
	fromLedger := flag.Int("from-ledger", 0, "Start ledger sequence for backfilling events")
	toLedger := flag.Int("to-ledger", 0, "End ledger sequence for backfilling events (inclusive). If 0, fetches up to the current chain tip.")
	updateCheckpoint := flag.Bool("update-checkpoint", false, "DANGER: Update the live indexer's checkpoint to the backfilled range. Do not use if the live indexer is running.")
	flag.Parse()

	if *fromLedger <= 0 {
		fmt.Println("Error: --from-ledger must be > 0")
		flag.Usage()
		os.Exit(1)
	}

	cfg, err := config.LoadConfig()
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	if err := db.InitDB(context.Background(), cfg.DatabaseURL); err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
		<-sig
		slog.Info("Shutting down backfill...")
		cancel()
	}()

	slog.Info("Starting backfill", "fromLedger", *fromLedger, "toLedger", *toLedger, "updateCheckpoint", *updateCheckpoint)

	// Note: Backfill does NOT overwrite the live listener's checkpoint by default
	// This ensures we can't accidentally rewind or fast-forward the running indexer.

	health := api.NewListenerHealth()
	health.MarkStarted()

	evListener := listener.NewEventListener(cfg, health)

	// We want to override getCheckpointFn to just not fail, but we aren't using Start().
	// We call FetchAndProcessRange directly.
	// Let's create a loop to fetch in pages and log progress.

	currentLedger := int32(*fromLedger)
	targetLedger := int32(*toLedger)

	for {
		if targetLedger > 0 && currentLedger > targetLedger {
			slog.Info("Backfill complete (reached target ledger)", "currentLedger", currentLedger, "targetLedger", targetLedger)
			break
		}

		select {
		case <-ctx.Done():
			slog.Info("Backfill aborted")
			return
		default:
		}

		slog.Info("Backfilling range", "startLedger", currentLedger, "endLedger", targetLedger)
		nextLedger, err := evListener.FetchAndProcessRange(ctx, currentLedger, targetLedger)
		if err != nil {
			slog.Error("Error processing range", "currentLedger", currentLedger, "error", err)
			os.Exit(1)
		}

		if nextLedger == currentLedger {
			slog.Info("Backfill caught up to chain tip", "ledger", currentLedger)
			if targetLedger == 0 {
				break
			}
			// Wait a bit before polling if we haven't reached target yet
			time.Sleep(2 * time.Second)
		} else {
			slog.Info("Progress update", "processedUpTo", nextLedger-1)
			if *updateCheckpoint {
				if err := db.UpsertCheckpoint(ctx, nextLedger-1); err != nil {
					slog.Error("Failed to update checkpoint", "ledger", nextLedger-1, "error", err)
				}
			}
			currentLedger = nextLedger
		}
	}
	slog.Info("Backfill successfully finished")
}
