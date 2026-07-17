package logging

import (
	"bytes"
	"strings"
	"testing"
)

func TestLoggerRedactsSensitiveFields(t *testing.T) {
	var b bytes.Buffer
	New(&b, 2).Write("x", map[string]any{"api_key": "secret"})
	if strings.Contains(b.String(), "secret") {
		t.Fatal("leak")
	}
}
