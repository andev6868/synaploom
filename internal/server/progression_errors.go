package server

import (
	"errors"
	"net/http"

	"github.com/synaploom/synaploom/internal/progression"
)

func writeProgressionError(w http.ResponseWriter, r *http.Request, err error) {
	var locked *progression.ItemLockedError
	var unknown *progression.UnknownItemError
	switch {
	case errors.As(err, &locked):
		writeError(w, http.StatusConflict, "ITEM_LOCKED", "Item is locked.", requestID(r), map[string]any{"blockingRequirements": requirementPayloads(locked.Blocking), "currentTarget": locked.CurrentItem})
	case errors.As(err, &unknown):
		writeError(w, http.StatusNotFound, "ITEM_NOT_FOUND", "Progression item not found.", requestID(r), map[string]any{"itemId": unknown.ItemID})
	case errors.Is(err, progression.ErrRequirementUnsatisfied):
		writeError(w, http.StatusConflict, "REQUIREMENT_UNSATISFIED", "Required work is not complete.", requestID(r), nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
	}
}
