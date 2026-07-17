package contracts_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	contracts "github.com/synaploom/synaploom/internal/contracts"
)

type fixtureEntry struct {
	Schema string `json:"schema"`
	Path   string `json:"path"`
}

type fixtureCatalog struct {
	Valid   []fixtureEntry `json:"valid"`
	Invalid []fixtureEntry `json:"invalid"`
}

func TestCatalogFixtures(t *testing.T) {
	catalogPath := filepath.Join("..", "..", "..", "schemas", "fixtures", "catalog.json")
	data, err := os.ReadFile(catalogPath)
	if err != nil {
		t.Fatal(err)
	}
	var catalog fixtureCatalog
	if err := json.Unmarshal(data, &catalog); err != nil {
		t.Fatal(err)
	}
	validator := contracts.NewValidator()
	for _, entry := range catalog.Valid {
		assertFixture(t, validator, entry, true)
	}
	for _, entry := range catalog.Invalid {
		assertFixture(t, validator, entry, false)
	}
}

func assertFixture(t *testing.T, validator *contracts.Validator, entry fixtureEntry, wantValid bool) {
	t.Helper()
	fixturePath := filepath.Join("..", "..", "..", "schemas", "fixtures", filepath.FromSlash(entry.Path))
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatal(err)
	}
	var payload any
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatal(err)
	}
	valid := validator.Validate(entry.Schema, payload) == nil
	if valid != wantValid {
		t.Fatalf("fixture %s validity = %v, want %v", entry.Path, valid, wantValid)
	}
}
