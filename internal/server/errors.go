package server

import (
	"encoding/json"
	"net/http"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

func writeError(w http.ResponseWriter, status int, code, message, requestID string, details contracts.ApiErrorDetails) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	id := requestID
	_ = json.NewEncoder(w).Encode(contracts.ApiErrorPayload{Code: code, Message: message, RequestId: &id, Details: details})
}
