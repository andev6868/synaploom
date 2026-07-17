package server

import (
	"encoding/json"
	"github.com/synaploom/synaploom/internal/ai"
	"net/http"
)

type aiHandlers struct {
	provider ai.Provider
	local    bool
}

func (h aiHandlers) disclosure(w http.ResponseWriter, r *http.Request) {
	var q ai.Request
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		writeError(w, 400, "INVALID_AI_REQUEST", "Invalid AI request.", requestID(r), nil)
		return
	}
	writeJSON(w, ai.Disclose(q, h.local))
}
func (h aiHandlers) stream(w http.ResponseWriter, r *http.Request) {
	var q ai.Request
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		writeError(w, 400, "INVALID_AI_REQUEST", "Invalid AI request.", requestID(r), nil)
		return
	}
	events, err := h.provider.Stream(r.Context(), q)
	if err != nil {
		writeError(w, 502, "AI_PROVIDER_ERROR", err.Error(), requestID(r), nil)
		return
	}
	w.Header().Set("Content-Type", "application/x-ndjson")
	f, _ := w.(http.Flusher)
	enc := json.NewEncoder(w)
	for e := range events {
		_ = enc.Encode(e)
		if f != nil {
			f.Flush()
		}
	}
}
