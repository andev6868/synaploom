package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/synaploom/synaploom/internal/course"
)

type courseHandlers struct{ service course.Service }

func (h courseHandlers) course(w http.ResponseWriter, r *http.Request) {
	payload, err := h.service.Course(r.Context())
	if err != nil {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found.", requestID(r), nil)
		return
	}
	writeJSON(w, payload)
}
func (h courseHandlers) currentLesson(w http.ResponseWriter, r *http.Request) {
	coursePayload, err := h.service.Course(r.Context())
	if err != nil || coursePayload.CurrentLessonId == nil {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	payload, err := h.service.Lesson(r.Context(), *coursePayload.CurrentLessonId)
	if err != nil {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	writeJSON(w, payload)
}

func (h courseHandlers) workspaceFiles(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.PracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	files, err := practice.WorkspaceFiles(r.Context(), r.PathValue("lessonId"))
	if err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"files": files})
}

func (h courseHandlers) readWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.PracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	path := r.URL.Query().Get("path")
	data, err := practice.ReadWorkspaceFile(r.Context(), r.PathValue("lessonId"), path)
	if err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"path": path, "content": string(data)})
}

func (h courseHandlers) writeWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.PracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	var payload struct {
		Content string `json:"content"`
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil || json.Unmarshal(data, &payload) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid workspace payload.", requestID(r), nil)
		return
	}
	if err := practice.WriteWorkspaceFile(r.Context(), r.PathValue("lessonId"), r.URL.Query().Get("path"), []byte(payload.Content)); err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{})
}

func (h courseHandlers) resetWorkspace(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.PracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	if err := practice.ResetWorkspace(r.Context(), r.PathValue("lessonId")); err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{})
}

func (h courseHandlers) activityWorkspaceFiles(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.ActivityPracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	files, err := practice.WorkspaceFilesForActivity(r.Context(), r.PathValue("lessonId"), r.PathValue("activityId"))
	if err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"files": files})
}

func (h courseHandlers) readActivityWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.ActivityPracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	path := r.URL.Query().Get("path")
	data, err := practice.ReadWorkspaceFileForActivity(r.Context(), r.PathValue("lessonId"), r.PathValue("activityId"), path)
	if err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"path": path, "content": string(data)})
}

func (h courseHandlers) writeActivityWorkspaceFile(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.ActivityPracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	var payload struct {
		Content string `json:"content"`
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil || json.Unmarshal(data, &payload) != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid workspace payload.", requestID(r), nil)
		return
	}
	if err := practice.WriteWorkspaceFileForActivity(r.Context(), r.PathValue("lessonId"), r.PathValue("activityId"), r.URL.Query().Get("path"), []byte(payload.Content)); err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{})
}

func (h courseHandlers) resetActivityWorkspace(w http.ResponseWriter, r *http.Request) {
	practice, ok := h.service.(course.ActivityPracticeService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "WORKSPACE_UNAVAILABLE", "Workspace is unavailable.", requestID(r), nil)
		return
	}
	if err := practice.ResetWorkspaceForActivity(r.Context(), r.PathValue("lessonId"), r.PathValue("activityId")); err != nil {
		h.writeWorkspaceError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{})
}

func (h courseHandlers) writeWorkspaceError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, course.ErrLessonNotFound):
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
	case errors.Is(err, course.ErrExerciseNotFound):
		writeError(w, http.StatusNotFound, "EXERCISE_NOT_FOUND", "Exercise not found.", requestID(r), nil)
	case errors.Is(err, course.ErrWorkspaceFileNotFound):
		writeError(w, http.StatusNotFound, "WORKSPACE_FILE_NOT_FOUND", "Workspace file not found.", requestID(r), nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
	}
}

func (h courseHandlers) getPaneRatio(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"ratio": 0.48})
}

func (h courseHandlers) setPaneRatio(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"ratio": 0.48})
}

func (h courseHandlers) lesson(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("lessonId")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	payload, err := h.service.Lesson(r.Context(), id)
	if errors.Is(err, course.ErrLessonNotFound) {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
		return
	}
	writeJSON(w, payload)
}
func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

type completionPayload struct {
	Completed       bool                  `json:"completed"`
	CourseCompleted bool                  `json:"courseCompleted"`
	NextLesson      *completionNextLesson `json:"nextLesson"`
}

type completionNextLesson struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func (h courseHandlers) acknowledgeReading(w http.ResponseWriter, r *http.Request) {
	progress, ok := h.service.(course.ProgressService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "PROGRESSION_UNAVAILABLE", "Progression is unavailable.", requestID(r), nil)
		return
	}
	if err := progress.AcknowledgeReading(r.Context(), r.PathValue("lessonId")); err != nil {
		h.writeProgressError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{})
}

func (h courseHandlers) completeLesson(w http.ResponseWriter, r *http.Request) {
	progress, ok := h.service.(course.ProgressService)
	if !ok {
		writeError(w, http.StatusNotImplemented, "PROGRESSION_UNAVAILABLE", "Progression is unavailable.", requestID(r), nil)
		return
	}
	result, err := progress.CompleteLesson(r.Context(), r.PathValue("lessonId"))
	if err != nil {
		h.writeProgressError(w, r, err)
		return
	}
	payload := completionPayload{Completed: true, CourseCompleted: result.CourseCompleted}
	if result.NextLessonID != "" {
		payload.NextLesson = &completionNextLesson{ID: result.NextLessonID, Title: result.NextLessonTitle}
	}
	writeJSON(w, payload)
}

func (h courseHandlers) writeProgressError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, course.ErrLessonNotFound):
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
	case errors.Is(err, course.ErrLessonLocked):
		writeError(w, http.StatusConflict, "LESSON_LOCKED", "Lesson is locked.", requestID(r), nil)
	case errors.Is(err, course.ErrReadingIncomplete):
		writeError(w, http.StatusConflict, "READING_INCOMPLETE", "Complete the reading before completing the lesson.", requestID(r), nil)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
	}
}
