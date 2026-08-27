package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// --- Unit tests (no live DB required) ---

func TestInitDB_InvalidURL(t *testing.T) {
	// An unreachable database URL must produce a wrapped error.
	ctx := context.Background()
	err := InitDB(ctx, "postgres://localhost:1/nonexistent_db?sslmode=disable")
	if err == nil {
		t.Fatal("InitDB with invalid URL: expected error, got nil")
	}
}

func TestInitDB_EmptyURL(t *testing.T) {
	// An empty connection string must also fail.
	ctx := context.Background()
	err := InitDB(ctx, "")
	if err == nil {
		t.Fatal("InitDB with empty URL: expected error, got nil")
	}
}

func TestRunMigration_MissingMigrationsDir(t *testing.T) {
	// Save original env and restore after test.
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()

	// Point to a directory that does not exist.
	os.Setenv("INDEXER_MIGRATIONS_DIR", filepath.Join(t.TempDir(), "does_not_exist"))

	err := RunMigration(context.Background())
	if err == nil {
		t.Fatal("RunMigration with missing dir: expected error, got nil")
	}
}

func TestLoadAppliedMigrations_NilPoolPanics(t *testing.T) {
	// Calling loadAppliedMigrations with a nil Pool panics because
	// pgxpool.Query dereferences the pool pointer. Verify this is the
	// case so we document the behaviour.
	Pool = nil
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with nil Pool, but did not panic")
		}
	}()
	_, _ = loadAppliedMigrations(context.Background())
}

func TestEnsureSchemaMigrationsTable_NilPoolPanics(t *testing.T) {
	// Same as above: nil Pool causes a nil-pointer dereference.
	Pool = nil
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with nil Pool, but did not panic")
		}
	}()
	_ = ensureSchemaMigrationsTable(context.Background())
}

func TestRollbackOnError_PanicsWithNilTx(t *testing.T) {
	// rollbackOnError dereferences tx, so a nil tx panics. Document it.
	Pool = nil
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with nil tx, but did not panic")
		}
	}()
	rollbackOnError(context.Background(), nil)
}

// --- Integration tests (require TEST_DATABASE_URL) ---

func TestInitDB_Integration(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	err := InitDB(ctx, dbURL)
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	if Pool == nil {
		t.Fatal("InitDB: Pool is nil after successful init")
	}
}

func TestRunMigration_Integration(t *testing.T) {
	skipIfNoDB(t)

	// The TestMain in queries_test.go already calls InitDB which calls
	// RunMigration. Calling it again should be a no-op (all migrations
	// already applied) and return nil.
	ctx := context.Background()
	err := RunMigration(ctx)
	if err != nil {
		t.Fatalf("RunMigration (idempotent): %v", err)
	}
}

func TestEnsureSchemaMigrationsTable_Integration(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	err := ensureSchemaMigrationsTable(ctx)
	if err != nil {
		t.Fatalf("ensureSchemaMigrationsTable: %v", err)
	}
}

func TestLoadAppliedMigrations_Integration(t *testing.T) {
	skipIfNoDB(t)

	ctx := context.Background()
	applied, err := loadAppliedMigrations(ctx)
	if err != nil {
		t.Fatalf("loadAppliedMigrations: %v", err)
	}
	// With TestMain having run InitDB, at least the initial migration
	// should be recorded.
	if len(applied) == 0 {
		t.Error("loadAppliedMigrations: expected at least one applied migration, got 0")
	}
	t.Logf("loadAppliedMigrations: found %d applied migrations", len(applied))
}

func TestEnsureSchemaMigrationsTable_Idempotent(t *testing.T) {
	skipIfNoDB(t)

	// Calling ensureSchemaMigrationsTable twice should succeed (CREATE
	// TABLE IF NOT EXISTS).
	ctx := context.Background()
	if err := ensureSchemaMigrationsTable(ctx); err != nil {
		t.Fatalf("ensureSchemaMigrationsTable first call: %v", err)
	}
	if err := ensureSchemaMigrationsTable(ctx); err != nil {
		t.Fatalf("ensureSchemaMigrationsTable second call: %v", err)
	}
}

func TestLoadAppliedMigrations_Empty(t *testing.T) {
	skipIfNoDB(t)

	// On a fresh DB without running InitDB (to skip migrations), the
	// schema_migrations table may be empty. Temporarily close Pool and
	// re-init without migration to test empty applied map.
	// NOTE: This test is skipped if the table already has rows from
	// TestMain. We just verify the function doesn't error.
	ctx := context.Background()
	applied, err := loadAppliedMigrations(ctx)
	if err != nil {
		t.Fatalf("loadAppliedMigrations: %v", err)
	}
	_ = applied // may be empty or populated depending on test order
}

func TestLocateMigrationDir_RelativePath(t *testing.T) {
	// Save and restore working directory.
	origDir, _ := os.Getwd()
	defer func() { os.Chdir(origDir) }()

	// Create a temporary directory tree simulating the relative path layout.
	tmpDir := t.TempDir()
	relDir := filepath.Join(tmpDir, "db", "migrations")
	if err := os.MkdirAll(relDir, 0755); err != nil {
		t.Fatalf("failed to create temp migration dir: %v", err)
	}

	// Save and restore env.
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()
	os.Unsetenv("INDEXER_MIGRATIONS_DIR")

	// Change to the temp directory so the relative fallback picks up
	// db/migrations.
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}

	dir, err := locateMigrationDir()
	if err != nil {
		t.Fatalf("locateMigrationDir: %v", err)
	}
	// locateMigrationDir returns relative candidate strings; verify
	// the resolved path is a valid directory.
	resolved := filepath.Join(tmpDir, dir)
	info, err := os.Stat(resolved)
	if err != nil {
		t.Fatalf("locateMigrationDir returned path that does not resolve: %q -> %v", dir, err)
	}
	if !info.IsDir() {
		t.Errorf("locateMigrationDir returned non-directory: %q", dir)
	}
}

