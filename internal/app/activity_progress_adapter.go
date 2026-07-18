package app

import (
	"context"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/progression"
)

type activityProgressAdapter struct {
	service       activity.Service
	courseID      string
	courseVersion string
}

func (a activityProgressAdapter) Progress(ctx context.Context, key progression.ActivitySetKey) (progression.ActivitySetProgress, error) {
	ownerKind := activity.OwnerKindLesson
	if key.OwnerKind == "assessment" {
		ownerKind = activity.OwnerKindAssessment
	}
	progress, err := a.service.SetProgress(ctx, activity.OwnerIdentity{
		CourseID: a.courseID, CourseVersion: a.courseVersion, Kind: ownerKind, ID: key.OwnerID,
	}, key.SetID)
	if err != nil {
		return progression.ActivitySetProgress{}, err
	}
	return progression.ActivitySetProgress{
		Status:                      progress.Status,
		CompletedRequiredActivities: progress.CompletedRequiredActivities,
		RequiredActivities:          progress.RequiredActivities,
		Score:                       progress.Score, MaxScore: progress.MaxScore, Passed: progress.Passed,
	}, nil
}
