package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/progression"
	"github.com/synaploom/synaploom/internal/storage"
)

type hierarchicalRouterFixture struct {
	handler     http.Handler
	sessions    *SessionManager
	progression *progression.ServiceImpl
	database    *storage.Database
}

func newHierarchicalRouterFixture(t *testing.T) hierarchicalRouterFixture {
	t.Helper()
	coursePayload := []byte(`{"id":"perf","title":"Performance","description":"desc","version":"1.1.0","currentLessonId":"l2","completedAt":null,"lessons":[{"id":"l1","position":1,"title":"Lesson One","type":"theory","estimatedMinutes":5,"status":"COMPLETED"},{"id":"l2","position":2,"title":"Lesson Two","type":"theory","estimatedMinutes":5,"status":"AVAILABLE"},{"id":"l3","position":3,"title":"Lesson Three","type":"theory","estimatedMinutes":5,"status":"LOCKED"}]}`)
	lesson := func(id, title, status string, position int) []byte {
		payload := map[string]any{"id": id, "title": title, "position": position, "type": "theory", "estimatedMinutes": 5, "blocks": []any{}, "status": status, "readingAcknowledged": false, "latestCheck": nil, "exercise": nil}
		data, _ := json.Marshal(payload)
		return data
	}
	content, err := course.NewMemoryReference(coursePayload, map[string][]byte{"l1": lesson("l1", "Lesson One", "COMPLETED", 1), "l2": lesson("l2", "Lesson Two", "AVAILABLE", 2), "l3": lesson("l3", "Lesson Three", "LOCKED", 3)})
	if err != nil {
		t.Fatal(err)
	}
	database, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	l1 := progression.LessonRef{ID: "l1", ChapterID: "runtime", Position: 1, Required: true, ReadingRequired: true}
	l2 := progression.LessonRef{ID: "l2", ChapterID: "runtime", Position: 2, Required: true, ReadingRequired: true}
	l3 := progression.LessonRef{ID: "l3", ChapterID: "next", Position: 1, Required: true, ReadingRequired: true}
	graph := progression.CourseGraph{ID: "perf", Version: "1.1.0", Chapters: []progression.Chapter{{ID: "runtime", Title: "Runtime", Position: 1, Required: true, Lessons: []progression.LessonRef{l1, l2}, Assessments: []progression.Assessment{{ID: "capstone", ChapterID: "runtime", Title: "Capstone", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}}, {ID: "next", Title: "Next", Position: 2, Required: true, Lessons: []progression.LessonRef{l3}}}, LessonIndex: map[string]progression.LessonRef{"l1": l1, "l2": l2, "l3": l3}}
	progress := progression.NewService(database.SQL, storage.NewHierarchicalProgressRepository(), graph)
	if _, err := progress.Initialize(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := progress.AcknowledgeReading(context.Background(), "l1"); err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	return hierarchicalRouterFixture{handler: NewRouter(content, sessions, WithProgression(progress)), sessions: sessions, progression: progress, database: database}
}

func TestNavigationReturnsReviewWithoutMutatingCurrentLesson(t *testing.T) {
	fixture := newHierarchicalRouterFixture(t)
	cookie := authenticatedCookie(t, fixture.handler, fixture.sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/perf/navigation?viewedId=l1&chapterId=runtime", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	fixture.handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["viewMode"] != "REVIEW" || payload["currentLessonId"] != "l2" {
		t.Fatalf("payload=%v", payload)
	}
	snapshot, err := fixture.progression.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Course.CurrentLessonID != "l2" {
		t.Fatalf("current lesson mutated to %q", snapshot.Course.CurrentLessonID)
	}
}

func TestCanonicalLessonAndShortRedirect(t *testing.T) {
	fixture := newHierarchicalRouterFixture(t)
	cookie := authenticatedCookie(t, fixture.handler, fixture.sessions)
	short := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/courses/perf/lessons/l1", nil)
	short.Host = "127.0.0.1:3210"
	redirect := httptest.NewRecorder()
	fixture.handler.ServeHTTP(redirect, short)
	if redirect.Code != http.StatusPermanentRedirect || redirect.Header().Get("Location") != "/courses/perf/chapters/runtime/lessons/l1" {
		t.Fatalf("status=%d location=%q", redirect.Code, redirect.Header().Get("Location"))
	}

	canonical := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/perf/chapters/runtime/lessons/l1", nil)
	canonical.Host = "127.0.0.1:3210"
	canonical.AddCookie(cookie)
	response := httptest.NewRecorder()
	fixture.handler.ServeHTTP(response, canonical)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	contextPayload := payload["context"].(map[string]any)
	if contextPayload["viewMode"] != "REVIEW" {
		t.Fatalf("context=%v", contextPayload)
	}
}

func TestLockedCanonicalLessonReturnsTypedConflict(t *testing.T) {
	fixture := newHierarchicalRouterFixture(t)
	cookie := authenticatedCookie(t, fixture.handler, fixture.sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/perf/chapters/next/lessons/l3", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	fixture.handler.ServeHTTP(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var payload map[string]any
	_ = json.Unmarshal(response.Body.Bytes(), &payload)
	if payload["code"] != "ITEM_LOCKED" {
		t.Fatalf("payload=%v", payload)
	}
}
