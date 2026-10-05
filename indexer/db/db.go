package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// Querier is the minimal SQL-execution surface shared by *pgxpool.Pool and
// pgx.Tx. The invoice writers, the event-log helper and the webhook delivery
// insert accept it so the listener can run every statement for one event
// against either the shared pool (statement-per-statement, the historical
// behavior) or a single transaction (the current behavior). QueryRow is
// included alongside Exec because the listener also reads back the invoice
// row it just wrote inside the same transaction to build webhook payloads.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// WithTx runs fn inside a single database transaction on the shared pool.
// If fn returns an error the transaction is rolled back and that error is
// returned to the caller; a failed commit is rolled back as well. This is the
// primitive the event listener uses to commit an event's state change, its
// events_log row and its webhook_deliveries rows as one unit.
func WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	if Pool == nil {
		return fmt.Errorf("db: WithTx: database pool not initialized")
	}

	tx, err := Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db: begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		rollbackOnError(ctx, tx)
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		rollbackOnError(ctx, tx)
		return fmt.Errorf("db: commit transaction: %w", err)
	}
	return nil
}

func InitDB(ctx context.Context, databaseURL string) error {
	var err error
	Pool, err = pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("db: failed to connect to database: %w", err)
	}

	// Ping database to confirm connection
	if err := Pool.Ping(ctx); err != nil {
		return fmt.Errorf("db: failed to ping database: %w", err)
	}

	// Run pending migrations
	if err := RunMigration(ctx); err != nil {
		return fmt.Errorf("db: failed to run migrations: %w", err)
	}

	return nil
}

// migrationLockID is an arbitrary, fixed key for a Postgres advisory lock
// that serializes migration application across concurrent callers (e.g.
// multiple indexer replicas starting up at once, or — as surfaced by CI —
// multiple Go test binaries that each call InitDB against the same
// database). Without it, two callers can both see a migration as
// not-yet-applied and race to run the same ALTER TABLE/CREATE TABLE,
// producing an "already exists" error instead of one waiting for the other.
const migrationLockID = 847362910123

func RunMigration(ctx context.Context) error {
	migrationDir, err := locateMigrationDir()
	if err != nil {
		return err
	}

	// Read and validate the filenames before touching the database, so a
	// duplicate migration number fails fast without applying anything.
	files, err := os.ReadDir(migrationDir)
	if err != nil {
		return fmt.Errorf("failed to read migration directory %s: %w", migrationDir, err)
	}

	names := make([]string, 0, len(files))
	for _, file := range files {
		if !file.IsDir() {
			names = append(names, file.Name())
		}
	}

	migrationFiles, err := validateMigrationNames(names)
	if err != nil {
		return fmt.Errorf("migration directory %s: %w", migrationDir, err)
	}

	lockConn, err := Pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire connection for migration lock: %w", err)
	}
	defer lockConn.Release()

	if _, err := lockConn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("failed to acquire migration advisory lock: %w", err)
	}
	defer lockConn.Exec(ctx, "SELECT pg_advisory_unlock($1)", migrationLockID)

	if err := ensureSchemaMigrationsTable(ctx); err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	applied, err := loadAppliedMigrations(ctx)
	if err != nil {
		return fmt.Errorf("failed to load applied migrations: %w", err)
	}

	for _, filename := range migrationFiles {
		version := strings.TrimSuffix(filename, ".sql")
		if applied[version] {
			continue
		}

		migrationPath := filepath.Join(migrationDir, filename)
		migrationBytes, err := os.ReadFile(migrationPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", migrationPath, err)
		}

		tx, err := Pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin migration transaction: %w", err)
		}

		if _, err := tx.Exec(ctx, string(migrationBytes)); err != nil {
			rollbackOnError(ctx, tx)
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES ($1, $2)
		`, version, time.Now().UTC()); err != nil {
			rollbackOnError(ctx, tx)
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", filename, err)
		}
	}

	return nil
}

func locateMigrationDir() (string, error) {
	// 1. Check INDEXER_MIGRATIONS_DIR env var first
	if envDir := os.Getenv("INDEXER_MIGRATIONS_DIR"); envDir != "" {
		info, err := os.Stat(envDir)
		if err == nil && info.IsDir() {
			return envDir, nil
		}
		return "", fmt.Errorf("INDEXER_MIGRATIONS_DIR set to %s but not a valid directory", envDir)
	}

	// 2. Resolve from executable location
	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		execRelativePath := filepath.Join(execDir, "..", "db", "migrations")
		info, err := os.Stat(execRelativePath)
		if err == nil && info.IsDir() {
			return execRelativePath, nil
		}
	}

	// 3. Fall back to relative paths from current working directory
	candidates := []string{
		filepath.Join("db", "migrations"),
		filepath.Join("indexer", "db", "migrations"),
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("failed to locate migrations directory")
}

func ensureSchemaMigrationsTable(ctx context.Context) error {
	_, err := Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`)
	return err
}

func loadAppliedMigrations(ctx context.Context) (map[string]bool, error) {
	rows, err := Pool.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

// rollbackOnError rolls back the transaction and logs any unexpected error.
// It ignores pgx.ErrTxClosed since that is expected when the transaction is
// already closed.
func rollbackOnError(ctx context.Context, tx pgx.Tx) {
	if err := tx.Rollback(ctx); err != nil && !errors.Is(err, pgx.ErrTxClosed) {
		slog.Warn("transaction rollback failed", "error", err)
	}
}
