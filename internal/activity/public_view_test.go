package activity

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type testCatalog struct {
	definitions map[string]ActivityDefinition
	sets        map[string]ActivitySetDefinition
}

func (c testCatalog) Activity(_ context.Context, _ OwnerIdentity, id string) (ActivityDefinition, ActivitySetPolicy, error) {
	definition, ok := c.definitions[id]
	if !ok {
		return ActivityDefinition{}, ActivitySetPolicy{}, ErrActivityNotFound
	}
	for _, set := range c.sets {
		for _, reference := range set.Activities {
			if reference.ID == id {
				return definition, set.Policy, nil
			}
		}
	}
	return definition, ActivitySetPolicy{}, nil
}

func (c testCatalog) ActivitySet(_ context.Context, _ OwnerIdentity, id string) (ActivitySetDefinition, error) {
	set, ok := c.sets[id]
	if !ok {
		return ActivitySetDefinition{}, ErrActivitySetNotFound
	}
	return set, nil
}

func TestPublicActivityRedactsAnswerKeysForEveryKind(t *testing.T) {
	cases := []struct {
		kind    ActivityKind
		config  map[string]any
		secrets []string
	}{
		{ActivityKindSingleChoice, map[string]any{"options": []any{map[string]any{"id": "a", "label": "A"}}, "correctOptionId": "secret-choice"}, []string{"correctOptionId", "secret-choice"}},
		{ActivityKindMultipleChoice, map[string]any{"options": []any{map[string]any{"id": "a", "label": "A"}}, "correctOptionIds": []any{"secret-multiple"}, "evaluationMode": "exact-set"}, []string{"correctOptionIds", "secret-multiple"}},
		{ActivityKindTrueFalse, map[string]any{"expected": true, "explanation": "secret-true-false"}, []string{"expected", "secret-true-false"}},
		{ActivityKindShortAnswer, map[string]any{"acceptedAnswers": []any{"secret-answer"}, "pattern": "secret-pattern", "maximumLength": 40}, []string{"acceptedAnswers", "secret-answer", "pattern", "secret-pattern"}},
		{ActivityKindFillBlanks, map[string]any{"blanks": []any{map[string]any{"id": "b1", "label": "Blank", "acceptedAnswers": []any{"secret-blank"}}}, "scoring": "per-blank"}, []string{"acceptedAnswers", "secret-blank"}},
		{ActivityKindOrdering, map[string]any{"items": []any{map[string]any{"id": "a", "label": "A"}}, "correctOrder": []any{"secret-order"}, "evaluationMode": "exact"}, []string{"correctOrder", "secret-order"}},
		{ActivityKindMatching, map[string]any{"left": []any{map[string]any{"id": "l", "label": "L"}}, "right": []any{map[string]any{"id": "r", "label": "R"}}, "correctMatches": map[string]any{"l": "secret-match"}}, []string{"correctMatches", "secret-match"}},
		{ActivityKindNumeric, map[string]any{"answerMode": "number", "expected": "secret-number", "absoluteTolerance": 0.1, "unit": "m"}, []string{"expected", "secret-number"}},
		{ActivityKindWriting, map[string]any{"minimumCharacters": 1, "maximumCharacters": 100, "answerFormat": "plain-text", "outlinePrompts": []any{"Introduction"}}, nil},
		{ActivityKindCoding, map[string]any{"schemaVersion": "1.0", "id": "code", "title": "Code", "runtime": map[string]any{"kind": "local", "requires": []any{"node"}}, "workspace": map[string]any{"editable": []any{"index.js"}}, "actions": map[string]any{}, "checks": []any{}, "completion": map[string]any{"requireAllRequiredChecks": true}}, nil},
	}
	for _, tc := range cases {
		t.Run(string(tc.kind), func(t *testing.T) {
			definition := activityDefinition("activity", tc.kind, tc.config, EvaluationModeAutomatic)
			service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"activity": definition}}, nil, nil)
			view, err := service.PublicActivity(context.Background(), OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, "activity")
			if err != nil {
				t.Fatal(err)
			}
			data, err := json.Marshal(view)
			if err != nil {
				t.Fatal(err)
			}
			payload := string(data)
			for _, secret := range tc.secrets {
				if strings.Contains(payload, secret) {
					t.Fatalf("public payload leaked %q: %s", secret, payload)
				}
			}
		})
	}
}

func (c testCatalog) ActivitySets(_ context.Context, _ OwnerIdentity) ([]ActivitySetDefinition, error) {
	sets := make([]ActivitySetDefinition, 0, len(c.sets))
	for _, id := range []string{"practice", "assessment"} {
		if set, ok := c.sets[id]; ok {
			sets = append(sets, set)
		}
	}
	for id, set := range c.sets {
		if id != "practice" && id != "assessment" {
			sets = append(sets, set)
		}
	}
	return sets, nil
}

func TestPublicActivitySetsPreserveManifestOrderAndRedactAnswers(t *testing.T) {
	definitions := map[string]ActivityDefinition{
		"first": activityDefinition("first", ActivityKindSingleChoice, map[string]any{
			"options": []any{map[string]any{"id": "a", "label": "A"}},
			"correctOptionId": "secret",
		}, EvaluationModeAutomatic),
		"second": activityDefinition("second", ActivityKindWriting, map[string]any{
			"minimumCharacters": 1, "maximumCharacters": 20, "answerFormat": "plain-text",
		}, EvaluationModeSubmission),
	}
	set := ActivitySetDefinition{
		ID: "practice", Title: "Practice", Policy: ActivitySetPolicy{Purpose: ActivityPurposePractice},
		Activities: []ActivityReference{{ID: "second", Required: false}, {ID: "first", Required: true}},
	}
	service := NewService(testCatalog{definitions: definitions, sets: map[string]ActivitySetDefinition{"practice": set}}, nil, nil)

	views, err := service.PublicActivitySets(context.Background(), OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"})
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 || len(views[0].Activities) != 2 || views[0].Activities[0].Activity.ID != "second" || views[0].Activities[1].Activity.ID != "first" {
		t.Fatalf("views=%+v", views)
	}
	data, err := json.Marshal(views)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "secret") || strings.Contains(string(data), "correctOptionId") {
		t.Fatalf("answer key leaked: %s", data)
	}
}
