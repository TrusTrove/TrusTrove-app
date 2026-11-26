package main

import (
	"context"
	"errors"
	"fmt"
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

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)
	os.Exit(runMain())
}

// runMain returns before os.Exit so signal handling and Sentry can clean up.
func runMain() int {
	slog.Info("Starting TrusTrove Indexer and API server...")

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
		Environment:      cfg.AppEnv,
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	code := exitSuccess
	if err := run(ctx, cfg); err != nil {
		slog.Error("Indexer failed", "error", err)
		code = exitFailure
	}
	slog.Info("TrusTrove Indexer and API server stopped.", "exitCode", code)
	return code
}

func run(ctx context.Context, cfg *config.Config) error {
	if err := db.InitDB(ctx, cfg.DatabaseURL); err != nil {
		if errors.Is(err, ctx.Err()) {
			return nil
		}
		return fmt.Errorf("initialize database: %w", err)
	}
	slog.Info("Database connection and migrations successfully verified")
	defer db.Pool.Close()

	handler, err := api.NewAPIHandler(cfg)
	if err != nil {
		return fmt.Errorf("initialize API handler: %w", err)
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

	workerCfg := webhooks.DefaultWorkerConfig()
	workerCfg.Concurrency = cfg.WebhookConcurrency
	worker := webhooks.NewDeliveryWorker(workerCfg)
	health := handler.ListenerHealth()
	eventListener := listener.NewEventListener(cfg, health, webhook.NewDispatcher())

	services := indexerServices{
		server:      server,
		serveHTTP:   (*http.Server).ListenAndServe,
		startWorker: worker.Start,
		startListener: func(ctx context.Context) error {
			defer health.MarkStopped()
			return eventListener.Start(ctx)
		},
		stopRouter: stopRouter,
	}
	return services.run(ctx)
}

type indexerServices struct {
	server        *http.Server
	serveHTTP     func(*http.Server) error
	startWorker   func(context.Context) error
	startListener func(context.Context) error
	stopRouter    func()
}

func (s indexerServices) run(parent context.Context) error {
	ctx, cancel := context.WithCancel(parent)
	defer cancel()

	listenerErrCh := make(chan error, 1)
	serverErrCh := make(chan error, 1)
	var background sync.WaitGroup
	background.Add(3)
	go func() {
		defer background.Done()
		slog.Info("Starting webhook delivery worker...")
		if err := s.startWorker(ctx); err != nil && ctx.Err() == nil {
			slog.Error("Webhook delivery worker exited with error", "error", err)
		}
	}()
	go func() {
		defer background.Done()
		slog.Info("Starting Soroban Event Listener background task...")
		if err := s.startListener(ctx); err != nil && ctx.Err() == nil {
			listenerErrCh <- err
		}
	}()
	go func() {
		defer background.Done()
		slog.Info("Starting HTTP API Server", "addr", s.server.Addr)
		if err := s.serveHTTP(s.server); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	var runErr error
	select {
	case <-ctx.Done():
	case err := <-listenerErrCh:
		runErr = fmt.Errorf("event listener failed: %w", err)
	case err := <-serverErrCh:
		runErr = fmt.Errorf("HTTP API server failed: %w", err)
	}

	slog.Info("Shutting down gracefully")
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := s.server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP API server graceful shutdown failed", "error", err)
	} else {
		slog.Info("HTTP API server successfully shut down")
	}
	s.stopRouter()

	// Give the listener and worker time to finish before run closes the pool.
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
	return runErr
}
