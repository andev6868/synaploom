package server

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/ai"
	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/runner"
)

type routerOptions struct {
	actions     map[string]runner.Action
	devEvents   <-chan course.DevEvent
	aiProvider  ai.Provider
	aiLocal     bool
	progression LearningProgression
	activities  activity.Service
}

// RouterOption configures optional preview runtime capabilities.
type RouterOption func(*routerOptions)

// WithDevEvents enables development-mode validation event streaming.
func WithDevEvents(events <-chan course.DevEvent) RouterOption {
	return func(options *routerOptions) { options.devEvents = events }
}

// WithAI enables optional AI routes.
func WithAI(provider ai.Provider, local bool) RouterOption {
	return func(options *routerOptions) { options.aiProvider = provider; options.aiLocal = local }
}

// WithActions enables trusted action execution routes.
func WithActions(actions map[string]runner.Action) RouterOption {
	return func(options *routerOptions) { options.actions = actions }
}

// WithActivities enables owner-qualified activity and attempt routes.
func WithActivities(service activity.Service) RouterOption {
	return func(options *routerOptions) { options.activities = service }
}

// WithProgression enables hierarchical navigation and requirement-authoritative mutations.
func WithProgression(service LearningProgression) RouterOption {
	return func(options *routerOptions) { options.progression = service }
}

