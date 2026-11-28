package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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
	r, stopRouter := NewRouter(h)
	t.Cleanup(stopRouter)

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

// TestOpenAPIDeleteWebhookIDParamIsUUID is a contract test: the spec must
// describe the {id} path parameter of DELETE /webhooks/{id} with the same type
// HandleDeleteWebhook enforces via uuid.Parse (subscription IDs are UUIDs).
func TestOpenAPIDeleteWebhookIDParamIsUUID(t *testing.T) {
	specPath := filepath.Join("..", "..", "docs", "openapi", "indexer.yaml")
	raw, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("read openapi spec: %v", err)
	}

	var spec struct {
		Paths map[string]map[string]struct {
			Parameters []struct {
				Name   string `yaml:"name"`
				In     string `yaml:"in"`
				Schema struct {
					Type   string `yaml:"type"`
					Format string `yaml:"format"`
				} `yaml:"schema"`
			} `yaml:"parameters"`
		} `yaml:"paths"`
	}
	if err := yaml.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("parse openapi spec: %v", err)
	}

	var found bool
	for _, p := range spec.Paths["/webhooks/{id}"]["delete"].Parameters {
		if p.Name != "id" || p.In != "path" {
			continue
		}
		found = true
		if p.Schema.Type != "string" || p.Schema.Format != "uuid" {
			t.Errorf("DELETE /webhooks/{id} id param is type=%q format=%q; want type=string format=uuid",
				p.Schema.Type, p.Schema.Format)
		}
	}
	if !found {
		t.Fatal("DELETE /webhooks/{id} has no id path parameter in the spec")
	}

	// The handler's contract: what the spec calls a uuid parses, and the
	// integer form the spec used to declare does not.
	if _, err := uuid.Parse("00000000-0000-0000-0000-000000000001"); err != nil {
		t.Errorf("a uuid-formatted id must satisfy uuid.Parse: %v", err)
	}
	if _, err := uuid.Parse("1"); err == nil {
		t.Error("an integer id must not satisfy uuid.Parse; the handler would return 400")
	}
}
