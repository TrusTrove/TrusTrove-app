package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

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

func RunMigration(ctx context.Context) error {
	migrationDir, err := locateMigrationDir()
	if err != nil {
		return err
	}

	if err := ensureSchemaMigrationsTable(ctx); err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	files, err := os.ReadDir(migrationDir)
	if err != nil {
		return fmt.Errorf("failed to read migration directory %s: %w", migrationDir, err)
	}

	migrationFiles := make([]string, 0, len(files))
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		name := file.Name()
		if strings.HasSuffix(name, ".sql") {
			migrationFiles = append(migrationFiles, name)
		}
	}

	sort.Strings(migrationFiles)

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
			tx.Rollback(ctx)
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO schema_migrations (version, applied_at)
			VALUES ($1, $2)
		`, version, time.Now().UTC()); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", filename, err)
		}
	}

	return nil
}

func locateMigrationDir() (string, error) {
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
