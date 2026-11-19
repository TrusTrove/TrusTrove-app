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

	"github.com/getsentry/sentry-go"

	"trusttrove/indexer/api"
	"trusttrove/indexer/config"
	"trusttrove/indexer/db"
	"trusttrove/indexer/listener"
	"trusttrove/indexer/webhook"
	"trusttrove/indexer/webhooks"
)

// Process exit statuses. Orchestrators configured with Docker's
// `restart: on-failure` or systemd's `Restart=on-failure` only bring a
// container/service back up when the process leaves a non-zero status behind,
// so a failed listener must never look like a clean stop.
const (
	exitSuccess = 0
	exitFailure = 1
)

// HTTP server timeouts. Go's zero values mean "no limit", which lets a client
// that trickles header or body bytes (slowloris) pin a connection and its
// goroutine indefinitely.
const (
	httpReadHeaderTimeout = 5 * time.Second
	// httpReadTimeout covers headers plus body; request bodies are capped at a
	// few KB (see api.decodeJSONBody), so this is ample for slow clients.
	httpReadTimeout = 15 * time.Second
	// httpWriteTimeout must outlast the slowest handler. POST /invoices builds,
	// simulates and submits a transaction and then polls getTransaction up to
	// 30 times at 1s intervals (api.maxPollAttempts) before responding, so a
	// normal confirmation can take ~30-40s. 90s leaves headroom for Soroban RPC
	// latency on each of those calls.
	httpWriteTimeout = 90 * time.Second
	httpIdleTimeout  = 120 * time.Second
)

// shutdownCause records why the run loop stopped. It is the only input to the
// exit status, which keeps the decision testable without starting the process.
type shutdownCause string

const (
	causeTerminationSignal shutdownCause = "termination signal"
	causeListenerFailure   shutdownCause = "listener failure"
	causeHTTPServerFailure shutdownCause = "http server failure"
)

// exitCodeFor maps a shutdown cause to the exit status the process returns.
// Only an intentional SIGINT/SIGTERM stop is a success; a listener or HTTP
// server failure, and any cause we did not record, exits non-zero so the
// supervisor restarts the indexer.
func exitCodeFor(cause shutdownCause) int {
	if cause == causeTerminationSignal {
		return exitSuccess
	}
	return exitFailure
}

func main() {
	// run() returns the exit status so deferred functions (sentry.Flush, the
	// context cancel) always execute before os.Exit.
	os.Exit(run())
}

func run() int {
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
		return exitFailure
	}

	// Log secret sources for transparency (never log the secrets themselves)
	if cfg.JWTSecretGenerated {
		slog.Info("JWT secret: generated (fallback for development)")
	} else {
		slog.Info("JWT secret: sourced from environment variable")
	}
	if cfg.ServerSeedGenerated {
		slog.Info("Server seed: generated (fallback for development)")
	} else {
		slog.Info("Server seed: sourced from environment variable")
	}

	// Initialize error tracking. With no SENTRY_DSN configured this is a
	// documented no-op: the SDK still initializes but simply discards events.
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              cfg.SentryDSN,
		Environment:      os.Getenv("APP_ENV"),
		AttachStacktrace: true,
	}); err != nil {
		slog.Error("Failed to initialize Sentry", "error", err)
	}
	defer sentry.Flush(2 * time.Second)
	if cfg.SentryDSN != "" {
		slog.Info("Sentry error tracking enabled")
	} else {
		slog.Info("Sentry error tracking disabled (SENTRY_DSN not set)")
	}

	// 2. Initialize DB Connection Pool
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := db.InitDB(ctx, cfg.DatabaseURL); err != nil {
		slog.Error("Failed to initialize database", "error", err)
		return exitFailure
	}
	slog.Info("Database connection and migrations successfully verified")

	// 3. Initialize API Handler and Router
	handler, err := api.NewAPIHandler(cfg)
	if err != nil {
		slog.Error("Failed to initialize API handler", "error", err)
		return exitFailure
	}

	router, stopRouter := api.NewRouter(handler)
	server := &http.Server{
		Addr:              ":" + cfg.APIPort,
		Handler:           router,
		ReadHeaderTimeout: httpReadHeaderTimeout,
		ReadTimeout:       httpReadTimeout,
		WriteTimeout:      httpWriteTimeout,
		IdleTimeout:       httpIdleTimeout,
	}

	// 4. Start Webhook Dispatcher (for enqueueing) and Delivery Worker (for sending) in Background
	webhookDispatcher := webhook.NewDispatcher()
	workerCfg := webhooks.DefaultWorkerConfig()
	workerCfg.Concurrency = cfg.WebhookConcurrency
	webhookDeliveryWorker := webhooks.NewDeliveryWorker(workerCfg)
	var background sync.WaitGroup
	background.Add(2)
	go func() {
		defer background.Done()
		slog.Info("Starting webhook delivery worker...")
		if err := webhookDeliveryWorker.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
			slog.Error("Webhook delivery worker exited with error", "error", err)
		}
	}()

	// 5. Start Event Listener in Background
	eventListener := listener.NewEventListener(cfg, handler.ListenerHealth(), webhookDispatcher)
	listenerErrCh := make(chan error, 1)
	go func() {
		defer background.Done()
		slog.Info("Starting Soroban Event Listener background task...")
		if err := eventListener.Start(ctx); err != nil {
			handler.ListenerHealth().MarkStopped()
			listenerErrCh <- err
		}
	}()

	// 6. Start API Server in Background
	serverErrCh := make(chan error, 1)
	go func() {
		slog.Info("Starting HTTP API Server", "port", cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	// 7. Wait for Termination Signal or Background Component Failure
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	var shutdownOnce sync.Once
	shutdown := func(reason shutdownCause) {
		shutdownOnce.Do(func() {
			slog.Info("Shutting down gracefully", "reason", string(reason))

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
			stopRouter()

			// Do not close the pool while the listener or worker can still be
			// finishing an event/delivery. Bound the drain so shutdown remains
			// safe even if an external dependency is unavailable.
			drained := make(chan struct{})
			go func() {
				background.Wait()
				close(drained)
			}()
			select {
			case <-drained:
				slog.Info("background indexer components drained")
			case <-time.After(5 * time.Second):
				slog.Warn("background indexer drain timed out")
			}

			// Close DB connection pool
			if db.Pool != nil {
				slog.Info("Closing database pool...")
				db.Pool.Close()
				slog.Info("Database pool closed successfully")
			}
		})
	}

	var cause shutdownCause
	select {
	case err := <-listenerErrCh:
		slog.Error("Event listener exited with error", "error", err)
		cause = causeListenerFailure
	case err := <-serverErrCh:
		slog.Error("HTTP API server failed", "error", err)
		cause = causeHTTPServerFailure
	case <-stop:
		cause = causeTerminationSignal
	}

	code := exitCodeFor(cause)
	shutdown(cause)

	slog.Info("TrusTrove Indexer and API server stopped.", "exitCode", code)
	return code
}
