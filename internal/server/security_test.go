package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSecurityRejectsNonLoopbackHostAndOrigin(t *testing.T) {
	handler := SecurityMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for _, test := range []struct{ name, host, origin string }{
		{"host", "example.com", ""},
		{"origin", "127.0.0.1:3000", "https://example.com"},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/test", nil)
			request.Host = test.host
			if test.origin != "" {
				request.Header.Set("Origin", test.origin)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != http.StatusForbidden {
				t.Fatalf("status=%d", response.Code)
			}
		})
	}
}

func TestSecuritySetsLocalHeaders(t *testing.T) {
	handler := SecurityMiddleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/course", nil)
	request.Host = "127.0.0.1:3210"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("missing nosniff")
	}
	if response.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("missing CSP")
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("cache=%q", response.Header().Get("Cache-Control"))
	}
}
