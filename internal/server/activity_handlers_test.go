package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/course"
)

type stubActivityService struct {
	public      activity.PublicActivityView
	current     *activity.ActivityAttempt
	draft       activity.ActivityAttempt
	submitted   activity.ActivityAttempt
	progress    activity.ActivitySetProgress
	sets        []activity.PublicActivitySetView
	draftErr    error
	submitErr   error
	submitCalls int
}

func (s *stubActivityService) PublicActivity(context.Context, activity.OwnerIdentity, string) (activity.PublicActivityView, error) {
	return s.public, nil
}
func (s *stubActivityService) PublicActivitySets(context.Context, activity.OwnerIdentity) ([]activity.PublicActivitySetView, error) {
	return s.sets, nil
}
func (s *stubActivityService) CurrentAttempt(context.Context, activity.AttemptIdentity) (*activity.ActivityAttempt, error) {
	return s.current, nil
}
func (s *stubActivityService) SaveDraft(context.Context, activity.SaveDraftCommand) (activity.ActivityAttempt, error) {
	return s.draft, s.draftErr
}
func (s *stubActivityService) Submit(context.Context, activity.SubmitCommand) (activity.ActivityAttempt, error) {
	s.submitCalls++
	return s.submitted, s.submitErr
}
func (s *stubActivityService) SetProgress(context.Context, activity.OwnerIdentity, string) (activity.ActivitySetProgress, error) {
	return s.progress, nil
}

func newActivityRouterFixture(t *testing.T, service activity.Service) (http.Handler, *SessionManager) {
	t.Helper()
	content, err := course.NewMemoryReference([]byte(courseFixture), map[string][]byte{"main-thread": []byte(lessonFixture)})
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	return NewRouter(content, sessions, WithActivities(service)), sessions
}

func TestActivityRoutesRequireSessionAndValidateOwnerKind(t *testing.T) {
	stub := &stubActivityService{}
	handler, sessions := newActivityRouterFixture(t, stub)
	unauthorized := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activities/quiz", nil)
	unauthorized.Host = "127.0.0.1:3210"
	unauthorizedResponse := httptest.NewRecorder()
	handler.ServeHTTP(unauthorizedResponse, unauthorized)
	if unauthorizedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status=%d", unauthorizedResponse.Code)
	}

	cookie := authenticatedCookie(t, handler, sessions)
	invalid := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/widgets/main-thread/activities/quiz", nil)
	invalid.Host = "127.0.0.1:3210"
	invalid.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, invalid)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	assertErrorCode(t, response, "ACTIVITY_OWNER_INVALID")
}

func TestActivityGETReturnsAnswerKeyFreePublicView(t *testing.T) {
	stub := &stubActivityService{public: activity.PublicActivityView{
		ID: "quiz", Kind: activity.ActivityKindSingleChoice, Title: "Quiz",
		Prompt:     map[string]any{"blocks": []any{}},
		Config:     map[string]any{"options": []any{map[string]any{"id": "a", "label": "A"}}},
		Evaluation: activity.EvaluationPolicy{Mode: activity.EvaluationModeAutomatic, Points: 1},
		Completion: activity.CompletionPolicy{Required: true},
	}}
	handler, sessions := newActivityRouterFixture(t, stub)
	cookie := authenticatedCookie(t, handler, sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activities/quiz", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if bytes.Contains(response.Body.Bytes(), []byte("correctOptionId")) {
		t.Fatalf("answer key leaked: %s", response.Body.String())
	}
}


