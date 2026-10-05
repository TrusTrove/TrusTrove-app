package db

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Migration filenames must be a unique three-digit number, an underscore, and
// a lowercase snake_case description: 011_add_something.sql. RunMigration
// orders files lexically and records each one by its full filename stem, so a
// second file with the same number is applied in whatever order its
// description happens to sort, which is how the 002 and 009 collisions landed
// (see issues #336 and #880). validateMigrationNames rejects that before any
// migration runs.
var migrationNamePattern = regexp.MustCompile(`^(\d{3})_[a-z0-9_]+\.sql$`)

// migrationLookalikePattern matches a numbered file that is not a .sql file
// (010_foo.SQL, 010_foo.sql.bak). RunMigration would silently skip it, so it
// is reported rather than ignored. Other non-.sql files (README.md,
// .gitkeep) are ignored.
var migrationLookalikePattern = regexp.MustCompile(`^\d+_`)

// knownDuplicateMigrations lists the only duplicate numbers tolerated, each
// with the exact set of files allowed to share it. 009 is the collision
// tracked in #880; its fix deletes or renumbers one of the two files, at which
// point TestMigrationsDir_KnownDuplicatesStillPresent fails until this entry
// is removed (#913). Do not add entries: renumber the newer migration instead.
var knownDuplicateMigrations = map[string][]string{
	"009": {"009_add_webhook_subscriptions.sql", "009_webhooks.sql"},
}

// validateMigrationNames selects the migration files from a directory listing
// and checks that every one is named NNN_description.sql and that no two
// share a number (apart from knownDuplicateMigrations). It returns the
// migration files in the order RunMigration applies them, or an error
// describing every problem found.
func validateMigrationNames(names []string) ([]string, error) {
	var errs []error
	byNumber := make(map[string][]string)
	var migrations []string

	for _, name := range names {
		if !strings.HasSuffix(name, ".sql") {
			if migrationLookalikePattern.MatchString(name) {
				errs = append(errs, fmt.Errorf("%s looks like a migration but is not a .sql file", name))
			}
			continue
		}
		match := migrationNamePattern.FindStringSubmatch(name)
		if match == nil {
			errs = append(errs, fmt.Errorf("%s does not match NNN_lowercase_name.sql", name))
			continue
		}
		byNumber[match[1]] = append(byNumber[match[1]], name)
		migrations = append(migrations, name)
	}

	numbers := make([]string, 0, len(byNumber))
	for number := range byNumber {
		numbers = append(numbers, number)
	}
	sort.Strings(numbers)
	for _, number := range numbers {
		files := byNumber[number]
		if len(files) < 2 || isKnownDuplicate(number, files) {
			continue
		}
		sort.Strings(files)
		errs = append(errs, fmt.Errorf(
			"duplicate migration number %s: %s (each migration needs a unique NNN_ prefix)",
			number, strings.Join(files, ", "),
		))
	}

	if len(errs) > 0 {
		return nil, fmt.Errorf("invalid migration filenames: %w", errors.Join(errs...))
	}
	sort.Strings(migrations)
	return migrations, nil
}

// isKnownDuplicate reports whether files is exactly the allowlisted set for
// number; a third file with the same number is still rejected.
func isKnownDuplicate(number string, files []string) bool {
	allowed, ok := knownDuplicateMigrations[number]
	if !ok || len(allowed) != len(files) {
		return false
	}
	got := append([]string(nil), files...)
	want := append([]string(nil), allowed...)
	sort.Strings(got)
	sort.Strings(want)
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

// checkMigrationSequence checks that the migration numbers of validated
// filenames run 001, 002, ... with no gaps. It is enforced by the repository
// test rather than by RunMigration, so a gap cannot stop a deployed indexer
// from starting.
func checkMigrationSequence(migrations []string) error {
	seen := make(map[int]bool)
	numbers := make([]int, 0, len(migrations))
	for _, name := range migrations {
		match := migrationNamePattern.FindStringSubmatch(name)
		if match == nil {
			return fmt.Errorf("%s does not match NNN_lowercase_name.sql", name)
		}
		number, _ := strconv.Atoi(match[1])
		if !seen[number] {
			seen[number] = true
			numbers = append(numbers, number)
		}
	}
	sort.Ints(numbers)
	for i, number := range numbers {
		if want := i + 1; number != want {
			return fmt.Errorf("migration numbers must be contiguous from 001: expected %03d, found %03d", want, number)
		}
	}
	return nil
}
