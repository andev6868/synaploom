package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/synaploom/synaploom/internal/progression"
)

type chapterAssessmentHandlers struct{ progression LearningProgression }

func (h chapterAssessmentHandlers) get(w http.ResponseWriter, r *http.Request) {
	view, err := h.progression.ChapterAssessment(r.Context(), r.PathValue("chapterId"), r.PathValue("assessmentId"))
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{
		"id":           view.Assessment.ID,
		"chapterId":    view.Assessment.ChapterID,
		"title":        view.Assessment.Title,
		"required":     view.Assessment.Required,
		"status":       view.Status,
		"requirements": requirementPayloads(view.Requirements),
		"latestResult": view.LatestResult,
		"bestResult":   view.BestResult,
		"actions":      []map[string]any{{"id": "check", "label": "Kiểm tra kết quả"}},
		"editable":     []string{},
	})
}

func (h chapterAssessmentHandlers) action(w http.ResponseWriter, r *http.Request) {
	if r.PathValue("actionId") != "check" {
		writeError(w, http.StatusNotFound, "ACTION_NOT_FOUND", "Action not found.", requestID(r), nil)
		return
	}
	var body struct {
		Passed  bool     `json:"passed"`
		Score   *float64 `json:"score"`
		Summary string   `json:"summary"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid assessment result.", requestID(r), nil)
		return
	}
	result, err := h.progression.RecordChapterAssessmentResult(r.Context(), r.PathValue("chapterId"), r.PathValue("assessmentId"), progression.AttemptResult{Passed: body.Passed, Score: body.Score, Summary: body.Summary, CompletedAt: time.Now().UTC()})
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"navigation": navigationPayloadFromEvaluation(h.progression.CourseID(), result.Evaluation)})
}
