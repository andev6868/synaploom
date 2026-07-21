package server

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/synaploom/synaploom/internal/activity"
	"github.com/synaploom/synaploom/internal/ai"
	"github.com/synaploom/synaploom/internal/course"
)

var errAIContextInvalid = errors.New("AI context is invalid")

type aiGeneratePayload struct {
	Kind         string `json:"kind"`
	Prompt       string `json:"prompt"`
	Source       string `json:"source"`
	ActivityID   string `json:"activityId,omitempty"`
	SelectedText string `json:"selectedText,omitempty"`
}

type aiOwner struct {
	CourseID      string
	CourseVersion string
	OwnerKind     activity.OwnerKind
	OwnerID       string
	ChapterID     string
}

type aiContextBuilder struct {
	content     course.Service
	progression LearningProgression
	activities  activity.Service
}

func normalizeAISelectedText(value string) (string, error) {
	normalized := strings.TrimSpace(strings.ReplaceAll(value, "\r\n", "\n"))
	lines := strings.Split(normalized, "\n")
	for index := range lines {
		lines[index] = strings.TrimSpace(lines[index])
	}
	normalized = strings.TrimSpace(strings.Join(lines, "\n"))
	if utf8.RuneCountInString(normalized) > 2000 {
		return "", errAIContextInvalid
	}
	return normalized, nil
}

func validateAIPayload(payload aiGeneratePayload) error {
	if strings.TrimSpace(payload.Prompt) == "" || utf8.RuneCountInString(payload.Prompt) > 4000 {
		return errAIContextInvalid
	}
	switch payload.Kind {
	case "explain", "hint", "summarize", "explain-check-failure":
	default:
		return errAIContextInvalid
	}
	switch payload.Source {
	case "theory":
		if payload.ActivityID != "" {
			return errAIContextInvalid
		}
	case "practice":
		if payload.ActivityID == "" {
			return errAIContextInvalid
		}
	default:
		return errAIContextInvalid
	}
	if _, err := normalizeAISelectedText(payload.SelectedText); err != nil {
		return err
	}
	return nil
}

func jsonContextItem(kind, name string, value any) (ai.ContextItem, error) {
	content, err := json.Marshal(value)
	if err != nil {
		return ai.ContextItem{}, err
	}
	return ai.ContextItem{Kind: kind, Name: name, Content: string(content)}, nil
}

func (b aiContextBuilder) build(ctx context.Context, owner aiOwner, payload aiGeneratePayload) (ai.Request, error) {
	if err := validateAIPayload(payload); err != nil {
		return ai.Request{}, err
	}
	selectedText, _ := normalizeAISelectedText(payload.SelectedText)
	items := make([]ai.ContextItem, 0, 4)

	if owner.OwnerKind == activity.OwnerKindLesson {
		lesson, err := b.content.Lesson(ctx, owner.OwnerID)
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		item, err := jsonContextItem("lesson", lesson.Title, lesson.Blocks)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, item)
	} else {
		if b.progression == nil || owner.ChapterID == "" {
			return ai.Request{}, errAIContextInvalid
		}
		assessment, err := b.progression.ChapterAssessment(ctx, owner.ChapterID, owner.OwnerID)
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		item, err := jsonContextItem("assessment", assessment.Assessment.Title, assessment.Assessment)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, item)
	}

	if selectedText != "" {
		items = append(items, ai.ContextItem{Kind: "selection", Name: payload.Source, Content: selectedText})
	}

	if payload.Source == "practice" {
		if b.activities == nil {
			return ai.Request{}, errAIContextInvalid
		}
		identity := activity.OwnerIdentity{
			CourseID: owner.CourseID, CourseVersion: owner.CourseVersion,
			Kind: owner.OwnerKind, ID: owner.OwnerID,
		}
		view, err := b.activities.PublicActivity(ctx, identity, payload.ActivityID)
		if err != nil || view.ID == "" || view.ID != payload.ActivityID {
			return ai.Request{}, errAIContextInvalid
		}
		activityItem, err := jsonContextItem("activity", view.Title, view)
		if err != nil {
			return ai.Request{}, err
		}
		items = append(items, activityItem)
		attempt, err := b.activities.CurrentAttempt(ctx, activity.AttemptIdentity{
			Owner: identity, ActivityID: payload.ActivityID,
		})
		if err != nil {
			return ai.Request{}, errAIContextInvalid
		}
		if attempt != nil {
			attemptItem, err := jsonContextItem("attempt", payload.ActivityID, attempt)
			if err != nil {
				return ai.Request{}, err
			}
			items = append(items, attemptItem)
		}
	}

	return ai.Request{Question: strings.TrimSpace(payload.Prompt), ContextItems: items}, nil
}
