package db

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

// --- Repository checks (no live DB required) ---

// migrationsDirNames lists the files in this package's migrations directory.
func migrationsDirNames(t *testing.T) []string {
	t.Helper()
	entries, err := os.ReadDir("migrations")
	if err != nil {
		t.Fatalf("read migrations directory: %v", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			names = append(names, entry.Name())
		}
	}
	return names
}

// TestMigrationsDir_NamesAreValid guards indexer/db/migrations itself: every
// migration is NNN_lowercase_name.sql, no number is used twice (apart from
// knownDuplicateMigrations), and the numbers run 001, 002, ... with no gaps.
func TestMigrationsDir_NamesAreValid(t *testing.T) {
	migrations, err := validateMigrationNames(migrationsDirNames(t))
	if err != nil {
		t.Fatalf("indexer/db/migrations: %v", err)
	}
	if len(migrations) == 0 {
		t.Fatal("indexer/db/migrations: no migrations found")
	}
	if err := checkMigrationSequence(migrations); err != nil {
		t.Fatalf("indexer/db/migrations: %v", err)
	}
}

// TestMigrationsDir_KnownDuplicatesStillPresent makes the 009 exception
// expire: once #880 deletes or renumbers one of the pair, this fails until the
// knownDuplicateMigrations entry is removed.
func TestMigrationsDir_KnownDuplicatesStillPresent(t *testing.T) {
	present := make(map[string]bool)
	for _, name := range migrationsDirNames(t) {
		present[name] = true
	}
	for number, files := range knownDuplicateMigrations {
		if len(files) < 2 {
			t.Errorf("knownDuplicateMigrations[%q] lists %d file(s); an exception needs at least two", number, len(files))
		}
		for _, file := range files {
			if !present[file] {
				t.Errorf("knownDuplicateMigrations[%q] lists %s, which is no longer in indexer/db/migrations: "+
					"the duplicate is resolved, so remove the %q entry from knownDuplicateMigrations", number, file, number)
			}
		}
	}
}

// --- validateMigrationNames ---

func TestValidateMigrationNames(t *testing.T) {
	tests := []struct {
		name    string
		names   []string
		want    []string
		wantErr []string // substrings the error must contain; nil means no error
	}{
		{
			name:  "valid set is returned in apply order",
			names: []string{"002_add_indexes.sql", "001_initial.sql", "003_x9_y.sql"},
			want:  []string{"001_initial.sql", "002_add_indexes.sql", "003_x9_y.sql"},
		},
		{
			name:  "README and .gitkeep are ignored",
			names: []string{"README.md", ".gitkeep", "001_initial.sql"},
			want:  []string{"001_initial.sql"},
		},
		{
			name:    "duplicate number lists every conflicting file",
			names:   []string{"001_initial.sql", "002_b.sql", "002_a.sql"},
			wantErr: []string{"duplicate migration number 002: 002_a.sql, 002_b.sql", "unique NNN_ prefix"},
		},
		{
			name:    "three files sharing a number are all listed",
			names:   []string{"004_c.sql", "004_a.sql", "004_b.sql"},
			wantErr: []string{"duplicate migration number 004: 004_a.sql, 004_b.sql, 004_c.sql"},
		},
		{
			name:    "uppercase",
			names:   []string{"001_Initial.sql"},
			wantErr: []string{"001_Initial.sql does not match NNN_lowercase_name.sql"},
		},
		{
			name:    "missing underscore",
			names:   []string{"001initial.sql"},
			wantErr: []string{"001initial.sql does not match"},
		},
		{
			name:    "two digits",
			names:   []string{"01_initial.sql"},
			wantErr: []string{"01_initial.sql does not match"},
		},
		{
			name:    "four digits",
			names:   []string{"0001_initial.sql"},
			wantErr: []string{"0001_initial.sql does not match"},
		},
		{
			name:    "hyphen in description",
			names:   []string{"001_add-index.sql"},
			wantErr: []string{"001_add-index.sql does not match"},
		},
		{
			name:    "empty description",
			names:   []string{"001_.sql"},
			wantErr: []string{"001_.sql does not match"},
		},
		{
			name:    "down script would otherwise run as an up migration",
			names:   []string{"001_initial.sql", "001_initial.down.sql"},
			wantErr: []string{"001_initial.down.sql does not match"},
		},
		{
			name:    "numbered file with the wrong extension",
			names:   []string{"001_initial.SQL", "002_next.sql.bak"},
			wantErr: []string{"001_initial.SQL looks like a migration", "002_next.sql.bak looks like a migration"},
		},
		{
			name:    "every problem is reported at once",
			names:   []string{"001_a.sql", "001_b.sql", "002_Bad.sql"},
			wantErr: []string{"duplicate migration number 001", "002_Bad.sql does not match"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateMigrationNames(tt.names)
			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if !reflect.DeepEqual(got, tt.want) {
					t.Fatalf("got %v, want %v", got, tt.want)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected an error, got %v", got)
			}
			for _, want := range tt.wantErr {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not contain %q", err, want)
				}
			}
		})
	}
}

func TestValidateMigrationNames_KnownDuplicate(t *testing.T) {
	pair := knownDuplicateMigrations["009"]
	if len(pair) != 2 {
		t.Skip("no 009 exception configured")
	}

	t.Run("the exact allowlisted pair is accepted", func(t *testing.T) {
		got, err := validateMigrationNames([]string{pair[1], "008_x.sql", pair[0], "010_y.sql"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		want := []string{"008_x.sql", pair[0], pair[1], "010_y.sql"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})

	t.Run("a third file with the same number is rejected", func(t *testing.T) {
		_, err := validateMigrationNames([]string{pair[0], pair[1], "009_another.sql"})
		if err == nil || !strings.Contains(err.Error(), "duplicate migration number 009") ||
			!strings.Contains(err.Error(), "009_another.sql") {
			t.Fatalf("expected duplicate 009 error naming 009_another.sql, got %v", err)
		}
	})

	t.Run("a different pair at the same number is rejected", func(t *testing.T) {
		_, err := validateMigrationNames([]string{pair[0], "009_another.sql"})
		if err == nil || !strings.Contains(err.Error(), "duplicate migration number 009") {
			t.Fatalf("expected duplicate 009 error, got %v", err)
		}
	})

	t.Run("duplicates at other numbers are rejected", func(t *testing.T) {
		_, err := validateMigrationNames([]string{pair[0], pair[1], "010_a.sql", "010_b.sql"})
		if err == nil || !strings.Contains(err.Error(), "duplicate migration number 010: 010_a.sql, 010_b.sql") {
			t.Fatalf("expected duplicate 010 error, got %v", err)
		}
		if strings.Contains(err.Error(), "number 009") {
			t.Errorf("allowlisted 009 pair reported: %v", err)
		}
	})
}

// --- checkMigrationSequence ---

func TestCheckMigrationSequence(t *testing.T) {
	tests := []struct {
		name       string
		migrations []string
		wantErr    string
	}{
		{name: "contiguous from 001", migrations: []string{"001_a.sql", "002_b.sql", "003_c.sql"}},
		{name: "a shared number counts once", migrations: []string{"001_a.sql", "002_b.sql", "002_c.sql", "003_d.sql"}},
		{name: "gap", migrations: []string{"001_a.sql", "002_b.sql", "004_d.sql"}, wantErr: "expected 003, found 004"},
		{name: "does not start at 001", migrations: []string{"002_b.sql", "003_c.sql"}, wantErr: "expected 001, found 002"},
		{name: "empty", migrations: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkMigrationSequence(tt.migrations)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error %v does not contain %q", err, tt.wantErr)
			}
		})
	}
}
