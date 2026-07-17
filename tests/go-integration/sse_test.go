package gointegration

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/runner"
	"github.com/synaploom/synaploom/internal/server"
)

func TestExecutionSSEClosesAfterTerminalEvent(t *testing.T) {
	courseService, err := course.NewMemoryReference([]byte(courseJSON), map[string][]byte{"lesson": []byte(lessonJSON)})
	if err != nil {
		t.Fatal(err)
	}
	action := runner.Action{Program: os.Args[0], Args: []string{"-test.run=TestSSEHelperProcess"}, Environment: append(os.Environ(), "GO_WANT_SSE_HELPER=1"), Timeout: 5 * time.Second, MaxOutputByte: 4096}
	sessions := server.NewSessionManager()
	httpServer := httptest.NewServer(server.NewRouter(courseService, sessions, server.WithActions(map[string]runner.Action{"run": action})))
	defer httpServer.Close()
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar}
	token, err := sessions.IssueBootstrapToken()
	if err != nil {
		t.Fatal(err)
	}
	request, _ := http.NewRequest(http.MethodPost, httpServer.URL+"/bootstrap?token="+token, nil)
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("bootstrap=%d", response.StatusCode)
	}

	request, _ = http.NewRequest(http.MethodPost, httpServer.URL+"/api/v1/lessons/lesson/actions/run", nil)
	response, err = client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	var session struct {
		EventsURL string `json:"eventsUrl"`
	}
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()

	response, err = client.Get(httpServer.URL + session.EventsURL)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	terminal := 0
	scanner := bufio.NewScanner(response.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var event runner.Event
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &event); err != nil {
			t.Fatal(err)
		}
		if runner.IsTerminalEvent(event) {
			terminal++
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	if terminal != 1 {
		t.Fatalf("terminal events=%d", terminal)
	}
}

func TestSSEHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_SSE_HELPER") != "1" {
		return
	}
	fmt.Print("integration")
	os.Exit(0)
}

const courseJSON = `{"id":"course","title":"Course","description":"desc","version":"1.0.0","currentLessonId":"lesson","completedAt":null,"lessons":[{"id":"lesson","position":1,"title":"Lesson","type":"practice","estimatedMinutes":1,"status":"AVAILABLE"}]}`
const lessonJSON = `{"id":"lesson","title":"Lesson","position":1,"type":"practice","estimatedMinutes":1,"blocks":[],"status":"AVAILABLE","readingAcknowledged":false,"latestCheck":null,"exercise":null}`
