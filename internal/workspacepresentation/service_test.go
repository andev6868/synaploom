package workspacepresentation

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/storage"
)

type activityStub struct {
	sets []activity.PublicActivitySetView
	byID map[string]activity.PublicActivityView
}

func (s activityStub) PublicActivity(_ context.Context, _ activity.OwnerIdentity, id string) (activity.PublicActivityView, error) {
	value, ok := s.byID[id]
	if !ok {
		return activity.PublicActivityView{}, activity.ErrActivityNotFound
	}
	return value, nil
}
func (s activityStub) PublicActivitySets(context.Context, activity.OwnerIdentity) ([]activity.PublicActivitySetView, error) {
	return s.sets, nil
}
func (s activityStub) ActivityStatuses(context.Context, activity.OwnerIdentity) ([]activity.ActivityStatus, error) {
	return nil, nil
}
func (s activityStub) CurrentAttempt(context.Context, activity.AttemptIdentity) (*activity.ActivityAttempt, error) {
	return nil, nil
}
func (s activityStub) SaveDraft(context.Context, activity.SaveDraftCommand) (activity.ActivityAttempt, error) {
	return activity.ActivityAttempt{}, nil
}
func (s activityStub) Submit(context.Context, activity.SubmitCommand) (activity.ActivityAttempt, error) {
	return activity.ActivityAttempt{}, nil
}
func (s activityStub) SetProgress(context.Context, activity.OwnerIdentity, string) (activity.ActivitySetProgress, error) {
	return activity.ActivitySetProgress{}, nil
}

type versionStub string

func (v versionStub) CourseVersion(context.Context, string) (string, error) { return string(v), nil }

type eventRecorder struct{ events []map[string]any }

func (e *eventRecorder) Write(name string, fields map[string]any) {
	copy := map[string]any{"event": name}
	for k, v := range fields {
		copy[k] = v
	}
	e.events = append(e.events, copy)
}

func publicActivity(id, surface string, allowInline, allowPractice, fullscreen bool) activity.PublicActivityView {
	return activity.PublicActivityView{ID: id, Kind: activity.ActivityKindCoding, Title: id, Prompt: map[string]any{"blocks": []any{}}, Config: map[string]any{}, Presentation: activity.ActivityPresentation{DefaultSurface: surface, AllowInline: allowInline, AllowPractice: allowPractice, PreferredWidth: "wide", SupportsFullscreen: fullscreen}}
}
func stubWithActivities(items ...struct {
	view     activity.PublicActivityView
	required bool
}) activityStub {
	refs := make([]activity.PublicActivityReference, 0, len(items))
	byID := map[string]activity.PublicActivityView{}
	for _, item := range items {
		refs = append(refs, activity.PublicActivityReference{Required: item.required, Activity: item.view})
		byID[item.view.ID] = item.view
	}
	return activityStub{sets: []activity.PublicActivitySetView{{ID: "practice", Activities: refs}}, byID: byID}
}
func newTestService(t *testing.T, activities activityStub) (Service, storage.WorkspacePresentationRepository, *eventRecorder) {
	t.Helper()
	db, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repository := storage.NewWorkspacePresentationRepository(db.SQL)
	events := &eventRecorder{}
	return NewService(repository, activities, versionStub("1.0.0"), events), repository, events
}

