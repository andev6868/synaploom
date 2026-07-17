package process

import (
	"context"
	"os/exec"
)

// Configure applies platform-specific process-group or job-object settings before Start.
func Configure(cmd *exec.Cmd) { configure(cmd) }

// TerminateTree terminates the command and descendants created by it.
func TerminateTree(ctx context.Context, cmd *exec.Cmd) error { return terminateTree(ctx, cmd) }
