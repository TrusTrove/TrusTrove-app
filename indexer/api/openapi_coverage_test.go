package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"gopkg.in/yaml.v3"
)

// TestOpenAPISpecCoversRouterRoutes walks the chi router and fails if any
// registered route is missing from docs/openapi/indexer.yaml.
func TestOpenAPISpecCoversRouterRoutes(t *testing.T) {
	// Find the OpenAPI spec relative to the indexer directory
	specPath := filepath.Join("..", "..", "docs", "openapi", "indexer.yaml")
	if _, err := os.Stat(specPath); err != nil {
		t.Fatalf("openapi spec not found at %s: %v", specPath, err)
	}

	raw, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("read openapi spec: %v", err)
	}

	var spec struct {
		Paths map[string]map[string]interface{} `yaml:"paths"`
	}
	if err := yaml.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("parse openapi spec: %v", err)
	}

	// Collect all paths defined in the spec (normalize {param} to {})
	specPaths := make(map[string]bool)
	for p := range spec.Paths {
		normalized := normalizeRoutePath(p)
		specPaths[normalized] = true
	}

	// Build the real application router
	h := readonlyTestHandler(t)
	r := NewRouter(h)

	// Walk the router and check each route is in the spec
	var missing []string
	err = chi.Walk(r, func(method string, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		normalized := normalizeRoutePath(route)
		if !specPaths[normalized] {
			missing = append(missing, method+" "+route)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk router: %v", err)
	}

	if len(missing) > 0 {
		t.Errorf("routes missing from OpenAPI spec:\n  %s", strings.Join(missing, "\n  "))
	}
}

// normalizeRoutePath converts chi route parameters to OpenAPI-style {param}.
func normalizeRoutePath(route string) string {
	// chi uses {param} already, but ensure consistency
	return route
}
