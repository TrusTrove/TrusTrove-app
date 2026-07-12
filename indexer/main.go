package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/listener"
)

func main() {
	// Configure default slog JSON logging format
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting TrusTrove Indexer and API server...")

	// 1. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// 2. Initialize DB Connection Pool
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := db.InitDB(ctx, cfg.DatabaseURL); err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}
	slog.Info("Database connection and migrations successfully verified")

	// 3. Initialize API Handler and Router
	handler, err := api.NewAPIHandler(cfg)
	if err != nil {
		slog.Error("Failed to initialize API handler", "error", err)
		os.Exit(1)
	}

	router := api.NewRouter(handler)
	server := &http.Server{
		Addr:    ":" + cfg.APIPort,
		Handler: router,
	}

	// 4. Start Event Listener in Background
	eventListener := listener.NewEventListener(cfg, handler.ListenerHealth())
	listenerErrCh := make(chan error, 1)
	go func() {
		slog.Info("Starting Soroban Event Listener background task...")
		if err := eventListener.Start(ctx); err != nil {
			handler.ListenerHealth().MarkStopped()
			listenerErrCh <- err
		}
	}()

	// 5. Start API Server in Background
	go func() {
		slog.Info("Starting HTTP API Server", "port", cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP API server failed", "error", err)
			os.Exit(1)
		}
	}()

	// 6. Wait for Termination Signal or Listener Failure
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	var shutdownOnce sync.Once
	shutdown := func(reason string) {
		shutdownOnce.Do(func() {
			slog.Info("Shutting down gracefully", "reason", reason)

			// Cancel context to stop listener
			cancel()

			// Shutdown HTTP Server
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer shutdownCancel()

			if err := server.Shutdown(shutdownCtx); err != nil {
				slog.Error("HTTP API server graceful shutdown failed", "error", err)
			} else {
				slog.Info("HTTP API server successfully shut down")
			}

			// Close DB connection pool
			if db.Pool != nil {
				slog.Info("Closing database pool...")
				db.Pool.Close()
				slog.Info("Database pool closed successfully")
			}
		})
	}

	select {
	case err := <-listenerErrCh:
		slog.Error("Event listener exited with error", "error", err)
		shutdown("listener failure")
	case <-stop:
		shutdown("termination signal")
	}

	slog.Info("TrusTrove Indexer and API server stopped.")
}
