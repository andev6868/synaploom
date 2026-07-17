package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

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
