package activity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestChoiceEvaluators(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewChoiceEvaluator(ActivityKindSingleChoice), NewChoiceEvaluator(ActivityKindMultipleChoice), NewChoiceEvaluator(ActivityKindTrueFalse))

	tests := []struct {
		name       string
		definition ActivityDefinition
		answer     string
		score      float64
		passed     bool
	}{
		{
			name: "single choice exact match",
			definition: evaluatorDefinition(ActivityKindSingleChoice, 2, map[string]any{
				"options":         []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
				"correctOptionId": "b",
			}),
			answer: `{"kind":"single-choice","optionId":"b"}`, score: 2, passed: true,
		},
		{
			name: "multiple choice exact set ignores answer order",
			definition: evaluatorDefinition(ActivityKindMultipleChoice, 4, map[string]any{
				"options":          []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}, map[string]any{"id": "c"}},
				"correctOptionIds": []any{"a", "c"},
				"evaluationMode":   "exact-set",
			}),
			answer: `{"kind":"multiple-choice","optionIds":["c","a"]}`, score: 4, passed: true,
		},
		{
			name: "multiple choice partial credit subtracts incorrect selections",
			definition: evaluatorDefinition(ActivityKindMultipleChoice, 4, map[string]any{
				"options":          []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}, map[string]any{"id": "c"}},
				"correctOptionIds": []any{"a", "c"},
				"evaluationMode":   "partial-credit",
			}),
			answer: `{"kind":"multiple-choice","optionIds":["a","b"]}`, score: 0, passed: false,
		},
		{
			name: "multiple choice partial credit honors passing score",
			definition: withPassingScore(evaluatorDefinition(ActivityKindMultipleChoice, 4, map[string]any{
				"options":          []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}, map[string]any{"id": "c"}, map[string]any{"id": "d"}},
				"correctOptionIds": []any{"a", "c"},
				"evaluationMode":   "partial-credit",
			}), 2),
			answer: `{"kind":"multiple-choice","optionIds":["a"]}`, score: 2, passed: true,
		},
		{
			name: "true false exact match",
			definition: evaluatorDefinition(ActivityKindTrueFalse, 1, map[string]any{
				"expected": true,
			}),
			answer: `{"kind":"true-false","value":true}`, score: 1, passed: true,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			result, err := registry.Evaluate(context.Background(), test.definition, json.RawMessage(test.answer))
			if err != nil {
				t.Fatalf("Evaluate() error = %v", err)
			}
			if result.Score != test.score || result.MaxScore != test.definition.Evaluation.Points || result.Passed != test.passed {
				t.Fatalf("Evaluate() = score %v/%v passed %v, want %v/%v passed %v", result.Score, result.MaxScore, result.Passed, test.score, test.definition.Evaluation.Points, test.passed)
			}
		})
	}
}

func TestChoiceEvaluatorRejectsMalformedAnswers(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewChoiceEvaluator(ActivityKindSingleChoice), NewChoiceEvaluator(ActivityKindMultipleChoice))
	definition := evaluatorDefinition(ActivityKindMultipleChoice, 1, map[string]any{
		"options":          []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
		"correctOptionIds": []any{"a"},
		"evaluationMode":   "exact-set",
	})

	for _, answer := range []string{
		`{"kind":"multiple-choice","optionIds":["a","a"]}`,
		`{"kind":"multiple-choice","optionIds":["missing"]}`,
		`{"kind":"single-choice","optionId":3}`,
	} {
		_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(answer))
		if !errors.Is(err, ErrMalformedAnswer) {
			t.Fatalf("Evaluate(%s) error = %v, want ErrMalformedAnswer", answer, err)
		}
	}
}

func TestRevealPolicyControlsCorrectAnswer(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewChoiceEvaluator(ActivityKindSingleChoice))
	definition := evaluatorDefinition(ActivityKindSingleChoice, 1, map[string]any{
		"options":         []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
		"correctOptionId": "a",
	})
	result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"single-choice","optionId":"b"}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Feedback.CorrectAnswer != nil {
		t.Fatalf("evaluator leaked correct answer before reveal policy: %#v", result.Feedback.CorrectAnswer)
	}

	never := ApplyRevealPolicy(result, ActivitySetPolicy{RevealAnswers: "never"}, 1)
	if never.Feedback.CorrectAnswer != nil {
		t.Fatalf("never policy leaked correct answer: %#v", never.Feedback.CorrectAnswer)
	}
	afterSubmit := ApplyRevealPolicy(result, ActivitySetPolicy{RevealAnswers: "after-submit"}, 1)
	if afterSubmit.Feedback.CorrectAnswer != "a" {
		t.Fatalf("after-submit correctAnswer = %#v, want a", afterSubmit.Feedback.CorrectAnswer)
	}
	maxAttempts := 2
	beforeFinal := ApplyRevealPolicy(result, ActivitySetPolicy{RevealAnswers: "after-final-attempt", MaxAttempts: &maxAttempts}, 1)
	if beforeFinal.Feedback.CorrectAnswer != nil {
		t.Fatalf("before final attempt leaked correct answer: %#v", beforeFinal.Feedback.CorrectAnswer)
	}
	afterFinal := ApplyRevealPolicy(result, ActivitySetPolicy{RevealAnswers: "after-final-attempt", MaxAttempts: &maxAttempts}, 2)
	if afterFinal.Feedback.CorrectAnswer != "a" {
		t.Fatalf("after final attempt correctAnswer = %#v, want a", afterFinal.Feedback.CorrectAnswer)
	}
}

func evaluatorDefinition(kind ActivityKind, points float64, config map[string]any) ActivityDefinition {
	return ActivityDefinition{
		ID: "activity", Kind: kind, Title: "Activity", Prompt: map[string]any{"blocks": []any{}}, Config: config,
		Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: points},
		Completion: CompletionPolicy{Required: true},
	}
}

func withPassingScore(definition ActivityDefinition, score float64) ActivityDefinition {
	definition.Completion.PassingScore = &score
	return definition
}
