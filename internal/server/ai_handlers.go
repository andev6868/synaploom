package server

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/ai"
)

type aiHandlers struct {
	provider ai.Provider
	local    bool
	builder  aiContextBuilder
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

func (h aiHandlers) generate(w http.ResponseWriter, r *http.Request) {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	decoder.DisallowUnknownFields()
	var payload aiGeneratePayload
	if err := decoder.Decode(&payload); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "AI_REQUEST_INVALID", "Yêu cầu Trợ lý AI không hợp lệ.", requestID(r), nil)
		return
	}
	owner, ok := h.owner(w, r)
	if !ok {
		return
	}
	request, err := h.builder.build(r.Context(), owner, payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "AI_CONTEXT_INVALID", "Ngữ cảnh Trợ lý AI không hợp lệ.", requestID(r), nil)
		return
	}
	events, err := h.provider.Stream(r.Context(), request)
	if err != nil {
		writeError(w, http.StatusBadGateway, "AI_PROVIDER_ERROR", "Trợ lý AI hiện không thể phản hồi. Hãy thử lại.", requestID(r), nil)
		return
	}
	var content strings.Builder
	for event := range events {
		switch event.Type {
		case "ai.delta":
			content.WriteString(event.Content)
		case "ai.unavailable":
			writeJSON(w, map[string]any{"status": "disabled", "message": "Trợ lý AI chưa được cấu hình."})
			return
		case "ai.error":
			writeError(w, http.StatusBadGateway, "AI_PROVIDER_ERROR", "Trợ lý AI hiện không thể phản hồi. Hãy thử lại.", requestID(r), nil)
			return
		}
	}
	writeJSON(w, map[string]any{"status": "ok", "content": content.String()})
}

func (h aiHandlers) owner(w http.ResponseWriter, r *http.Request) (aiOwner, bool) {
	coursePayload, err := h.builder.content.Course(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal error.", requestID(r), nil)
		return aiOwner{}, false
	}
	if coursePayload.Id != r.PathValue("courseId") {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Không tìm thấy khóa học.", requestID(r), nil)
		return aiOwner{}, false
	}
	owner := aiOwner{
		CourseID: coursePayload.Id, CourseVersion: coursePayload.Version,
		OwnerID: r.PathValue("ownerId"), ChapterID: r.URL.Query().Get("chapterId"),
	}
	switch r.PathValue("ownerKind") {
	case "lessons":
		owner.OwnerKind = activity.OwnerKindLesson
	case "assessments":
		owner.OwnerKind = activity.OwnerKindAssessment
		if owner.ChapterID == "" {
			writeError(w, http.StatusUnprocessableEntity, "AI_CONTEXT_INVALID", "Ngữ cảnh Trợ lý AI không hợp lệ.", requestID(r), nil)
			return aiOwner{}, false
		}
	default:
		writeError(w, http.StatusBadRequest, "AI_OWNER_INVALID", "Loại nội dung học không hợp lệ.", requestID(r), nil)
		return aiOwner{}, false
	}
	return owner, true
}
