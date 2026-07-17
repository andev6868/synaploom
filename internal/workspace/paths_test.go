package workspace

import (
	"errors"
	"path/filepath"
	"testing"
)

func TestSafeJoinRejectsAbsoluteAndTraversal(t *testing.T) {
	root := t.TempDir()
	for _, p := range []string{"../x", filepath.Join(string(filepath.Separator), "tmp", "x")} {
		if _, err := safeJoin(root, p); !errors.Is(err, ErrUnsafePath) {
			t.Fatalf("%q err=%v", p, err)
		}
	}
}
