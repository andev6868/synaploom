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

func terminateTree(ctx context.Context, cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	pid := cmd.Process.Pid
	if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	timer := time.NewTimer(terminationGrace)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
	if err := syscall.Kill(-pid, syscall.SIGKILL); err != nil && !errors.Is(err, os.ErrProcessDone) && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	return nil
}
