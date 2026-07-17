package webassets

import (
	"io/fs"
	"regexp"
	"strings"
	"testing"
)

func TestEmbeddedAssetsContainIndexAndHashedBundle(t *testing.T) {
	inventory := Inventory()
	contains := func(want string) bool {
		for _, item := range inventory {
			if item == want {
				return true
			}
		}
		return false
	}
	if !contains("dist/index.html") {
		t.Fatal("missing dist/index.html")
	}
	re := regexp.MustCompile(`^dist/assets/index-[A-Za-z0-9_-]+\.js$`)
	for _, item := range inventory {
		if re.MatchString(item) {
			return
		}
	}
	t.Fatal("missing hashed JavaScript bundle")
}

func TestInventoryMatchesEmbeddedFiles(t *testing.T) {
	for _, name := range Inventory() {
		if !strings.HasPrefix(name, "dist/") {
			t.Fatalf("inventory path %q is outside dist", name)
		}
		if _, err := fs.Stat(assets, name); err != nil {
			t.Fatalf("inventory references missing embedded file %q: %v", name, err)
		}
	}

	index, err := fs.ReadFile(assets, "dist/index.html")
	if err != nil {
		t.Fatal(err)
	}
	for _, match := range regexp.MustCompile(`(?:src|href)="/([^"?]+)`).FindAllStringSubmatch(string(index), -1) {
		name := "dist/" + match[1]
		if _, err := fs.Stat(assets, name); err != nil {
			t.Fatalf("index.html references missing embedded asset %q: %v", name, err)
		}
	}
}
