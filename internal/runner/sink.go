package runner

// EventSink receives serialized execution events.
type EventSink interface {
	Emit(Event)
}
