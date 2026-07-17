package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/course"
	"github.com/synaploom/synaploom/internal/runner"
)

type executionHandlers struct {
	resolve  func(context.Context, string, string) (runner.Action, error)
	record   func(context.Context, string, string, runner.Result) error
	executor runner.Executor
	store    *executionStore
}

func (h executionHandlers) start(w http.ResponseWriter, r *http.Request) {
	action, err := h.resolve(r.Context(), r.PathValue("lessonId"), r.PathValue("actionId"))
	if errors.Is(err, runner.ErrActionNotFound) {
		writeError(w, http.StatusNotFound, "ACTION_NOT_FOUND", "Action not found.", requestID(r), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ACTION", "Action is invalid.", requestID(r), nil)
		return
	}
	request, err := runner.NewResolver(map[string]runner.Action{"selected": action}).Resolve("selected")
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ACTION", "Action is invalid.", requestID(r), nil)
		return
	}
	lessonID := r.PathValue("lessonId")
	actionID := r.PathValue("actionId")
	session := h.store.create(request.ExecutionID)
	go func() {
		defer close(session.events)
		var sink runner.EventSink = channelSink{events: session.events}
		if h.record != nil {
			sink = recordingSink{
				next: sink,
				record: func(event runner.Event) {
					result := runner.Result{ExitCode: event.ExitCode}
					if event.Type != runner.EventExited {
						result.Err = errors.New(event.Type)
					}
					_ = h.record(context.Background(), lessonID, actionID, result)
				},
			}
		}
		h.executor.Execute(context.Background(), request, sink)
	}()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(contracts.ProcessSessionPayload{
		SessionId: request.ExecutionID,
		EventsUrl: "/api/v1/executions/" + request.ExecutionID + "/events",
	})
}

func (h executionHandlers) events(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("executionId")
	session, err := h.store.claim(id)
	if errors.Is(err, errExecutionGone) {
		http.Error(w, "execution stream consumed", http.StatusGone)
		return
	}
	if err != nil {
		http.Error(w, "execution not found", http.StatusNotFound)
		return
	}
	defer h.store.consume(id)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)
	for event := range session.events {
		data, marshalErr := json.Marshal(event)
		if marshalErr != nil {
			return
		}
		_, _ = w.Write([]byte("event: process\ndata: "))
		_, _ = w.Write(data)
		_, _ = w.Write([]byte("\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
		if runner.IsTerminalEvent(event) {
			return
		}
	}
}

type recordingSink struct {
	next   runner.EventSink
	record func(runner.Event)
}

func (s recordingSink) Emit(event runner.Event) {
	if runner.IsTerminalEvent(event) {
		s.record(event)
	}
	s.next.Emit(event)
}

func defaultExecutionHandlers(actions map[string]runner.Action) executionHandlers {
	return executionHandlers{
		resolve: func(_ context.Context, _ string, actionID string) (runner.Action, error) {
			action, ok := actions[actionID]
			if !ok {
				return runner.Action{}, runner.ErrActionNotFound
			}
			return action, nil
		},
		executor: runner.Executor{},
		store:    newExecutionStore(30 * time.Second),
	}
}

func practiceExecutionHandlers(service course.PracticeService) executionHandlers {
	handlers := executionHandlers{
		resolve:  service.ResolveAction,
		executor: runner.Executor{},
		store:    newExecutionStore(30 * time.Second),
	}
	if recorder, ok := service.(course.ActionResultRecorder); ok {
		handlers.record = recorder.RecordActionResult
	}
	return handlers
}
