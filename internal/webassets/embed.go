// Package webassets exposes the deterministic production Web bundle embedded in the native binary.
package webassets

import (
	"embed"
	"encoding/json"
	"io/fs"
)

//go:embed dist inventory.json
var assets embed.FS

// FS returns the embedded production assets rooted at dist.
func FS() fs.FS {
	subtree, err := fs.Sub(assets, "dist")
	if err != nil {
		panic(err)
	}
	return subtree
}

// Inventory returns a defensive copy of the staged embedded file inventory.
func Inventory() []string {
	data, err := assets.ReadFile("inventory.json")
	if err != nil {
		panic(err)
	}
	var inventory []string
	if err := json.Unmarshal(data, &inventory); err != nil {
		panic(err)
	}
	return append([]string(nil), inventory...)
}
