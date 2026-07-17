package logging

import (
	"encoding/json"
	"io"
	"strings"
	"sync"
	"time"
)

type Logger struct {
	mu           sync.Mutex
	out          io.Writer
	max, entries int
}

func New(out io.Writer, max int) *Logger {
	if max <= 0 {
		max = 1000
	}
	return &Logger{out: out, max: max}
}
func (l *Logger) Write(event string, fields map[string]any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.entries >= l.max {
		return
	}
	safe := map[string]any{"event": event, "timestamp": time.Now().UTC().Format(time.RFC3339Nano)}
	for k, v := range fields {
		q := strings.ToLower(k)
		if strings.Contains(q, "token") || strings.Contains(q, "key") || strings.Contains(q, "prompt") || strings.Contains(q, "content") {
			safe[k] = "[redacted]"
		} else {
			safe[k] = v
		}
	}
	_ = json.NewEncoder(l.out).Encode(safe)
	l.entries++
}
