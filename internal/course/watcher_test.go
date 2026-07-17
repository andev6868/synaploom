package course

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWatcherDebouncesAndReportsValidationFailure(t *testing.T) {
	root := t.TempDir()
	p := filepath.Join(root, "lesson.md")
	_ = os.WriteFile(p, []byte("# x"), 0o600)
	w := NewWatcher(root, 10*time.Millisecond, func(context.Context, string) error { return errors.New("bad") })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events := w.Run(ctx)
	for i := 0; i < 3; i++ {
		_ = os.WriteFile(p, []byte(time.Now().String()), 0o600)
		time.Sleep(2 * time.Millisecond)
	}
	select {
	case e := <-events:
		if e.Type != "validation.failed" {
			t.Fatalf("%#v", e)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout")
	}
	select {
	case e := <-events:
		t.Fatalf("duplicate %#v", e)
	case <-time.After(40 * time.Millisecond):
	}
}
