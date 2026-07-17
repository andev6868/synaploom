package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/synaploom/synaploom/internal/runner"
)

type request struct {
	Scenario string `json:"scenario"`
}

type response struct {
	Events []map[string]any `json:"events"`
}

type sink struct{ events []runner.Event }

func (s *sink) Emit(event runner.Event) { s.events = append(s.events, event) }

func main() {
	if len(os.Args) > 1 {
		runHelper(os.Args[1])
		return
	}
	var input request
	if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
		fail(err)
	}
	executable, err := os.Executable()
	if err != nil {
		fail(err)
	}
	runRequest := runner.Request{ExecutionID: "<sessionId>", Program: executable}
	switch input.Scenario {
	case "run":
		runRequest.Args = []string{"helper-run"}
	case "check":
		runRequest.Args = []string{"helper-check"}
	case "timeout":
		runRequest.Args = []string{"helper-sleep"}
		runRequest.Timeout = 50 * time.Millisecond
	case "failed-start":
		runRequest.Program = filepath.Join(os.TempDir(), "synaploom-missing-program")
	default:
		fail(fmt.Errorf("unknown scenario %q", input.Scenario))
	}
	collector := &sink{}
	(runner.Executor{}).Execute(context.Background(), runRequest, collector)
	output := response{Events: make([]map[string]any, 0, len(collector.events))}
	for _, event := range collector.events {
		output.Events = append(output.Events, normalize(event))
	}
	if err := json.NewEncoder(os.Stdout).Encode(output); err != nil {
		fail(err)
	}
}

func runHelper(name string) {
	switch name {
	case "helper-run":
		fmt.Fprint(os.Stdout, "start\nend\ntimeout\n")
	case "helper-check":
		fmt.Fprint(os.Stderr, "Expected: start -> end -> promise -> timeout\nReceived: start -> end -> timeout\n")
		os.Exit(1)
	case "helper-sleep":
		time.Sleep(5 * time.Second)
	default:
		os.Exit(2)
	}
}

func normalize(event runner.Event) map[string]any {
	result := map[string]any{"type": event.Type, "sessionId": "<sessionId>", "lessonId": "event-loop", "timestamp": "<timestamp>"}
	if event.Chunk != "" {
		result["chunk"] = event.Chunk
	}
	if event.ExitCode != nil {
		result["exitCode"] = *event.ExitCode
		result["outputTruncated"] = event.OutputTruncated
	}
	if event.Message != "" {
		result["message"] = "<message>"
	}
	return result
}

func fail(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
