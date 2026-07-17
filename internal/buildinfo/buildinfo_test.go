package buildinfo

import "testing"

func TestBuildInfoDefaults(t *testing.T) {
	if Version == "" || Commit == "" || SchemaVersion == "" {
		t.Fatal("build metadata must never be empty")
	}
}
