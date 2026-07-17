package server

import (
	"context"
	"errors"
	"net/http"
	"net/url"

	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/progression"
)

// LearningProgression is the server-facing hierarchical progression capability.
type LearningProgression interface {
	CourseID() string
	LessonChapter(string) (string, bool)
	Navigation(context.Context, progression.ItemRef) (progression.LearningNavigation, error)
	LessonView(context.Context, string) (progression.LessonView, error)
	ChapterAssessment(context.Context, string, string) (progression.ChapterAssessmentView, error)
	AcknowledgeReading(context.Context, string) (progression.MutationResult, error)
	CompleteLesson(context.Context, string) (progression.MutationResult, error)
	RecordChapterAssessmentResult(context.Context, string, string, progression.AttemptResult) (progression.MutationResult, error)
}

type navigationHandlers struct {
	content     course.Service
	progression LearningProgression
}

func (h navigationHandlers) navigation(w http.ResponseWriter, r *http.Request) {
	courseID := r.PathValue("courseId")
	if courseID != h.progression.CourseID() {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found.", requestID(r), nil)
		return
	}
	viewed := progression.ItemRef{}
	if id := r.URL.Query().Get("viewedId"); id != "" {
		viewed.ID = id
		viewed.ChapterID = r.URL.Query().Get("chapterId")
		switch r.URL.Query().Get("viewedKind") {
		case "assessment":
			viewed.Kind = progression.ItemChapterAssessment
		default:
			viewed.Kind = progression.ItemLesson
		}
	}
	navigation, err := h.progression.Navigation(r.Context(), viewed)
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, navigationPayload(navigation))
}

func (h navigationHandlers) canonicalLesson(w http.ResponseWriter, r *http.Request) {
	courseID := r.PathValue("courseId")
	chapterID := r.PathValue("chapterId")
	lessonID := r.PathValue("lessonId")
	if courseID != h.progression.CourseID() {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found.", requestID(r), nil)
		return
	}
	owner, ok := h.progression.LessonChapter(lessonID)
	if !ok || owner != chapterID {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	lesson, err := h.content.Lesson(r.Context(), lessonID)
	if err != nil {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	view, err := h.progression.LessonView(r.Context(), lessonID)
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"lesson": lesson, "context": lessonViewContextPayload(view)})
}

func (h navigationHandlers) shortLessonRedirect(w http.ResponseWriter, r *http.Request) {
	courseID := r.PathValue("courseId")
	lessonID := r.PathValue("lessonId")
	if courseID != h.progression.CourseID() {
		writeError(w, http.StatusNotFound, "COURSE_NOT_FOUND", "Course not found.", requestID(r), nil)
		return
	}
	chapterID, ok := h.progression.LessonChapter(lessonID)
	if !ok {
		writeError(w, http.StatusNotFound, "LESSON_NOT_FOUND", "Lesson not found.", requestID(r), nil)
		return
	}
	target := "/courses/" + url.PathEscape(courseID) + "/chapters/" + url.PathEscape(chapterID) + "/lessons/" + url.PathEscape(lessonID)
	http.Redirect(w, r, target, http.StatusPermanentRedirect)
}

func (h navigationHandlers) acknowledgeReading(w http.ResponseWriter, r *http.Request) {
	result, err := h.progression.AcknowledgeReading(r.Context(), r.PathValue("lessonId"))
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"navigation": navigationPayloadFromEvaluation(h.progression.CourseID(), result.Evaluation)})
}

func (h navigationHandlers) completeLesson(w http.ResponseWriter, r *http.Request) {
	result, err := h.progression.CompleteLesson(r.Context(), r.PathValue("lessonId"))
	if err != nil {
		writeProgressionError(w, r, err)
		return
	}
	writeJSON(w, map[string]any{"completed": true, "navigation": navigationPayloadFromEvaluation(h.progression.CourseID(), result.Evaluation)})
}

