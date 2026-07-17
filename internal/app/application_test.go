package app

import (
	"context"
	"testing"

	"github.com/synaploom/synaploom/internal/cli"
)

func TestRunVersion(t *testing.T) {
	if code := Run(context.Background(), cli.Command{Name: "version"}); code != 0 {
		t.Fatalf("code = %d", code)
	}
}
