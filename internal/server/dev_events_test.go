package server

import (
	"github.com/synaploom/synaploom/internal/course"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDevEventsStreamsValidationFailure(t *testing.T) {
	ch := make(chan course.DevEvent, 1)
	ch <- course.DevEvent{Type: "validation.failed", Error: "bad"}
	close(ch)
	w := httptest.NewRecorder()
	DevEventsHandler(ch).ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if !strings.Contains(w.Body.String(), "validation.failed") {
		t.Fatal(w.Body.String())
	}
}
