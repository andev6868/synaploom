package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/server"
	"github.com/synaploom/synaploom/internal/storage"
)

func TestConfigureRouterRegistersProgressionRoutesForFilesystemCourse(t *testing.T) {
	service, err := course.OpenFilesystemService(filepath.Join("..", "..", "examples", "frontend-performance-foundations"))
	if err != nil {
		t.Fatal(err)
	}
	database, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = database.Close() })
	sessions := server.NewSessionManager()
	handler, err := configureRouter(context.Background(), service, sessions, database)
	if err != nil {
		t.Fatal(err)
	}
	token, err := sessions.IssueBootstrapToken()
	if err != nil {
		t.Fatal(err)
	}
	bootstrap := httptest.NewRecorder()
	bootstrapRequest := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/bootstrap?token="+token, nil)
	bootstrapRequest.Host = "127.0.0.1:3210"
	handler.ServeHTTP(bootstrap, bootstrapRequest)
	cookies := bootstrap.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("bootstrap cookies=%d", len(cookies))
	}
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/navigation", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookies[0])
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}

	activityRequest := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/courses/frontend-performance-foundations/lessons/event-loop/activities/event-loop-order", nil)
	activityRequest.Host = "127.0.0.1:3210"
	activityRequest.AddCookie(cookies[0])
	activityResponse := httptest.NewRecorder()
	handler.ServeHTTP(activityResponse, activityRequest)
	if activityResponse.Code != http.StatusOK {
		t.Fatalf("activity status=%d body=%s", activityResponse.Code, activityResponse.Body.String())
	}
}
