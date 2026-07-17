package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/course"
)

func TestCourseAndLessonPayloads(t *testing.T) {
	service, err := course.NewMemoryReference([]byte(courseFixture), map[string][]byte{"main-thread": []byte(lessonFixture)})
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	handler := NewRouter(service, sessions)
	cookie := authenticatedCookie(t, handler, sessions)

	for _, test := range []struct {
		path     string
		expected string
	}{
		{"/api/v1/course", courseFixture},
		{"/api/v1/lessons/main-thread", lessonFixture},
	} {
		request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1"+test.path, nil)
		request.Host = "127.0.0.1:3210"
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s status=%d body=%s", test.path, response.Code, response.Body.String())
		}
		assertJSONEquivalent(t, response.Body.Bytes(), []byte(test.expected))
	}
}

func TestMissingLessonUsesTypedErrorEnvelope(t *testing.T) {
	service, err := course.NewMemoryReference([]byte(courseFixture), nil)
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	handler := NewRouter(service, sessions)
	cookie := authenticatedCookie(t, handler, sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/lessons/missing", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("status=%d", response.Code)
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != "LESSON_NOT_FOUND" || payload["requestId"] == "" {
		t.Fatalf("payload=%v", payload)
	}
}

func authenticatedCookie(t *testing.T, handler http.Handler, sessions *SessionManager) *http.Cookie {
	t.Helper()
	token, err := sessions.IssueBootstrapToken()
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/bootstrap?token="+token, nil)
	request.Host = "127.0.0.1:3210"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("bootstrap status=%d", response.Code)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatal("missing session cookie")
	}
	return cookies[0]
}

func assertJSONEquivalent(t *testing.T, actual, expected []byte) {
	t.Helper()
	var a, e any
	if err := json.Unmarshal(actual, &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(expected, &e); err != nil {
		t.Fatal(err)
	}
	if string(mustJSON(e)) != string(mustJSON(a)) {
		t.Fatalf("expected %s\nactual %s", mustJSON(e), mustJSON(a))
	}
}
func mustJSON(v any) []byte { data, _ := json.Marshal(v); return data }

const courseFixture = `{"id":"frontend-performance-foundations","title":"Frontend Performance Foundations","description":"desc","version":"1.0.0","currentLessonId":"main-thread","completedAt":null,"lessons":[{"id":"main-thread","position":1,"title":"Main Thread","type":"theory","estimatedMinutes":12,"status":"AVAILABLE"}]}`
const lessonFixture = `{"id":"main-thread","title":"Main Thread","position":1,"type":"theory","estimatedMinutes":12,"blocks":[{"type":"heading","level":2,"text":"Goal"}],"status":"AVAILABLE","readingAcknowledged":false,"latestCheck":null,"exercise":null}`

func TestReadingCompleteAndLessonCompleteRoutes(t *testing.T) {
	service, err := course.OpenFilesystemService(filepath.Join("..", "..", "examples", "frontend-performance-foundations"))
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	handler := NewRouter(service, sessions)
	cookie := authenticatedCookie(t, handler, sessions)

	post := func(path string) *httptest.ResponseRecorder {
		t.Helper()
		request := httptest.NewRequest(http.MethodPost, "http://127.0.0.1"+path, nil)
		request.Host = "127.0.0.1:3210"
		request.AddCookie(cookie)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}

	reading := post("/api/v1/lessons/main-thread/reading-complete")
	if reading.Code != http.StatusOK {
		t.Fatalf("reading status=%d body=%s", reading.Code, reading.Body.String())
	}
	complete := post("/api/v1/lessons/main-thread/complete")
	if complete.Code != http.StatusOK {
		t.Fatalf("complete status=%d body=%s", complete.Code, complete.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(complete.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	next, _ := payload["nextLesson"].(map[string]any)
	if payload["completed"] != true || payload["courseCompleted"] != false || next["id"] != "event-loop" {
		t.Fatalf("payload=%v", payload)
	}
}
