package runner

import "testing"

func TestHistoryStopsAfterTerminalAndConsumesOnce(t *testing.T) {
	history := NewHistory(3, 8)
	history.Add(Event{Type: EventStdout, Chunk: "12345"})
	history.Add(Event{Type: EventStderr, Chunk: "67890"})
	history.Add(Event{Type: EventExited})
	history.Add(Event{Type: EventStdout, Chunk: "ignored"})
	events := history.Consume()
	if len(events) == 0 || !IsTerminalEvent(events[len(events)-1]) {
		t.Fatalf("events = %#v", events)
	}
	if second := history.Consume(); len(second) != 0 {
		t.Fatalf("second consume = %#v", second)
	}
}