func TestGetResolvesRequiredPracticeDefault(t *testing.T) {
	inline := publicActivity("quiz", "inline", true, true, false)
	coding := publicActivity("coding-lab", "practice", true, true, true)
	service, _, _ := newTestService(t, stubWithActivities(struct {
		view     activity.PublicActivityView
		required bool
	}{inline, true}, struct {
		view     activity.PublicActivityView
		required bool
	}{coding, true}))
	state, err := service.Get(context.Background(), "local", Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a"})
	if err != nil {
		t.Fatal(err)
	}
	if state.FocusedActivityID == nil || *state.FocusedActivityID != "coding-lab" || state.PaneMode != "split" || state.SplitRatio != 0.45 || state.UserCollapsed || state.Revision != 0 {
		t.Fatalf("state=%+v", state)
	}
}
func TestGetCollapsesReadingOnlyOwner(t *testing.T) {
	service, _, _ := newTestService(t, stubWithActivities())
	state, err := service.Get(context.Background(), "local", Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a"})
	if err != nil {
		t.Fatal(err)
	}
	if state.FocusedActivityID != nil || state.PaneMode != "collapsed" {
		t.Fatalf("state=%+v", state)
	}
}
func TestUpdateNormalizesAndValidatesPresentation(t *testing.T) {
	wide := publicActivity("wide", "practice", true, true, true)
	compact := publicActivity("compact", "practice", true, true, false)
	inlineOnly := publicActivity("inline-only", "inline", true, false, false)
	service, _, _ := newTestService(t, stubWithActivities(struct {
		view     activity.PublicActivityView
		required bool
	}{wide, true}, struct {
		view     activity.PublicActivityView
		required bool
	}{compact, true}, struct {
		view     activity.PublicActivityView
		required bool
	}{inlineOnly, true}))
	owner := Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson"}
	focus := "wide"
	state, err := service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &focus, PaneMode: "split", SplitRatio: 0.1, UserCollapsed: true, Revision: 0, At: time.Unix(1, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if state.SplitRatio != 0.32 || state.UserCollapsed {
		t.Fatalf("state=%+v", state)
	}
	state, err = service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &focus, PaneMode: "collapsed", SplitRatio: 0.9, UserCollapsed: true, Revision: state.Revision, At: time.Unix(2, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if state.SplitRatio != 0.68 || !state.UserCollapsed {
		t.Fatalf("state=%+v", state)
	}
	nilState, err := service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", PaneMode: "expanded", SplitRatio: 0.5, UserCollapsed: true, Revision: state.Revision})
	if err != nil {
		t.Fatal(err)
	}
	if nilState.FocusedActivityID != nil || nilState.PaneMode != "collapsed" || nilState.UserCollapsed {
		t.Fatalf("state=%+v", nilState)
	}
	unknown := "unknown"
	_, err = service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &unknown, PaneMode: "split", SplitRatio: 0.45, Revision: nilState.Revision})
	if !errors.Is(err, ErrActivityInvalid) {
		t.Fatalf("err=%v", err)
	}
	inlineID := "inline-only"
	_, err = service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &inlineID, PaneMode: "split", SplitRatio: 0.45, Revision: nilState.Revision})
	if !errors.Is(err, ErrActivityPracticeSurfaceNotAllowed) {
		t.Fatalf("err=%v", err)
	}
	compactID := "compact"
	_, err = service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &compactID, PaneMode: "expanded", SplitRatio: 0.45, Revision: nilState.Revision})
	if !errors.Is(err, ErrActivityFullscreenNotSupported) {
		t.Fatalf("err=%v", err)
	}
}
func TestConflictContainsCurrentState(t *testing.T) {
	wide := publicActivity("wide", "practice", true, true, true)
	service, _, _ := newTestService(t, stubWithActivities(struct {
		view     activity.PublicActivityView
		required bool
	}{wide, true}))
	focus := "wide"
	owner := Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson"}
	first, err := service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &focus, PaneMode: "split", SplitRatio: 0.45, Revision: 0})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &focus, PaneMode: "expanded", SplitRatio: 0.45, Revision: 0})
	var conflict ConflictError
	if !errors.As(err, &conflict) || conflict.Current.Revision != first.Revision {
		t.Fatalf("err=%v conflict=%+v", err, conflict)
	}
}
func TestGetRecoversInvalidFocusAndPreservesLearnerCollapse(t *testing.T) {
	wide := publicActivity("wide", "practice", true, true, true)
	service, repository, events := newTestService(t, stubWithActivities(struct {
		view     activity.PublicActivityView
		required bool
	}{wide, true}))
	owner := Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson"}
	removed := "removed"
	_, err := repository.Put(context.Background(), storage.WorkspacePresentationWrite{Key: storage.WorkspacePresentationKey{ProfileID: "local", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson"}, FocusedActivityID: &removed, PaneMode: "split", SplitRatio: 0.1, ExpectedRevision: 0})
	if err != nil {
		t.Fatal(err)
	}
	state, err := service.Get(context.Background(), "local", owner)
	if err != nil {
		t.Fatal(err)
	}
	if state.FocusedActivityID != nil || state.PaneMode != "collapsed" || state.SplitRatio != 0.32 || state.Revision != 2 {
		t.Fatalf("state=%+v", state)
	}
	if len(events.events) == 0 || events.events[len(events.events)-1]["event"] != "workspace.presentation.invalid_focus_recovered" {
		t.Fatalf("events=%+v", events.events)
	}
	focus := "wide"
	collapsed, err := service.Update(context.Background(), UpdateCommand{Owner: owner, ProfileID: "local", FocusedActivityID: &focus, PaneMode: "collapsed", SplitRatio: 0.45, UserCollapsed: true, Revision: state.Revision})
	if err != nil {
		t.Fatal(err)
	}
	restored, err := service.Get(context.Background(), "local", owner)
	if err != nil {
		t.Fatal(err)
	}
	if restored.PaneMode != "collapsed" || !restored.UserCollapsed || restored.Revision != collapsed.Revision {
		t.Fatalf("restored=%+v", restored)
	}
}

func TestWorkspaceEventsExcludeLearnerContent(t *testing.T) {
	wide := publicActivity("wide", "practice", true, true, true)
	service, _, events := newTestService(t, stubWithActivities(struct {
		view     activity.PublicActivityView
		required bool
	}{wide, true}))
	focus := "wide"
	_, err := service.Update(context.Background(), UpdateCommand{
		Owner:     Owner{CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson"},
		ProfileID: "local", FocusedActivityID: &focus, PaneMode: "split", SplitRatio: 0.45,
	})
	if err != nil {
		t.Fatal(err)
	}
	forbidden := []string{"answer", "content", "source", "prompt", "feedback"}
	for _, event := range events.events {
		for _, key := range forbidden {
			if _, ok := event[key]; ok {
				t.Fatalf("event includes forbidden key %q: %+v", key, event)
			}
		}
	}
}
