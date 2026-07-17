package runner

import "sync/atomic"

// Budget atomically caps the combined stdout and stderr bytes accepted.
type Budget struct {
	remaining atomic.Int64
	limited   bool
}

func NewBudget(limit int64) *Budget {
	budget := &Budget{limited: limit > 0}
	budget.remaining.Store(limit)
	return budget
}

func (b *Budget) Take(chunk []byte) []byte {
	if !b.limited {
		return chunk
	}
	for {
		remaining := b.remaining.Load()
		if remaining <= 0 {
			return nil
		}
		count := int64(len(chunk))
		if count > remaining {
			count = remaining
		}
		if b.remaining.CompareAndSwap(remaining, remaining-count) {
			return chunk[:count]
		}
	}
}

func (b *Budget) Exhausted() bool { return b.limited && b.remaining.Load() <= 0 }