func navigationPayload(n progression.LearningNavigation) map[string]any {
	chapters := make([]map[string]any, 0, len(n.Chapters))
	for _, chapter := range n.Chapters {
		lessons := make([]map[string]any, 0, len(chapter.Lessons))
		for _, lesson := range chapter.Lessons {
			lessons = append(lessons, map[string]any{
				"id": lesson.ID, "title": lesson.ID, "status": lesson.Status, "required": lesson.Required,
				"current": lesson.Current, "viewed": lesson.Viewed, "blockingRequirements": []any{},
			})
		}
		assessments := make([]map[string]any, 0, len(chapter.Assessments))
		for _, assessment := range chapter.Assessments {
			assessments = append(assessments, map[string]any{
				"id": assessment.ID, "title": assessment.ID, "status": assessment.Status, "required": assessment.Required,
				"viewed": assessment.Viewed, "blockingRequirements": []any{},
			})
		}
		chapters = append(chapters, map[string]any{"id": chapter.ID, "title": chapter.Title, "status": chapter.Status, "required": chapter.Required, "lessons": lessons, "assessments": assessments})
	}
	var returnTarget any
	if n.ReturnTarget != nil {
		returnTarget = map[string]any{"type": n.ReturnTarget.Type, "id": n.ReturnTarget.ID, "chapterId": nil, "label": "Quay lại bài đang học"}
	}
	return map[string]any{
		"courseId": n.CourseID, "currentLessonId": nullableString(n.CurrentLessonID), "viewedItemId": n.ViewedItemID,
		"viewMode": n.ViewMode, "chapters": chapters, "returnTarget": returnTarget, "nextAction": nextActionPayload(n.NextAction),
	}
}

func navigationPayloadFromEvaluation(courseID string, e progression.Evaluation) map[string]any {
	return map[string]any{"courseId": courseID, "currentLessonId": nullableString(e.CurrentLessonID), "courseStatus": e.CourseStatus}
}

func lessonViewContextPayload(view progression.LessonView) map[string]any {
	var chapterID string
	for _, chapter := range view.Navigation.Chapters {
		for _, lesson := range chapter.Lessons {
			if lesson.ID == view.Lesson.LessonID {
				chapterID = chapter.ID
			}
		}
	}
	var returnTarget any
	if view.Navigation.ReturnTarget != nil {
		returnTarget = map[string]any{"type": view.Navigation.ReturnTarget.Type, "id": view.Navigation.ReturnTarget.ID, "chapterId": chapterID, "label": "Quay lại bài đang học"}
	}
	return map[string]any{
		"chapterId":        chapterID,
		"status":           view.Lesson.Status,
		"required":         true,
		"readingCompleted": requirementSatisfied(view.Lesson.Requirements, "reading"),
		"requirements":     requirementPayloads(view.Lesson.Requirements),
		"viewMode":         view.Navigation.ViewMode,
		"currentLessonId":  nullableString(view.Navigation.CurrentLessonID),
		"returnTarget":     returnTarget,
		"nextAction":       nextActionPayload(view.Navigation.NextAction),
	}
}

func nextActionPayload(action progression.NextAction) map[string]any {
	payload := map[string]any{"type": action.Type}
	switch action.Type {
	case progression.NextActionReturnToCurrent, progression.NextActionAcknowledgeReading, progression.NextActionContinueToLesson:
		payload["chapterId"] = action.Target.ChapterID
		payload["lessonId"] = action.Target.ID
	case progression.NextActionStartRequiredPractice, progression.NextActionRetryRequiredPractice:
		payload["chapterId"] = action.Target.ChapterID
		payload["lessonId"] = action.Target.ID
		payload["practiceId"] = action.RequirementID
	case progression.NextActionStartChapterAssessment, progression.NextActionRetryChapterAssessment:
		payload["chapterId"] = action.Target.ChapterID
		payload["assessmentId"] = action.Target.ID
	case progression.NextActionContinueToChapter:
		payload["chapterId"] = action.Target.ID
	case progression.NextActionViewCourseSummary:
		payload["courseId"] = action.Target.ID
	}
	return payload
}

func requirementPayloads(requirements []progression.RequirementView) []map[string]any {
	result := make([]map[string]any, 0, len(requirements))
	for _, requirement := range requirements {
		var latest any
		if requirement.LatestPassed != nil {
			latest = *requirement.LatestPassed
		}
		result = append(result, map[string]any{"id": requirement.ID, "kind": requirement.Kind, "required": requirement.Required, "satisfied": requirement.Satisfied, "attempted": requirement.Attempted, "latestPassed": latest})
	}
	return result
}

func requirementSatisfied(requirements []progression.RequirementView, kind string) bool {
	for _, requirement := range requirements {
		if requirement.Kind == kind {
			return requirement.Satisfied
		}
	}
	return false
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func isProgressionError(err error) bool {
	var locked *progression.ItemLockedError
	var unknown *progression.UnknownItemError
	return errors.As(err, &locked) || errors.As(err, &unknown) || errors.Is(err, progression.ErrRequirementUnsatisfied)
}
