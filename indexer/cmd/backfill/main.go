package main

import (
	"flag"
	"fmt"
	"log"

	"trusttrove/indexer/config"
)

func main() {
	fromLedger := flag.Int("from-ledger", 0, "Ledger sequence to start backfilling from")
	toLedger := flag.Int("to-ledger", 0, "Ledger sequence to backfill to")
	flag.Parse()

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	fmt.Printf("Starting backfill from %d to %d using DB: %s\n", *fromLedger, *toLedger, cfg.DatabaseURL)
}
