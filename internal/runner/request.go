package runner

import "time"

// Request is an immutable execution request produced from a trusted action ID.
type Request struct {
	ExecutionID   string
	Program       string
	Args          []string
	WorkingDir    string
	Environment   []string
	Timeout       time.Duration
	MaxOutputByte int64
}
