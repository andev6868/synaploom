//go:build !windows

package process

import (
	"context"
	"os/exec"
	"testing"
	"time"
)

func TestConfigureCreatesDedicatedProcessGroup(t *testing.T) {
	cmd := exec.Command("sh", "-c", "sleep 5")
	Configure(cmd)
	if cmd.SysProcAttr == nil || !cmd.SysProcAttr.Setpgid {
		t.Fatal("expected dedicated process group")
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := TerminateTree(ctx, cmd); err != nil {
		t.Fatal(err)
	}
	_ = cmd.Wait()
}
