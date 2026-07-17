package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUnknownChapterAssessmentReturnsTypedNotFound(t *testing.T) {
	fixture := newHierarchicalRouterFixture(t)
	cookie := authenticatedCookie(t, fixture.handler, fixture.sessions)
	request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1/api/v1/chapters/runtime/assessments/missing", nil)
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	fixture.handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
}
