package runner

import (
	"context"
	"errors"
	"io"
	"os/exec"

	platformprocess "github.com/synaploom/synaploom/internal/platform/process"
	"sync"
	"time"
)

// Result summarizes one execution after its terminal event has been emitted.
type Result struct {
	ExitCode *int
	Err      error
}

// Executor runs trusted structured requests without invoking a shell.
type Executor struct{}

func (Executor) Execute(ctx context.Context, request Request, sink EventSink) Result {
	parentCtx := ctx
	if request.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, request.Timeout)
		defer cancel()
	}
	if err := ctx.Err(); err != nil {
		eventType := EventKilled
		if errors.Is(err, context.DeadlineExceeded) {
			eventType = EventTimedOut
		}
		sink.Emit(Event{Type: eventType, ExecutionID: request.ExecutionID, Timestamp: time.Now().UTC()})
		return Result{Err: err}
	}
	command := exec.CommandContext(ctx, request.Program, request.Args...)
	platformprocess.Configure(command)
	command.Cancel = func() error { return platformprocess.TerminateTree(context.Background(), command) }
	command.Dir = request.WorkingDir
	if request.Environment != nil {
		command.Env = append([]string(nil), request.Environment...)
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		return emitFailedToStart(request, sink, err)
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		return emitFailedToStart(request, sink, err)
	}
	if err := command.Start(); err != nil {
		return emitFailedToStart(request, sink, err)
	}

	sink.Emit(Event{Type: EventStarted, ExecutionID: request.ExecutionID, Timestamp: time.Now().UTC()})
	events := make(chan Event, 16)
	budget := NewBudget(request.MaxOutputByte)
	var readers sync.WaitGroup
	readers.Add(2)
	go readStream(&readers, stdout, EventStdout, request.ExecutionID, budget, events)
	go readStream(&readers, stderr, EventStderr, request.ExecutionID, budget, events)
	go func() {
		readers.Wait()
		close(events)
	}()
	for event := range events {
		sink.Emit(event)
	}

	waitErr := command.Wait()
	exitCode := 0
	if waitErr != nil {
		var exitError *exec.ExitError
		if errors.As(waitErr, &exitError) {
			exitCode = exitError.ExitCode()
		} else {
			exitCode = -1
		}
	}
	terminalType := EventExited
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		terminalType = EventTimedOut
	} else if ctx.Err() != nil || parentCtx.Err() != nil {
		terminalType = EventKilled
	}
	sink.Emit(Event{Type: terminalType, ExecutionID: request.ExecutionID, Timestamp: time.Now().UTC(), ExitCode: &exitCode, OutputTruncated: budget.Exhausted()})
	return Result{ExitCode: &exitCode, Err: waitErr}
}

func readStream(waitGroup *sync.WaitGroup, reader io.Reader, eventType, executionID string, budget *Budget, events chan<- Event) {
	defer waitGroup.Done()
	buffer := make([]byte, 32*1024)
	for {
		count, err := reader.Read(buffer)
		if count > 0 {
			accepted := budget.Take(buffer[:count])
			if len(accepted) > 0 {
				events <- Event{Type: eventType, ExecutionID: executionID, Timestamp: time.Now().UTC(), Chunk: string(accepted)}
			}
		}
		if err != nil {
			return
		}
	}
}

func emitFailedToStart(request Request, sink EventSink, err error) Result {
	sink.Emit(Event{Type: EventFailedToStart, ExecutionID: request.ExecutionID, Timestamp: time.Now().UTC(), Message: err.Error()})
	return Result{Err: err}
}
