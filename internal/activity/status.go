package activity

import (
	"context"

	"github.com/synaploom/synaploom/internal/storage"
)

type ActivityStatus struct {
	ActivityID    string   `json:"activityId"`
	Status        string   `json:"status"`
	AttemptNumber int      `json:"attemptNumber"`
	Score         *float64 `json:"score"`
	MaxScore      *float64 `json:"maxScore"`
	Passed        *bool    `json:"passed"`
}

func (s *ServiceImpl) ActivityStatuses(ctx context.Context, owner OwnerIdentity) ([]ActivityStatus, error) {
	sets, err := s.PublicActivitySets(ctx, owner)
	if err != nil {
		return nil, err
	}
	records, err := s.repository.ListOwnerAttempts(ctx, storageOwner(owner))
	if err != nil {
		return nil, mapStorageError(err)
	}
	type attempts struct {
		draft  *storage.ActivityAttemptRecord
		latest *storage.ActivityAttemptRecord
	}
	indexed := make(map[string]attempts)
	for i := range records {
		record := records[i]
		current := indexed[record.ActivityID]
		if record.Status == storage.ActivityAttemptStatusDraft {
			if current.draft == nil || record.Revision > current.draft.Revision {
				copy := record
				current.draft = &copy
			}
		} else if current.latest == nil || record.AttemptNumber > current.latest.AttemptNumber {
			copy := record
			current.latest = &copy
		}
		indexed[record.ActivityID] = current
	}

	seen := make(map[string]bool)
	statuses := make([]ActivityStatus, 0)
	for _, set := range sets {
		for _, reference := range set.Activities {
			id := reference.Activity.ID
			if seen[id] {
				continue
			}
			seen[id] = true
			status := ActivityStatus{ActivityID: id, Status: "AVAILABLE"}
			current := indexed[id]
			switch {
			case current.draft != nil:
				status.Status = "DRAFT"
				status.AttemptNumber = 1
			case current.latest == nil:
				status.Status = "AVAILABLE"
			case current.latest.Status == storage.ActivityAttemptStatusSubmitted:
				status.Status = "IN_PROGRESS"
				status.AttemptNumber = current.latest.AttemptNumber
				status.Score = current.latest.Score
				status.MaxScore = current.latest.MaxScore
				status.Passed = current.latest.Passed
			case current.latest.Passed != nil && *current.latest.Passed:
				status.Status = "PASSED"
				status.AttemptNumber = current.latest.AttemptNumber
				status.Score = current.latest.Score
				status.MaxScore = current.latest.MaxScore
				status.Passed = current.latest.Passed
			default:
				status.Status = "FAILED"
				status.AttemptNumber = current.latest.AttemptNumber
				status.Score = current.latest.Score
				status.MaxScore = current.latest.MaxScore
				status.Passed = current.latest.Passed
			}
			statuses = append(statuses, status)
		}
	}
	return statuses, nil
}
