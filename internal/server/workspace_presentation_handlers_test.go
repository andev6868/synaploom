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
	"github.com/synaploom/synaploom/internal/workspacepresentation"
)

type workspaceServiceStub struct {
	state     workspacepresentation.State
	updateErr error
	command   workspacepresentation.UpdateCommand
}

func (s *workspaceServiceStub) Get(context.Context, string, workspacepresentation.Owner) (workspacepresentation.State, error) {
	return s.state, nil
}
func (s *workspaceServiceStub) Update(_ context.Context, command workspacepresentation.UpdateCommand) (workspacepresentation.State, error) {
	s.command = command
	return s.state, s.updateErr
}
func newWorkspaceRouterFixture(t *testing.T, workspace workspacepresentation.Service, activities activity.Service) (http.Handler, *SessionManager) {
	t.Helper()
	content, err := course.NewMemoryReference([]byte(courseFixture), map[string][]byte{"main-thread": []byte(lessonFixture)})
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	options := []RouterOption{WithWorkspacePresentation(workspace)}
	if activities != nil {
		options = append(options, WithActivities(activities))
	}
	return NewRouter(content, sessions, options...), sessions
}
func workspaceRequest(t *testing.T, handler http.Handler, sessions *SessionManager, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	cookie := authenticatedCookie(t, handler, sessions)
	request := httptest.NewRequest(method, "http://127.0.0.1"+path, bytes.NewBufferString(body))
	request.Host = "127.0.0.1:3210"
	request.AddCookie(cookie)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}
func TestWorkspacePresentationRoutesReturnStateAndRejectUnknownFields(t *testing.T) {
	state := workspacepresentation.State{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson", PaneMode: "collapsed", SplitRatio: 0.45, Revision: 2}
	stub := &workspaceServiceStub{state: state}
	handler, sessions := newWorkspaceRouterFixture(t, stub, nil)
	get := workspaceRequest(t, handler, sessions, http.MethodGet, "/api/v1/courses/course/lessons/lesson/workspace-presentation", "")
	if get.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", get.Code, get.Body.String())
	}
	put := workspaceRequest(t, handler, sessions, http.MethodPut, "/api/v1/courses/course/lessons/lesson/workspace-presentation", `{"focusedActivityId":null,"paneMode":"collapsed","splitRatio":0.45,"userCollapsed":false,"revision":2}`)
	if put.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", put.Code, put.Body.String())
	}
	if stub.command.Revision != 2 {
		t.Fatalf("command=%+v", stub.command)
	}
	unknown := workspaceRequest(t, handler, sessions, http.MethodPut, "/api/v1/courses/course/lessons/lesson/workspace-presentation", `{"focusedActivityId":null,"paneMode":"collapsed","splitRatio":0.45,"userCollapsed":false,"revision":2,"extra":true}`)
	if unknown.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", unknown.Code)
	}
}
func TestWorkspacePresentationConflictContainsCurrentState(t *testing.T) {
	current := workspacepresentation.State{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson", PaneMode: "split", SplitRatio: 0.45, Revision: 4}
	stub := &workspaceServiceStub{state: current, updateErr: workspacepresentation.ConflictError{Current: current}}
	handler, sessions := newWorkspaceRouterFixture(t, stub, nil)
	response := workspaceRequest(t, handler, sessions, http.MethodPut, "/api/v1/courses/course/lessons/lesson/workspace-presentation", `{"focusedActivityId":null,"paneMode":"collapsed","splitRatio":0.45,"userCollapsed":false,"revision":3}`)
	if response.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	details := payload["details"].(map[string]any)
	currentPayload := details["currentWorkspacePresentation"].(map[string]any)
	if currentPayload["revision"] != float64(4) {
		t.Fatalf("payload=%v", payload)
	}
}
func TestActivityStatusesRouteReturnsAuthoredRows(t *testing.T) {
	activities := &stubActivityService{statuses: []activity.ActivityStatus{{ActivityID: "quiz", Status: "DRAFT", AttemptNumber: 1}}}
	workspace := &workspaceServiceStub{}
	handler, sessions := newWorkspaceRouterFixture(t, workspace, activities)
	response := workspaceRequest(t, handler, sessions, http.MethodGet, "/api/v1/courses/frontend-performance-foundations/lessons/main-thread/activity-statuses", "")
	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if !bytes.Contains(response.Body.Bytes(), []byte(`"activityId":"quiz"`)) {
		t.Fatalf("body=%s", response.Body.String())
	}
}
