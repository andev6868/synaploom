package server

import (
	"encoding/json"
	"errors"
	"net/http"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/workspacepresentation"
)

type workspacePresentationHandlers struct{ service workspacepresentation.Service }

type updateWorkspacePresentationPayload struct {
	FocusedActivityID *string `json:"focusedActivityId"`
	PaneMode          string  `json:"paneMode"`
	SplitRatio        float64 `json:"splitRatio"`
	UserCollapsed     bool    `json:"userCollapsed"`
	Revision          int64   `json:"revision"`
}

func workspaceOwner(r *http.Request) workspacepresentation.Owner {
	return workspacepresentation.Owner{CourseID: r.PathValue("courseId"), OwnerKind: r.PathValue("ownerKind"), OwnerID: r.PathValue("ownerId")}
}
func (h workspacePresentationHandlers) get(w http.ResponseWriter, r *http.Request) {
	state, err := h.service.Get(r.Context(), workspacepresentation.LocalProfileID, workspaceOwner(r))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, state)
}
func (h workspacePresentationHandlers) update(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var payload updateWorkspacePresentationPayload
	if err := decoder.Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "WORKSPACE_PRESENTATION_REQUEST_INVALID", "Workspace presentation request is invalid.", requestID(r), nil)
		return
	}
	state, err := h.service.Update(r.Context(), workspacepresentation.UpdateCommand{Owner: workspaceOwner(r), ProfileID: workspacepresentation.LocalProfileID, FocusedActivityID: payload.FocusedActivityID, PaneMode: payload.PaneMode, SplitRatio: payload.SplitRatio, UserCollapsed: payload.UserCollapsed, Revision: payload.Revision})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, state)
}
func (h workspacePresentationHandlers) writeError(w http.ResponseWriter, r *http.Request, err error) {
	var conflict workspacepresentation.ConflictError
	switch {
	case errors.As(err, &conflict):
		writeError(w, http.StatusConflict, "WORKSPACE_PRESENTATION_CONFLICT", "Workspace presentation changed. Retry with the current revision.", requestID(r), contracts.ApiErrorDetails{"currentWorkspacePresentation": conflict.Current})
	case errors.Is(err, workspacepresentation.ErrOwnerInvalid):
		writeError(w, http.StatusBadRequest, "WORKSPACE_PRESENTATION_OWNER_INVALID", "Workspace presentation owner is invalid.", requestID(r), nil)
	case errors.Is(err, workspacepresentation.ErrActivityPracticeSurfaceNotAllowed), errors.Is(err, workspacepresentation.ErrActivityInvalid):
		writeError(w, http.StatusBadRequest, "WORKSPACE_PRESENTATION_ACTIVITY_NOT_ALLOWED", "Activity cannot open in the Practice Pane.", requestID(r), nil)
	case errors.Is(err, workspacepresentation.ErrActivityFullscreenNotSupported):
		writeError(w, http.StatusBadRequest, "WORKSPACE_PRESENTATION_FULLSCREEN_NOT_SUPPORTED", "Activity does not support expanded mode.", requestID(r), nil)
	case errors.Is(err, workspacepresentation.ErrPaneModeInvalid):
		writeError(w, http.StatusBadRequest, "WORKSPACE_PRESENTATION_REQUEST_INVALID", "Workspace presentation pane mode is invalid.", requestID(r), nil)
	default:
		writeError(w, http.StatusInternalServerError, "WORKSPACE_PRESENTATION_UNAVAILABLE", "Workspace presentation is unavailable.", requestID(r), nil)
	}
}
