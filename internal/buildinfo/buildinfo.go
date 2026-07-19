// Package buildinfo exposes build metadata injected into Synaploom binaries.
package buildinfo

var (
	// Version is the product version displayed by CLI diagnostics.
	Version = "0.2.0"
	// Commit identifies the source revision used for the build.
	Commit = "development"
	// SchemaVersion identifies the canonical compatibility schema set.
	SchemaVersion = "1.2.0"
)
