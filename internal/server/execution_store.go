package server

import (
	"errors"
	"sync"
	"time"

	"github.com/synaploom/synaploom/internal/runner"
)

var (
	errExecutionNotFound = errors.New("execution not found")
	errExecutionGone     = errors.New("execution gone")
)

type executionSession struct {
	events  chan runner.Event
	claimed bool
}

type executionStore struct {
	mu         sync.Mutex
	sessions   map[string]*executionSession
	tombstones map[string]time.Time
	retention  time.Duration
}

func newExecutionStore(retention time.Duration) *executionStore {
	return &executionStore{sessions: make(map[string]*executionSession), tombstones: make(map[string]time.Time), retention: retention}
}

func (s *executionStore) create(id string) *executionSession {
	s.mu.Lock()
	defer s.mu.Unlock()
	session := &executionSession{events: make(chan runner.Event, 256)}
	s.sessions[id] = session
	return session
}

func (s *executionStore) claim(id string) (*executionSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cleanupLocked(time.Now())
	if _, ok := s.tombstones[id]; ok {
		return nil, errExecutionGone
	}
	session, ok := s.sessions[id]
	if !ok {
		return nil, errExecutionNotFound
	}
	if session.claimed {
		return nil, errExecutionGone
	}
	session.claimed = true
	return session, nil
}

func (s *executionStore) consume(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
	s.tombstones[id] = time.Now().Add(s.retention)
}

func (s *executionStore) cleanupLocked(now time.Time) {
	for id, expiry := range s.tombstones {
		if now.After(expiry) {
			delete(s.tombstones, id)
		}
	}
}

type channelSink struct{ events chan<- runner.Event }

func (s channelSink) Emit(event runner.Event) { s.events <- event }
