package workspacepresentation

import (
	"context"
	"errors"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/storage"
)

type CourseVersionResolver interface {
	CourseVersion(context.Context, string) (string, error)
}
type EventSink interface {
	Write(event string, fields map[string]any)
}

type ServiceImpl struct {
	repository            storage.WorkspacePresentationRepository
	activities            activity.Service
	courseVersionResolver CourseVersionResolver
	events                EventSink
}

func NewService(repository storage.WorkspacePresentationRepository, activities activity.Service, resolver CourseVersionResolver, events EventSink) Service {
	return &ServiceImpl{repository: repository, activities: activities, courseVersionResolver: resolver, events: events}
}

func (s *ServiceImpl) Get(ctx context.Context, profileID string, owner Owner) (State, error) {
	if profileID == "" {
		profileID = LocalProfileID
	}
	identity, err := s.resolveActivityOwner(ctx, owner)
	if err != nil {
		return State{}, err
	}
	record, err := s.repository.Get(ctx, storageKey(profileID, owner))
	if err != nil {
		return State{}, err
	}
	if record == nil {
		state, err := s.defaultState(ctx, owner, identity)
		if err == nil {
			s.writeEvent("workspace.presentation.loaded", stateFields(state))
		}
		return state, err
	}
	state := stateFromRecord(*record)
	if state.FocusedActivityID != nil {
		view, focusErr := s.activities.PublicActivity(ctx, identity, *state.FocusedActivityID)
		if focusErr != nil || !view.Presentation.AllowPractice {
			corrected, writeErr := s.repository.Put(ctx, storage.WorkspacePresentationWrite{
				Key: record.Key, FocusedActivityID: nil, PaneMode: "collapsed", SplitRatio: clampRatio(record.SplitRatio),
				UserCollapsed: false, ExpectedRevision: record.Revision,
			})
			if writeErr != nil {
				return State{}, writeErr
			}
			state = stateFromRecord(corrected)
			s.writeEvent("workspace.presentation.invalid_focus_recovered", stateFields(state))
			return state, nil
		}
	}
	state.SplitRatio = clampRatio(state.SplitRatio)
	s.writeEvent("workspace.presentation.loaded", stateFields(state))
	return state, nil
}

func (s *ServiceImpl) Update(ctx context.Context, command UpdateCommand) (State, error) {
	if command.ProfileID == "" {
		command.ProfileID = LocalProfileID
	}
	identity, err := s.resolveActivityOwner(ctx, command.Owner)
	if err != nil {
		return State{}, err
	}
	if !validPaneMode(command.PaneMode) {
		return State{}, ErrPaneModeInvalid
	}
	if command.FocusedActivityID == nil {
		command.PaneMode = "collapsed"
		command.UserCollapsed = false
	} else {
		view, activityErr := s.activities.PublicActivity(ctx, identity, *command.FocusedActivityID)
		if activityErr != nil {
			if errors.Is(activityErr, activity.ErrActivityNotFound) {
				return State{}, ErrActivityInvalid
			}
			return State{}, activityErr
		}
		if !view.Presentation.AllowPractice {
			return State{}, ErrActivityPracticeSurfaceNotAllowed
		}
		if command.PaneMode == "expanded" && !view.Presentation.SupportsFullscreen {
			return State{}, ErrActivityFullscreenNotSupported
		}
		if command.PaneMode != "collapsed" {
			command.UserCollapsed = false
		}
	}
	command.SplitRatio = clampRatio(command.SplitRatio)
	record, err := s.repository.Put(ctx, storage.WorkspacePresentationWrite{
		Key: storageKey(command.ProfileID, command.Owner), FocusedActivityID: command.FocusedActivityID,
		PaneMode: command.PaneMode, SplitRatio: command.SplitRatio, UserCollapsed: command.UserCollapsed,
		ExpectedRevision: command.Revision, At: command.At,
	})
	if errors.Is(err, storage.ErrWorkspacePresentationRevisionConflict) {
		current, getErr := s.Get(ctx, command.ProfileID, command.Owner)
		if getErr != nil {
			return State{}, getErr
		}
		s.writeEvent("workspace.presentation.conflict", stateFields(current))
		return State{}, ConflictError{Current: current}
	}
	if err != nil {
		return State{}, err
	}
	state := stateFromRecord(record)
	s.writeEvent("workspace.presentation.persisted", stateFields(state))
	return state, nil
}

