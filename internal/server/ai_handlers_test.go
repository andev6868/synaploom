package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/ai"
	"github.com/synaploom/synaploom/internal/course"
)

type captureAIProvider struct {
	request ai.Request
	calls   int
}

func (p *captureAIProvider) Stream(_ context.Context, request ai.Request) (<-chan ai.Event, error) {
	p.calls++
	p.request = request
	ch := make(chan ai.Event, 2)
	ch <- ai.Event{Type: "ai.delta", Content: "Xin "}
	ch <- ai.Event{Type: "ai.delta", Content: "chào"}
	close(ch)
	return ch, nil
}

func newAIRouterFixture(t *testing.T, provider ai.Provider) (http.Handler, *SessionManager) {
	t.Helper()
	content, err := course.NewMemoryReference(
		[]byte(courseFixture),
		map[string][]byte{"main-thread": []byte(lessonFixture)},
	)
	if err != nil {
		t.Fatal(err)
	}
	activities := &stubActivityService{
		public: activity.PublicActivityView{
			ID: "quiz", Kind: activity.ActivityKindOrdering, Title: "Sắp xếp",
			Prompt:     map[string]any{"blocks": []any{}},
			Config:     map[string]any{"items": []any{}},
			Evaluation: activity.EvaluationPolicy{Mode: activity.EvaluationModeAutomatic, Points: 1},
			Completion: activity.CompletionPolicy{Required: true},
		},
	}
	sessions := NewSessionManager()
	return NewRouter(
		content, sessions, WithActivities(activities), WithAI(provider, true),
	), sessions
}

func TestAIGenerateAggregatesProviderEvents(t *testing.T) {
	provider := &captureAIProvider{}
	router, sessions := newAIRouterFixture(t, provider)
	cookie := authenticatedCookie(t, router, sessions)
	body := `{"kind":"explain","prompt":"Giải thích","source":"theory","selectedText":"đoạn"}`
	req := httptest.NewRequest(
		http.MethodPost,
		"http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/ai/generate",
		strings.NewReader(body),
	)
	req.Host = "127.0.0.1:3210"
	req.AddCookie(cookie)
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["status"] != "ok" || payload["content"] != "Xin chào" {
		t.Fatalf("payload=%#v", payload)
	}
	if len(provider.request.ContextItems) == 0 {
		t.Fatal("daemon context was not constructed")
	}
}

func TestAIGenerateRejectsInvalidCrossSourceContextBeforeProvider(t *testing.T) {
	provider := &captureAIProvider{}
	router, sessions := newAIRouterFixture(t, provider)
	cookie := authenticatedCookie(t, router, sessions)
	req := httptest.NewRequest(
		http.MethodPost,
		"http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/main-thread/ai/generate",
		strings.NewReader(`{"kind":"explain","prompt":"Giải thích","source":"theory","activityId":"quiz"}`),
	)
	req.Host = "127.0.0.1:3210"
	req.AddCookie(cookie)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	if provider.calls != 0 {
		t.Fatalf("provider calls=%d", provider.calls)
	}
}
