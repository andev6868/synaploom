//go:build !windows

package process

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"syscall"
	"time"
)

const terminationGrace = 250 * time.Millisecond

func configure(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func signalTree(cmd *exec.Cmd, signal syscall.Signal) error {
	if cmd.Process == nil {
		return nil
	}

	err := syscall.Kill(-cmd.Process.Pid, signal)
	if err == nil || errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH) {
		return nil
	}

	// Some macOS execution environments allow signalling a direct child but
	// reject signalling its process group with EPERM. Preserve process-group
	// termination where supported and fall back only for that restriction.
	if errors.Is(err, syscall.EPERM) {
		err = cmd.Process.Signal(signal)
		if err == nil || errors.Is(err, os.ErrProcessDone) || errors.Is(err, syscall.ESRCH) {
			return nil
		}
	}

	return err
}

func terminateTree(ctx context.Context, cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	if err := signalTree(cmd, syscall.SIGTERM); err != nil {
		return err
	}
	timer := time.NewTimer(terminationGrace)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
	if err := signalTree(cmd, syscall.SIGKILL); err != nil {
		return err
	}
	return nil
}
