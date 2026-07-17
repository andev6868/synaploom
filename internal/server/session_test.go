package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBootstrapTokenIsSingleUse(t *testing.T) {
	sessions := NewSessionManager()
	token, err := sessions.IssueBootstrapToken()
	if err != nil {
		t.Fatal(err)
	}
	handler := sessions.BootstrapHandler()

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodPost, "/bootstrap?token="+token, nil))
	if first.Code != http.StatusNoContent {
		t.Fatalf("first exchange status=%d", first.Code)
	}
	if len(first.Result().Cookies()) != 1 {
		t.Fatal("expected session cookie")
	}

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, httptest.NewRequest(http.MethodPost, "/bootstrap?token="+token, nil))
	if second.Code != http.StatusUnauthorized {
		t.Fatalf("second exchange status=%d", second.Code)
	}
}

func TestSessionCookieProtectsAPI(t *testing.T) {
	sessions := NewSessionManager()
	protected := sessions.RequireSession(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	response := httptest.NewRecorder()
	protected.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/course", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", response.Code)
	}
}
