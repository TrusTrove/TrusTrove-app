package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestEnvExampleDocumented guards against doc drift: every variable defined in
// the root .env.example must have a row in
// docs/developer-guide/environment-variables.md (see issue #910).
func TestEnvExampleDocumented(t *testing.T) {
	// package dir is <repo>/indexer/config
	pkgDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	repoRoot := filepath.Join(pkgDir, "..", "..")

	envExample, err := os.ReadFile(filepath.Join(repoRoot, ".env.example"))
	if err != nil {
		t.Fatalf("read .env.example: %v", err)
	}
	doc, err := os.ReadFile(filepath.Join(repoRoot, "docs", "developer-guide", "environment-variables.md"))
	if err != nil {
		t.Fatalf("read environment-variables.md: %v", err)
	}
	docText := string(doc)

	var missing []string
	seen := map[string]bool{}
	for _, line := range strings.Split(string(envExample), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		name, _, ok := strings.Cut(line, "=")
		name = strings.TrimSpace(name)
		if !ok || name == "" || seen[name] {
			continue
		}
		seen[name] = true
		// table rows quote the variable name in backticks: `VAR`
		if !strings.Contains(docText, "`"+name+"`") {
			missing = append(missing, name)
		}
	}

	if len(missing) > 0 {
		t.Errorf("variables in .env.example missing from docs/developer-guide/environment-variables.md: %s",
			strings.Join(missing, ", "))
	}
}
