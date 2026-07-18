package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/course"
)

type activityHandlers struct {
	content  course.Service
	activity activity.Service
}

type activityDraftPayload struct {
	Answer     json.RawMessage `json:"answer"`
	Revision   int64           `json:"revision"`
	RandomSeed int64           `json:"randomSeed"`
}

type activitySubmitPayload struct {
	Answer         json.RawMessage `json:"answer"`
	IdempotencyKey string          `json:"idempotencyKey"`
	RandomSeed     int64           `json:"randomSeed"`
}

func (h activityHandlers) listSets(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	sets, err := h.activity.PublicActivitySets(r.Context(), owner)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, sets)
}

func (h activityHandlers) get(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	view, err := h.activity.PublicActivity(r.Context(), owner, r.PathValue("activityId"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, view)
}

func (h activityHandlers) current(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	attempt, err := h.activity.CurrentAttempt(r.Context(), activity.AttemptIdentity{Owner: owner, ActivityID: r.PathValue("activityId")})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, attempt)
}

func (h activityHandlers) saveDraft(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	var payload activityDraftPayload
	if err := decodeActivityJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "ACTIVITY_REQUEST_INVALID", "Activity draft payload is invalid.", requestID(r), nil)
		return
	}
	attempt, err := h.activity.SaveDraft(r.Context(), activity.SaveDraftCommand{
		Identity: activity.AttemptIdentity{Owner: owner, ActivityID: r.PathValue("activityId")},
		Answer:   payload.Answer, Revision: payload.Revision, Seed: payload.RandomSeed, At: time.Now().UTC(),
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, attempt)
}

func (h activityHandlers) submit(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	var payload activitySubmitPayload
	if err := decodeActivityJSON(w, r, &payload); err != nil || payload.IdempotencyKey == "" {
		writeError(w, http.StatusUnprocessableEntity, "ACTIVITY_REQUEST_INVALID", "Activity submission payload is invalid.", requestID(r), nil)
		return
	}
	attempt, err := h.activity.Submit(r.Context(), activity.SubmitCommand{
		Identity: activity.AttemptIdentity{Owner: owner, ActivityID: r.PathValue("activityId")},
		Answer:   payload.Answer, IdempotencyKey: payload.IdempotencyKey,
		Seed: payload.RandomSeed, At: time.Now().UTC(),
	})
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, attempt)
}

func (h activityHandlers) setProgress(w http.ResponseWriter, r *http.Request) {
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	progress, err := h.activity.SetProgress(r.Context(), owner, r.PathValue("setId"))
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, progress)
}

func (h activityHandlers) owner(w http.ResponseWriter, r *http.Request) (activity.OwnerIdentity, bool) {
	var kind activity.OwnerKind
	switch r.PathValue("ownerKind") {
	case "lessons":
		kind = activity.OwnerKindLesson
	case "assessments":
		kind = activity.OwnerKindAssessment
	default:
		writeError(w, http.StatusBadRequest, "ACTIVITY_OWNER_INVALID", "Activity owner kind must be lessons or assessments.", requestID(r), nil)
		return activity.OwnerIdentity{}, false
	}
	payload, err := h.content.Course(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
		return activity.OwnerIdentity{}, false
	}
	if string(payload.Id) != r.PathValue("courseId") {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course was not found.", requestID(r), nil)
		return activity.OwnerIdentity{}, false
	}
	return activity.OwnerIdentity{CourseID: string(payload.Id), CourseVersion: payload.Version, Kind: kind, ID: r.PathValue("ownerId")}, true
}

func (h activityHandlers) writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, activity.ErrActivityNotFound), errors.Is(err, activity.ErrActivitySetNotFound):
		writeError(w, http.StatusNotFound, "ACTIVITY_NOT_FOUND", "Activity was not found.", requestID(r), nil)
	case errors.Is(err, activity.ErrRevisionConflict):
		writeError(w, http.StatusConflict, "ACTIVITY_REVISION_CONFLICT", "The activity draft changed. Refresh and try again.", requestID(r), nil)
	case errors.Is(err, activity.ErrMalformedAnswer):
		writeError(w, http.StatusUnprocessableEntity, "ACTIVITY_ANSWER_INVALID", "The activity answer is invalid.", requestID(r), nil)
	case errors.Is(err, activity.ErrMaxAttemptsReached):
		writeError(w, http.StatusConflict, "ACTIVITY_MAX_ATTEMPTS_REACHED", "No activity attempts remain.", requestID(r), nil)
	case errors.Is(err, activity.ErrEvaluatorUnavailable):
		writeError(w, http.StatusServiceUnavailable, "ACTIVITY_EVALUATOR_UNAVAILABLE", "The activity evaluator is unavailable.", requestID(r), nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
	}
}

func decodeActivityJSON(w http.ResponseWriter, r *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}
