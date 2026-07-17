package runner

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

type collectingSink struct{ events []Event }

func (s *collectingSink) Emit(event Event) { s.events = append(s.events, event) }

func TestExecutorStreamsOrderedEventsAndOneTerminalEvent(t *testing.T) {
	binary := buildFixture(t, "emit")
	sink := &collectingSink{}
	result := (Executor{}).Execute(context.Background(), Request{ExecutionID: "exec-1", Program: binary}, sink)
	if result.Err != nil {
		t.Fatal(result.Err)
	}
	want := []string{EventStarted, EventStdout, EventStderr, EventExited}
	if len(sink.events) != len(want) {
		t.Fatalf("events = %#v", sink.events)
	}
	for i, eventType := range want {
		if sink.events[i].Type != eventType {
			t.Fatalf("event %d = %s, want %s", i, sink.events[i].Type, eventType)
		}
	}
	assertExactlyOneTerminalEvent(t, sink.events)
}

func TestExecutorEmitsFailedToStart(t *testing.T) {
	sink := &collectingSink{}
	result := (Executor{}).Execute(context.Background(), Request{ExecutionID: "exec-2", Program: filepath.Join(t.TempDir(), "missing")}, sink)
	if result.Err == nil {
		t.Fatal("expected start error")
	}
	assertExactlyOneTerminalEvent(t, sink.events)
	if sink.events[len(sink.events)-1].Type != EventFailedToStart {
		t.Fatalf("events = %#v", sink.events)
	}
}

func assertExactlyOneTerminalEvent(t *testing.T, events []Event) {
	t.Helper()
	count := 0
	for _, event := range events {
		if IsTerminalEvent(event) {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("terminal events = %d", count)
	}
}

func buildFixture(t *testing.T, name string) string {
	t.Helper()
	extension := ""
	if runtime.GOOS == "windows" {
		extension = ".exe"
	}
	binary := filepath.Join(t.TempDir(), name+extension)
	command := exec.Command("go", "build", "-o", binary, "./testdata/"+name)
	command.Dir = filepath.Dir(currentFile(t))
	command.Env = os.Environ()
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("build fixture: %v\n%s", err, output)
	}
	return binary
}

func currentFile(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return file
}