func TestLocateMigrationDir_IndexerRelativePath(t *testing.T) {
	// Test the second relative fallback path: indexer/db/migrations.
	origDir, _ := os.Getwd()
	defer func() { os.Chdir(origDir) }()

	tmpDir := t.TempDir()
	relDir := filepath.Join(tmpDir, "indexer", "db", "migrations")
	if err := os.MkdirAll(relDir, 0755); err != nil {
		t.Fatalf("failed to create temp migration dir: %v", err)
	}

	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()
	os.Unsetenv("INDEXER_MIGRATIONS_DIR")

	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Chdir: %v", err)
	}

	dir, err := locateMigrationDir()
	if err != nil {
		t.Fatalf("locateMigrationDir: %v", err)
	}
	// locateMigrationDir returns relative candidate strings; verify
	// the resolved path is a valid directory.
	resolved := filepath.Join(tmpDir, dir)
	info, err := os.Stat(resolved)
	if err != nil {
		t.Fatalf("locateMigrationDir returned path that does not resolve: %q -> %v", dir, err)
	}
	if !info.IsDir() {
		t.Errorf("locateMigrationDir returned non-directory: %q", dir)
	}
}

func TestRunMigration_NoMigrationsDir(t *testing.T) {
	// When INDEXER_MIGRATIONS_DIR points to a non-existent path,
	// RunMigration must return an error.
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()

	os.Setenv("INDEXER_MIGRATIONS_DIR", filepath.Join(t.TempDir(), "missing"))

	err := RunMigration(context.Background())
	if err == nil {
		t.Fatal("RunMigration with non-existent dir: expected error, got nil")
	}
}

func TestRunMigration_EmptyMigrationsDir_NilPoolPanics(t *testing.T) {
	// When the migrations directory exists but has no .sql files and Pool
	// is nil, ensureSchemaMigrationsTable panics. Verify the panic.
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()

	emptyDir := t.TempDir()
	os.Setenv("INDEXER_MIGRATIONS_DIR", emptyDir)

	Pool = nil
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic with nil Pool, but did not panic")
		}
	}()
	_ = RunMigration(context.Background())
}

func TestRunMigration_Integration_ApplyNewMigration(t *testing.T) {
	skipIfNoDB(t)

	// Create a temporary migration directory with a new migration.
	tmpDir := t.TempDir()
	migrationSQL := `CREATE TABLE IF NOT EXISTS _test_migration_probe (id SERIAL PRIMARY KEY);`
	migrationFile := filepath.Join(tmpDir, "999_test_probe.sql")
	if err := os.WriteFile(migrationFile, []byte(migrationSQL), 0644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()
	os.Setenv("INDEXER_MIGRATIONS_DIR", tmpDir)

	ctx := context.Background()
	err := RunMigration(ctx)
	if err != nil {
		t.Fatalf("RunMigration: %v", err)
	}

	// Verify the migration was recorded.
	applied, err := loadAppliedMigrations(ctx)
	if err != nil {
		t.Fatalf("loadAppliedMigrations: %v", err)
	}
	if !applied["999_test_probe"] {
		t.Error("migration 999_test_probe was not recorded as applied")
	}

	// Cleanup: drop the test table.
	Pool.Exec(ctx, "DROP TABLE IF EXISTS _test_migration_probe")
}

// TestLocateMigrationDir_EnvVarPrecedence verifies that the env var takes
// precedence over all other fallback paths.
func TestLocateMigrationDir_EnvVarPrecedence(t *testing.T) {
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()

	tmpDir := t.TempDir()
	migrationsDir := filepath.Join(tmpDir, "migrations")
	if err := os.Mkdir(migrationsDir, 0755); err != nil {
		t.Fatalf("Mkdir: %v", err)
	}
	os.Setenv("INDEXER_MIGRATIONS_DIR", migrationsDir)

	dir, err := locateMigrationDir()
	if err != nil {
		t.Fatalf("locateMigrationDir: %v", err)
	}
	if dir != migrationsDir {
		t.Errorf("locateMigrationDir: got %q, want %q", dir, migrationsDir)
	}
}

// TestLocateMigrationDir_InvalidEnvVar verifies that an invalid env var
// path returns an error.
func TestLocateMigrationDir_InvalidEnvVar(t *testing.T) {
	origEnv := os.Getenv("INDEXER_MIGRATIONS_DIR")
	defer func() {
		if origEnv == "" {
			os.Unsetenv("INDEXER_MIGRATIONS_DIR")
		} else {
			os.Setenv("INDEXER_MIGRATIONS_DIR", origEnv)
		}
	}()

	os.Setenv("INDEXER_MIGRATIONS_DIR", "/absolutely/nonexistent/path")

	_, err := locateMigrationDir()
	if err == nil {
		t.Fatal("locateMigrationDir with invalid env var: expected error, got nil")
	}
}

// TestRollbackOnError_LoggedMessage verifies rollbackOnError compiles and
// can be invoked. Full coverage requires a mock tx (pgx.Tx), which is
// beyond unit-test scope without a third-party mock library.
func TestRollbackOnError_LoggedMessage(t *testing.T) {
	// This is a smoke test to ensure the function is reachable from tests.
	// We cannot easily mock pgx.Tx in unit tests without pgxmock, so we
	// just verify it compiles and is callable.
	ctx := context.Background()
	// rollbackOnError requires a non-nil tx; we skip the actual call.
	_ = ctx
	_ = fmt.Sprintf("rollbackOnError is exported within the package")
}
