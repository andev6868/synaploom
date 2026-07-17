package runner

import (
	"context"
	"testing"
	"time"
)

func TestExecutorTimesOutOnce(t *testing.T) {
	binary := buildFixture(t, "sleep")
	sink := &collectingSink{}
	(Executor{}).Execute(context.Background(), Request{ExecutionID: "timeout", Program: binary, Timeout: 50 * time.Millisecond}, sink)
	assertExactlyOneTerminalEvent(t, sink.events)
	if sink.events[len(sink.events)-1].Type != EventTimedOut {
		t.Fatalf("events = %#v", sink.events)
	}
}

func TestExecutorCapsCombinedOutput(t *testing.T) {
	binary := buildFixture(t, "flood")
	sink := &collectingSink{}
	(Executor{}).Execute(context.Background(), Request{ExecutionID: "flood", Program: binary, MaxOutputByte: 1024}, sink)
	var total int
	for _, event := range sink.events {
		total += len(event.Chunk)
	}
	if total > 1024 {
		t.Fatalf("output bytes = %d", total)
	}
	if !sink.events[len(sink.events)-1].OutputTruncated {
		t.Fatal("terminal event must report truncation")
	}
}

func TestExecutorClassifiesCancellation(t *testing.T) {
	binary := buildFixture(t, "sleep")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	sink := &collectingSink{}
	(Executor{}).Execute(ctx, Request{ExecutionID: "cancel", Program: binary}, sink)
	assertExactlyOneTerminalEvent(t, sink.events)
	if sink.events[len(sink.events)-1].Type != EventKilled {
		t.Fatalf("events = %#v", sink.events)
	}
}
