package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/synaploom/synaploom/internal/app"
	"github.com/synaploom/synaploom/internal/cli"
)

func main() {
	command, err := cli.Parse(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		if errors.Is(err, cli.ErrUsage) {
			os.Exit(cli.ExitUsage)
		}
		os.Exit(cli.ExitOperational)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	os.Exit(app.Run(ctx, command))
}
