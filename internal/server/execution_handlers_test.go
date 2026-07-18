package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/runner"
)

func TestExecutionStreamClosesAfterOneTerminalEvent(t *testing.T) {
	service, err := course.NewMemoryReference([]byte(courseFixture), map[string][]byte{"main-thread": []byte(lessonFixture)})
	if err != nil {
		t.Fatal(err)
	}
	sessions := NewSessionManager()
	action := runner.Action{Program: os.Args[0], Args: []string{"-test.run=TestExecutionHelperProcess", "--"}, Environment: append(os.Environ(), "GO_WANT_EXECUTION_HELPER=1"), Timeout: 5 * time.Second, MaxOutputByte: 4096}
	handler := NewRouter(service, sessions, WithActions(map[string]runner.Action{"run": action}))
	cookie := authenticatedCookie(t, handler, sessions)

	post := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/v1/lessons/main-thread/actions/run", nil)
	post.Host = "127.0.0.1:3210"
	post.AddCookie(cookie)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, post)
	if created.Code != http.StatusAccepted {
		t.Fatalf("status=%d body=%s", created.Code, created.Body.String())
	}
	var session struct{ SessionID, EventsURL string }
	if err := json.Unmarshal(created.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if session.SessionID == "" || session.EventsURL == "" {
		t.Fatalf("session=%+v", session)
	}

	get := httptest.NewRequest(http.MethodGet, "http://127.0.0.1"+session.EventsURL, nil)
	get.Host = "127.0.0.1:3210"
	get.AddCookie(cookie)
	stream := httptest.NewRecorder()
	handler.ServeHTTP(stream, get)
	events := decodeSSEEvents(t, stream.Body.String())
	terminal := 0
	for _, event := range events {
		if runner.IsTerminalEvent(event) {
			terminal++
		}
	}
	if terminal != 1 {
		t.Fatalf("terminal=%d events=%v", terminal, events)
	}
	if len(events) < 3 || events[0].Type != runner.EventStarted || events[len(events)-1].Type != runner.EventExited {
		t.Fatalf("events=%v", events)
	}

	reconnect := httptest.NewRecorder()
	handler.ServeHTTP(reconnect, get.Clone(get.Context()))
	if reconnect.Code != http.StatusGone {
		t.Fatalf("reconnect status=%d", reconnect.Code)
	}
}

func TestExecutionHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_EXECUTION_HELPER") != "1" {
		return
	}
	fmt.Fprint(os.Stdout, "hello")
	fmt.Fprint(os.Stderr, "warning")
	os.Exit(0)
}

func decodeSSEEvents(t *testing.T, value string) []runner.Event {
	t.Helper()
	var events []runner.Event
	scanner := bufio.NewScanner(strings.NewReader(value))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var event runner.Event
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event); err != nil {
			t.Fatal(err)
		}
		events = append(events, event)
	}
	return events
}

type activityPracticeStub struct {
	action   runner.Action
	recorded chan [4]string
}

func (s *activityPracticeStub) Course(context.Context) (contracts.CoursePayload, error) {
	return contracts.CoursePayload{}, nil
}

func (s *activityPracticeStub) Lesson(context.Context, string) (contracts.LessonPayload, error) {
	return contracts.LessonPayload{}, nil
}

func (s *activityPracticeStub) WorkspaceFilesForActivity(_ context.Context, lessonID, activityID string) ([]string, error) {
	if lessonID != "lesson" || activityID != "lab" {
		return nil, course.ErrExerciseNotFound
	}
	return []string{"index.js"}, nil
}

func (s *activityPracticeStub) ReadWorkspaceFileForActivity(context.Context, string, string, string) ([]byte, error) {
	return []byte("console.log('ok')\n"), nil
}

func (s *activityPracticeStub) WriteWorkspaceFileForActivity(context.Context, string, string, string, []byte) error {
	return nil
}

func (s *activityPracticeStub) ResetWorkspaceForActivity(context.Context, string, string) error {
	return nil
}

func (s *activityPracticeStub) ResolveActivityAction(_ context.Context, lessonID, activityID, actionID string) (runner.Action, error) {
	if lessonID != "lesson" || activityID != "lab" || actionID != "check" {
		return runner.Action{}, runner.ErrActionNotFound
	}
	return s.action, nil
}

func (s *activityPracticeStub) RecordActivityActionResult(_ context.Context, lessonID, activityID, actionID, executionID string, _ runner.Result) error {
	s.recorded <- [4]string{lessonID, activityID, actionID, executionID}
	return nil
}

func TestActivityExecutionUsesOwnerQualifiedRouteAndRecorder(t *testing.T) {
	service := &activityPracticeStub{
		action: runner.Action{
			Program: os.Args[0], Args: []string{"-test.run=TestExecutionHelperProcess", "--"},
			Environment: append(os.Environ(), "GO_WANT_EXECUTION_HELPER=1"), Timeout: 5 * time.Second,
			MaxOutputByte: 4096,
		},
		recorded: make(chan [4]string, 1),
	}
	sessions := NewSessionManager()
	handler := NewRouter(service, sessions)
	cookie := authenticatedCookie(t, handler, sessions)

	post := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/v1/courses/course/lessons/lesson/activities/lab/actions/check", nil)
	post.Host = "127.0.0.1:3210"
	post.AddCookie(cookie)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, post)
	if created.Code != http.StatusAccepted {
		t.Fatalf("status=%d body=%s", created.Code, created.Body.String())
	}
	var session struct{ SessionID, EventsURL string }
	if err := json.Unmarshal(created.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(session.EventsURL, "/api/v1/activity-executions/") {
		t.Fatalf("eventsUrl=%q", session.EventsURL)
	}

	get := httptest.NewRequest(http.MethodGet, "http://127.0.0.1"+session.EventsURL, nil)
	get.Host = "127.0.0.1:3210"
	get.AddCookie(cookie)
	stream := httptest.NewRecorder()
	handler.ServeHTTP(stream, get)
	if stream.Code != http.StatusOK {
		t.Fatalf("stream status=%d body=%s", stream.Code, stream.Body.String())
	}

	select {
	case recorded := <-service.recorded:
		if recorded != [4]string{"lesson", "lab", "check", session.SessionID} {
			t.Fatalf("recorded=%v", recorded)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("activity result was not recorded")
	}
}