func TestActivitySetCatalogEndpointReturnsOrderedPublicSets(t *testing.T) {
	stub := &stubActivityService{sets: []activity.PublicActivitySetView{{
		ID: "practice", Title: "Practice", Policy: activity.ActivitySetPolicy{Purpose: activity.ActivityPurposePractice},
		Activities: []activity.PublicActivityReference{{Required: true, Activity: activity.PublicActivityView{ID: "quiz", Kind: activity.ActivityKindSingleChoice, Title: "Quiz", Prompt: map[string]any{"blocks": []any{}}, Config: map[string]any{"options": []any{}}, Evaluation: activity.EvaluationPolicy{Mode: activity.EvaluationModeAutomatic, Points: 1}, Completion: activity.CompletionPolicy{Required: true}}}},
	}}}
	handler, sessions := newActivityRouterFixture(t, stub)
	cookie := authenticatedCookie(t, handler, sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activity-sets", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var sets []activity.PublicActivitySetView
	if err := json.Unmarshal(response.Body.Bytes(), &sets); err != nil {
		t.Fatal(err)
	}
	if len(sets) != 1 || sets[0].Activities[0].Activity.ID != "quiz" {
		t.Fatalf("sets=%+v", sets)
	}
}

func TestActivityDraftConflictAndMalformedSubmissionUseStableErrors(t *testing.T) {
	stub := &stubActivityService{draftErr: activity.ErrRevisionConflict, submitErr: activity.ErrMalformedAnswer}
	handler, sessions := newActivityRouterFixture(t, stub)
	cookie := authenticatedCookie(t, handler, sessions)

	draft := httptest.NewRequest(http.MethodPut, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activities/quiz/attempts/current/draft", bytes.NewBufferString(`{"answer":{"kind":"single-choice","optionId":"a"},"revision":1}`))
	draft.Host = "127.0.0.1:3210"
	draft.AddCookie(cookie)
	draft.Header.Set("Content-Type", "application/json")
	draftResponse := httptest.NewRecorder()
	handler.ServeHTTP(draftResponse, draft)
	if draftResponse.Code != http.StatusConflict {
		t.Fatalf("draft status=%d body=%s", draftResponse.Code, draftResponse.Body.String())
	}
	assertErrorCode(t, draftResponse, "ACTIVITY_REVISION_CONFLICT")

	submit := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activities/quiz/attempts", bytes.NewBufferString(`{"answer":{"kind":"single-choice"},"idempotencyKey":"one"}`))
	submit.Host = "127.0.0.1:3210"
	submit.AddCookie(cookie)
	submit.Header.Set("Content-Type", "application/json")
	submitResponse := httptest.NewRecorder()
	handler.ServeHTTP(submitResponse, submit)
	if submitResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("submit status=%d body=%s", submitResponse.Code, submitResponse.Body.String())
	}
	assertErrorCode(t, submitResponse, "ACTIVITY_ANSWER_INVALID")
}

func TestActivitySubmissionEndpointIsIdempotentThroughService(t *testing.T) {
	attempt := activity.ActivityAttempt{ID: "attempt-1", CourseID: "frontend-performance-foundations", CourseVersion: "1.0.0", OwnerKind: activity.OwnerKindLesson, OwnerID: "main-thread", ActivityID: "quiz", AttemptNumber: 1, Status: activity.AttemptStatusEvaluated, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"a"}`), RandomSeed: "7"}
	stub := &stubActivityService{submitted: attempt}
	handler, sessions := newActivityRouterFixture(t, stub)
	cookie := authenticatedCookie(t, handler, sessions)
	for range 2 {
		request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activities/quiz/attempts", bytes.NewBufferString(`{"answer":{"kind":"single-choice","optionId":"a"},"idempotencyKey":"same","randomSeed":7}`))
		request.Host = "127.0.0.1:3210"
		request.AddCookie(cookie)
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
		var got activity.ActivityAttempt
		if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got.ID != attempt.ID {
			t.Fatalf("attempt=%+v", got)
		}
	}
	if stub.submitCalls != 2 {
		t.Fatalf("submit calls=%d", stub.submitCalls)
	}
}

func assertErrorCode(t *testing.T, response *httptest.ResponseRecorder, expected string) {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != expected {
		t.Fatalf("expected code=%s payload=%v", expected, payload)
	}
}
