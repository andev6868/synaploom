package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/webassets"
)

func TestRootRedirectsToCanonicalCurrentLesson(t *testing.T) {
	service, err := course.NewMemoryReference([]byte(courseFixture), map[string][]byte{"main-thread": []byte(lessonFixture)})
	if err != nil {
		t.Fatal(err)
	}
	handler := NewRouter(service, NewSessionManager())
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/", nil)
	request.Host = "127.0.0.1:3210"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusTemporaryRedirect {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	want := "/courses/frontend-performance-foundations/lessons/main-thread"
	if got := response.Header().Get("Location"); got != want {
		t.Fatalf("location=%q want=%q", got, want)
	}
}

func TestSPAFallbackDoesNotInterceptAPI(t *testing.T) {
	service, err := course.NewMemoryReference([]byte(courseFixture), nil)
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	handler := NewRouter(service, sessions)

	spa := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/learn/course/lesson", nil)
	request.Host = "127.0.0.1:3210"
	handler.ServeHTTP(spa, request)
	if spa.Code != http.StatusOK {
		t.Fatalf("spa status=%d", spa.Code)
	}
	if !strings.Contains(spa.Header().Get("Content-Type"), "text/html") {
		t.Fatalf("content-type=%q", spa.Header().Get("Content-Type"))
	}
	if spa.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("cache=%q", spa.Header().Get("Cache-Control"))
	}

	cookie := authenticatedCookie(t, handler, sessions)
	api := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/missing", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	handler.ServeHTTP(api, request)
	if api.Code != http.StatusNotFound {
		t.Fatalf("api status=%d", api.Code)
	}
	if !strings.Contains(api.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("content-type=%q", api.Header().Get("Content-Type"))
	}
}

func TestHashedAssetsAreImmutable(t *testing.T) {
	service, _ := course.NewMemoryReference([]byte(courseFixture), nil)
	handler := NewRouter(service, NewSessionManager())
	var asset string
	for _, candidate := range webassets.Inventory() {
		if strings.HasPrefix(candidate, "dist/assets/") && strings.HasSuffix(candidate, ".js") {
			asset = strings.TrimPrefix(candidate, "dist/")
			break
		}
	}
	if asset == "" {
		t.Fatal("embedded inventory has no JavaScript bundle")
	}
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/"+asset, nil)
	request.Host = "127.0.0.1:3210"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d", response.Code)
	}
	if response.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Fatalf("cache=%q", response.Header().Get("Cache-Control"))
	}
}
