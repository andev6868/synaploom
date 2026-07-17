package ai

import "context"

type DisabledProvider struct{}

func (DisabledProvider) Stream(ctx context.Context, _ Request) (<-chan Event, error) {
	ch := make(chan Event, 1)
	select {
	case ch <- Event{Type: "ai.unavailable"}:
	case <-ctx.Done():
	}
	close(ch)
	return ch, nil
}
