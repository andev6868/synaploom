package runner

import "sync"

// History retains bounded events for one active execution subscriber.
type History struct {
	mu        sync.Mutex
	maxEvents int
	maxBytes  int
	bytes     int
	terminal  bool
	consumed  bool
	events    []Event
}

func NewHistory(maxEvents, maxBytes int) *History {
	return &History{maxEvents: maxEvents, maxBytes: maxBytes}
}

func (h *History) Add(event Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.terminal {
		return
	}
	h.events = append(h.events, event)
	h.bytes += len(event.Chunk)
	for (h.maxEvents > 0 && len(h.events) > h.maxEvents) || (h.maxBytes > 0 && h.bytes > h.maxBytes && len(h.events) > 1) {
		h.bytes -= len(h.events[0].Chunk)
		h.events = h.events[1:]
	}
	if IsTerminalEvent(event) {
		h.terminal = true
	}
}

func (h *History) Consume() []Event {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.consumed {
		return nil
	}
	h.consumed = h.terminal
	return append([]Event(nil), h.events...)
}
