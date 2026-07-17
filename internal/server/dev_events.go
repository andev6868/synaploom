package server

import (
	"encoding/json"
	"fmt"
	"github.com/synaploom/synaploom/internal/course"
	"net/http"
)

func DevEventsHandler(events <-chan course.DevEvent) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		for {
			select {
			case <-r.Context().Done():
				return
			case e, ok := <-events:
				if !ok {
					return
				}
				b, _ := json.Marshal(e)
				fmt.Fprintf(w, "event: development\ndata: %s\n\n", b)
				f.Flush()
			}
		}
	}
}
