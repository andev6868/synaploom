package runner

import "time"

// Action is a trusted course-declared executable and argument vector.
type Action struct {
	Program           string
	Args              []string
	WorkingDir        string
	Environment       []string
	Timeout           time.Duration
	MaxOutputByte     int64
	TrustedWorkingDir bool
}
