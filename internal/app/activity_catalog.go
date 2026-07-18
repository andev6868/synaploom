package app

import (
	"context"
	"fmt"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/course"
)

type activityCatalogOwner struct {
	definitions map[string]activity.ActivityDefinition
	sets        map[string]activity.ActivitySetDefinition
	setOrder    []string
	policies    map[string]activity.ActivitySetPolicy
}

type filesystemActivityCatalog struct {
	owners map[activity.OwnerIdentity]activityCatalogOwner
}

func newFilesystemActivityCatalog(courseID, version string, lessonSources, assessmentSources map[string][]course.ActivitySetSource) (*filesystemActivityCatalog, error) {
	catalog := &filesystemActivityCatalog{owners: make(map[activity.OwnerIdentity]activityCatalogOwner, len(lessonSources)+len(assessmentSources))}
	addOwners := func(kind activity.OwnerKind, sources map[string][]course.ActivitySetSource) error {
		for ownerSourceID, activitySets := range sources {
			ownerID := activity.OwnerIdentity{CourseID: courseID, CourseVersion: version, Kind: kind, ID: ownerSourceID}
			owner := activityCatalogOwner{definitions: map[string]activity.ActivityDefinition{}, sets: map[string]activity.ActivitySetDefinition{}, policies: map[string]activity.ActivitySetPolicy{}}
			for _, source := range activitySets {
				policy := activity.ActivitySetPolicy{
					Purpose:       activity.ActivityPurpose(source.Definition.Policy.Purpose),
					FeedbackMode:  string(source.Definition.Policy.FeedbackMode),
					RevealAnswers: string(source.Definition.Policy.RevealAnswers),
					Scoring:       string(source.Definition.Policy.Scoring),
				}
				if source.Definition.Policy.MaxAttempts != nil {
					value := *source.Definition.Policy.MaxAttempts
					policy.MaxAttempts = &value
				}
				if source.Definition.Policy.PassingScore != nil {
					value := *source.Definition.Policy.PassingScore
					policy.PassingScore = &value
				}
				set := activity.ActivitySetDefinition{ID: string(source.Definition.Id), Policy: policy}
				if source.Definition.Title != nil {
					set.Title = *source.Definition.Title
				}
				for _, reference := range source.Definition.Activities {
					set.Activities = append(set.Activities, activity.ActivityReference{ID: string(reference.Id), Required: reference.Required})
					owner.policies[string(reference.Id)] = policy
				}
				for _, activitySource := range source.Activities {
					definition, err := activity.DefinitionFromMap(activitySource.Definition)
					if err != nil {
						return fmt.Errorf("decode activity %s: %w", activitySource.ID, err)
					}
					owner.definitions[definition.ID] = definition
				}
				if _, exists := owner.sets[set.ID]; !exists {
					owner.setOrder = append(owner.setOrder, set.ID)
				}
				owner.sets[set.ID] = set
			}
			catalog.owners[ownerID] = owner
		}
		return nil
	}
	if err := addOwners(activity.OwnerKindLesson, lessonSources); err != nil {
		return nil, err
	}
	if err := addOwners(activity.OwnerKindAssessment, assessmentSources); err != nil {
		return nil, err
	}
	return catalog, nil
}

func (c *filesystemActivityCatalog) Activity(_ context.Context, owner activity.OwnerIdentity, id string) (activity.ActivityDefinition, activity.ActivitySetPolicy, error) {
	entry, ok := c.owners[owner]
	if !ok {
		return activity.ActivityDefinition{}, activity.ActivitySetPolicy{}, activity.ErrActivityNotFound
	}
	definition, ok := entry.definitions[id]
	if !ok {
		return activity.ActivityDefinition{}, activity.ActivitySetPolicy{}, activity.ErrActivityNotFound
	}
	return definition, entry.policies[id], nil
}

func (c *filesystemActivityCatalog) ActivitySet(_ context.Context, owner activity.OwnerIdentity, id string) (activity.ActivitySetDefinition, error) {
	entry, ok := c.owners[owner]
	if !ok {
		return activity.ActivitySetDefinition{}, activity.ErrActivitySetNotFound
	}
	set, ok := entry.sets[id]
	if !ok {
		return activity.ActivitySetDefinition{}, activity.ErrActivitySetNotFound
	}
	return set, nil
}

func (c *filesystemActivityCatalog) ActivitySets(_ context.Context, owner activity.OwnerIdentity) ([]activity.ActivitySetDefinition, error) {
	entry, ok := c.owners[owner]
	if !ok {
		return []activity.ActivitySetDefinition{}, nil
	}
	sets := make([]activity.ActivitySetDefinition, 0, len(entry.setOrder))
	for _, id := range entry.setOrder {
		set, ok := entry.sets[id]
		if ok {
			sets = append(sets, set)
		}
	}
	return sets, nil
}
