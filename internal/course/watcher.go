package course

import (
	"context"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type DevEvent struct {
	Type  string `json:"type"`
	Path  string `json:"path,omitempty"`
	Error string `json:"error,omitempty"`
}
type ValidateFunc func(context.Context, string) error
type Watcher struct {
	root     string
	debounce time.Duration
	validate ValidateFunc
	poll     time.Duration
}

func NewWatcher(root string, debounce time.Duration, validate ValidateFunc) *Watcher {
	if debounce <= 0 {
		debounce = 100 * time.Millisecond
	}
	return &Watcher{root: root, debounce: debounce, validate: validate, poll: 5 * time.Millisecond}
}
func (w *Watcher) Root() string { return w.root }
func (w *Watcher) Run(ctx context.Context) <-chan DevEvent {
	out := make(chan DevEvent, 1)
	go func() {
		defer close(out)
		base := w.snapshot()
		tick := time.NewTicker(w.poll)
		defer tick.Stop()
		var timer *time.Timer
		var timerC <-chan time.Time
		changed := ""
		for {
			select {
			case <-ctx.Done():
				if timer != nil {
					timer.Stop()
				}
				return
			case <-tick.C:
				next := w.snapshot()
				if p, ok := firstChange(base, next); ok {
					base = next
					changed = p
					if timer == nil {
						timer = time.NewTimer(w.debounce)
					} else {
						if !timer.Stop() {
							select {
							case <-timer.C:
							default:
							}
						}
						timer.Reset(w.debounce)
					}
					timerC = timer.C
				}
			case <-timerC:
				timerC = nil
				event := DevEvent{Type: classifyChange(changed), Path: changed}
				if w.validate != nil {
					if err := w.validate(ctx, w.root); err != nil {
						event.Type = "validation.failed"
						event.Error = err.Error()
					}
				}
				select {
				case out <- event:
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return out
}
func (w *Watcher) snapshot() map[string]int64 {
	m := map[string]int64{}
	_ = filepath.WalkDir(w.root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !watchable(path) {
			return nil
		}
		i, err := d.Info()
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(w.root, path)
		m[filepath.ToSlash(rel)] = i.ModTime().UnixNano() ^ i.Size()
		return nil
	})
	return m
}
func watchable(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".md", ".json", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".png", ".jpg", ".jpeg", ".svg", ".webp":
		return true
	}
	return false
}
func firstChange(a, b map[string]int64) (string, bool) {
	seen := map[string]struct{}{}
	keys := []string{}
	for k := range a {
		seen[k] = struct{}{}
		keys = append(keys, k)
	}
	for k := range b {
		if _, ok := seen[k]; !ok {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	for _, k := range keys {
		if a[k] != b[k] {
			return k, true
		}
	}
	return "", false
}
func classifyChange(path string) string {
	if strings.HasSuffix(strings.ToLower(path), ".md") {
		return "lesson.changed"
	}
	return "course.changed"
}
