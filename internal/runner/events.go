package runner

import "time"

const (
	EventStarted       = "process.started"
	EventStdout        = "process.stdout"
	EventStderr        = "process.stderr"
	EventExited        = "process.exited"
	EventTimedOut      = "process.timed_out"
	EventKilled        = "process.killed"
	EventFailedToStart = "process.failed_to_start"
)

// Event is the immutable process event shared by the server and conformance harness.
type Event struct {
	Type            string    `json:"type"`
	ExecutionID     string    `json:"executionId"`
	Timestamp       time.Time `json:"timestamp"`
	Chunk           string    `json:"chunk,omitempty"`
	ExitCode        *int      `json:"exitCode,omitempty"`
	Message         string    `json:"message,omitempty"`
	OutputTruncated bool      `json:"outputTruncated,omitempty"`
}

func IsTerminalEvent(event Event) bool {
	switch event.Type {
	case EventExited, EventTimedOut, EventKilled, EventFailedToStart:
		return true
	default:
		return false
	}
}