func (s *ServiceImpl) defaultState(ctx context.Context, owner Owner, identity activity.OwnerIdentity) (State, error) {
	sets, err := s.activities.PublicActivitySets(ctx, identity)
	if err != nil {
		return State{}, err
	}
	var optional *string
	for _, set := range sets {
		for _, reference := range set.Activities {
			presentation := reference.Activity.Presentation
			if presentation.DefaultSurface != "practice" || !presentation.AllowPractice {
				continue
			}
			id := reference.Activity.ID
			if reference.Required {
				return State{CourseID: owner.CourseID, OwnerKind: owner.OwnerKind, OwnerID: owner.OwnerID, FocusedActivityID: &id, PaneMode: "split", SplitRatio: DefaultSplitRatio}, nil
			}
			if optional == nil {
				copy := id
				optional = &copy
			}
		}
	}
	if optional != nil {
		return State{CourseID: owner.CourseID, OwnerKind: owner.OwnerKind, OwnerID: owner.OwnerID, FocusedActivityID: optional, PaneMode: "split", SplitRatio: DefaultSplitRatio}, nil
	}
	return State{CourseID: owner.CourseID, OwnerKind: owner.OwnerKind, OwnerID: owner.OwnerID, PaneMode: "collapsed", SplitRatio: DefaultSplitRatio}, nil
}

func (s *ServiceImpl) resolveActivityOwner(ctx context.Context, owner Owner) (activity.OwnerIdentity, error) {
	if owner.CourseID == "" || owner.OwnerID == "" {
		return activity.OwnerIdentity{}, ErrOwnerInvalid
	}
	version, err := s.courseVersionResolver.CourseVersion(ctx, owner.CourseID)
	if err != nil {
		return activity.OwnerIdentity{}, err
	}
	return activityOwner(owner, version)
}
func activityOwner(owner Owner, courseVersion string) (activity.OwnerIdentity, error) {
	kind := activity.OwnerKindLesson
	if owner.OwnerKind == "assessments" {
		kind = activity.OwnerKindAssessment
	} else if owner.OwnerKind != "lessons" {
		return activity.OwnerIdentity{}, ErrOwnerInvalid
	}
	return activity.OwnerIdentity{CourseID: owner.CourseID, CourseVersion: courseVersion, Kind: kind, ID: owner.OwnerID}, nil
}
func storageKey(profileID string, owner Owner) storage.WorkspacePresentationKey {
	return storage.WorkspacePresentationKey{ProfileID: profileID, CourseID: owner.CourseID, OwnerKind: owner.OwnerKind, OwnerID: owner.OwnerID}
}
func stateFromRecord(record storage.WorkspacePresentationRecord) State {
	return State{CourseID: record.Key.CourseID, OwnerKind: record.Key.OwnerKind, OwnerID: record.Key.OwnerID, FocusedActivityID: record.FocusedActivityID, PaneMode: record.PaneMode, SplitRatio: record.SplitRatio, UserCollapsed: record.UserCollapsed, Revision: record.Revision, UpdatedAt: record.UpdatedAt}
}
func clampRatio(value float64) float64 {
	if value < MinSplitRatio {
		return MinSplitRatio
	}
	if value > MaxSplitRatio {
		return MaxSplitRatio
	}
	return value
}
func validPaneMode(value string) bool {
	return value == "collapsed" || value == "split" || value == "expanded"
}
func (s *ServiceImpl) writeEvent(name string, fields map[string]any) {
	if s.events != nil {
		s.events.Write(name, fields)
	}
}
func stateFields(state State) map[string]any {
	fields := map[string]any{"courseId": state.CourseID, "ownerKind": state.OwnerKind, "ownerId": state.OwnerID, "paneMode": state.PaneMode, "splitRatio": state.SplitRatio, "revision": state.Revision}
	if state.FocusedActivityID != nil {
		fields["activityId"] = *state.FocusedActivityID
	}
	return fields
}