func NewRouter(service course.Service, sessions *SessionManager, options ...RouterOption) http.Handler {
	configuration := routerOptions{}
	for _, option := range options {
		option(&configuration)
	}
	mux := http.NewServeMux()
	mux.Handle("GET /bootstrap", sessions.BootstrapHandler())
	mux.Handle("POST /bootstrap", sessions.BootstrapHandler())
	handlers := courseHandlers{service: service}
	api := http.NewServeMux()
	api.HandleFunc("GET /api/v1/course", handlers.course)
	api.HandleFunc("GET /api/v1/lessons/current", handlers.currentLesson)
	api.HandleFunc("GET /api/v1/lessons/{lessonId}", handlers.lesson)
	if configuration.progression != nil {
		navigation := navigationHandlers{content: service, progression: configuration.progression}
		assessments := chapterAssessmentHandlers{progression: configuration.progression}
		api.HandleFunc("GET /api/v1/courses/{courseId}/navigation", navigation.navigation)
		api.HandleFunc("GET /api/v1/courses/{courseId}/chapters/{chapterId}/lessons/{lessonId}", navigation.canonicalLesson)
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/reading-complete", navigation.acknowledgeReading)
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/complete", navigation.completeLesson)
		api.HandleFunc("GET /api/v1/chapters/{chapterId}/assessments/{assessmentId}", assessments.get)
		api.HandleFunc("POST /api/v1/chapters/{chapterId}/assessments/{assessmentId}/actions/{actionId}", assessments.action)
	} else {
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/reading-complete", handlers.acknowledgeReading)
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/complete", handlers.completeLesson)
	}
	api.HandleFunc("GET /api/v1/lessons/{lessonId}/workspace/files", handlers.workspaceFiles)
	api.HandleFunc("GET /api/v1/lessons/{lessonId}/workspace/file", handlers.readWorkspaceFile)
	api.HandleFunc("PUT /api/v1/lessons/{lessonId}/workspace/file", handlers.writeWorkspaceFile)
	api.HandleFunc("POST /api/v1/lessons/{lessonId}/workspace/reset", handlers.resetWorkspace)
	if _, ok := service.(course.ActivityPracticeService); ok {
		api.HandleFunc("GET /api/v1/courses/{courseId}/lessons/{lessonId}/activities/{activityId}/workspace/files", handlers.activityWorkspaceFiles)
		api.HandleFunc("GET /api/v1/courses/{courseId}/lessons/{lessonId}/activities/{activityId}/workspace/file", handlers.readActivityWorkspaceFile)
		api.HandleFunc("PUT /api/v1/courses/{courseId}/lessons/{lessonId}/activities/{activityId}/workspace/file", handlers.writeActivityWorkspaceFile)
		api.HandleFunc("POST /api/v1/courses/{courseId}/lessons/{lessonId}/activities/{activityId}/workspace/reset", handlers.resetActivityWorkspace)
	}
	api.HandleFunc("GET /api/v1/preferences/pane-ratio", handlers.getPaneRatio)
	api.HandleFunc("PUT /api/v1/preferences/pane-ratio", handlers.setPaneRatio)
	if configuration.activities != nil {
		activities := activityHandlers{content: service, activity: configuration.activities}
		api.HandleFunc("GET /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activity-sets", activities.listSets)
		api.HandleFunc("GET /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}", activities.get)
		api.HandleFunc("GET /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts/current", activities.current)
		api.HandleFunc("PUT /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts/current/draft", activities.saveDraft)
		api.HandleFunc("POST /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts", activities.submit)
		api.HandleFunc("GET /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activity-sets/{setId}/progress", activities.setProgress)
	}
	if configuration.devEvents != nil {
		api.HandleFunc("GET /api/v1/dev/events", DevEventsHandler(configuration.devEvents))
	}
	if configuration.aiProvider != nil {
		h := aiHandlers{provider: configuration.aiProvider, local: configuration.aiLocal}
		api.HandleFunc("POST /api/v1/ai/disclosure", h.disclosure)
		api.HandleFunc("POST /api/v1/ai/stream", h.stream)
	}
	if activityPractice, ok := service.(course.ActivityPracticeService); ok {
		activityExecutions := activityPracticeExecutionHandlers(activityPractice)
		api.HandleFunc("POST /api/v1/courses/{courseId}/lessons/{lessonId}/activities/{activityId}/actions/{actionId}", activityExecutions.start)
		api.HandleFunc("GET /api/v1/activity-executions/{executionId}/events", activityExecutions.events)
	}
	if practice, ok := service.(course.PracticeService); ok {
		executions := practiceExecutionHandlers(practice)
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/actions/{actionId}", executions.start)
		api.HandleFunc("GET /api/v1/executions/{executionId}/events", executions.events)
	} else if configuration.actions != nil {
		executions := defaultExecutionHandlers(configuration.actions)
		api.HandleFunc("POST /api/v1/lessons/{lessonId}/actions/{actionId}", executions.start)
		api.HandleFunc("GET /api/v1/executions/{executionId}/events", executions.events)
	}
	api.HandleFunc("/api/v1/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "ROUTE_NOT_FOUND", "API route not found.", requestID(r), nil)
	})
	mux.Handle("/api/v1/", sessions.RequireSession(api))
	if configuration.progression != nil {
		navigation := navigationHandlers{content: service, progression: configuration.progression}
		mux.HandleFunc("GET /courses/{courseId}/lessons/{lessonId}", navigation.shortLessonRedirect)
	}
	spa := newSPAHandler()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		payload, err := service.Course(r.Context())
		if err != nil || payload.CurrentLessonId == nil || *payload.CurrentLessonId == "" {
			spa.ServeHTTP(w, r)
			return
		}
		target := fmt.Sprintf("/courses/%s/lessons/%s", url.PathEscape(payload.Id), url.PathEscape(*payload.CurrentLessonId))
		if configuration.progression != nil {
			if chapterID, ok := configuration.progression.LessonChapter(*payload.CurrentLessonId); ok {
				target = fmt.Sprintf("/courses/%s/chapters/%s/lessons/%s", url.PathEscape(payload.Id), url.PathEscape(chapterID), url.PathEscape(*payload.CurrentLessonId))
			}
		}
		http.Redirect(w, r, target, http.StatusTemporaryRedirect)
	})
	mux.Handle("/", spa)
	return SecurityMiddleware(withRequestID(mux))
}
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := make([]byte, 12)
		_, _ = rand.Read(raw)
		r.Header.Set("X-Synaploom-Request-ID", hex.EncodeToString(raw))
		next.ServeHTTP(w, r)
	})
}
func requestID(r *http.Request) string { return r.Header.Get("X-Synaploom-Request-ID") }
