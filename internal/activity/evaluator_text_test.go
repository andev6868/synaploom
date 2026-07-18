package activity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestShortAnswerNormalization(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewTextEvaluator(ActivityKindShortAnswer), NewTextEvaluator(ActivityKindFillBlanks))
	tests := []struct {
		name       string
		config     map[string]any
		answer     string
		passed     bool
		normalized string
	}{
		{
			name: "normalizes unicode case whitespace and punctuation",
			config: map[string]any{
				"acceptedAnswers": []any{"café au lait"},
				"normalization":   map[string]any{"trim": true, "unicodeNormalization": "NFC", "caseSensitive": false, "collapseWhitespace": true, "removePunctuation": true},
			},
			answer: `{"kind":"short-answer","value":"  CAFE\u0301,   AU LAIT!  "}`,
			passed: true, normalized: "café au lait",
		},
		{
			name: "respects case sensitivity",
			config: map[string]any{
				"acceptedAnswers": []any{"Go"},
				"normalization":   map[string]any{"caseSensitive": true},
			},
			answer: `{"kind":"short-answer","value":"go"}`,
			passed: false, normalized: "go",
		},
		{
			name: "matches safe full-string regular expression",
			config: map[string]any{
				"acceptedPatterns": []any{`[A-Z]{2}-[0-9]{3}`},
				"normalization":    map[string]any{"caseSensitive": true},
			},
			answer: `{"kind":"short-answer","value":"AB-123"}`,
			passed: true, normalized: "AB-123",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			definition := evaluatorDefinition(ActivityKindShortAnswer, 2, test.config)
			result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(test.answer))
			if err != nil {
				t.Fatalf("Evaluate() error = %v", err)
			}
			if result.Passed != test.passed {
				t.Fatalf("Passed = %v, want %v", result.Passed, test.passed)
			}
			if got := feedbackDetail(result.Feedback, "NORMALIZED_ANSWER", nil); got != test.normalized {
				t.Fatalf("normalized answer = %q, want %q", got, test.normalized)
			}
		})
	}
}

func TestShortAnswerRejectsUnsafeOrInvalidPatterns(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewTextEvaluator(ActivityKindShortAnswer))
	for _, pattern := range []string{`(a+)+$`, `(?=secret)secret`, `([a-z])\1`, string(make([]byte, 257))} {
		definition := evaluatorDefinition(ActivityKindShortAnswer, 1, map[string]any{
			"acceptedPatterns": []any{pattern},
		})
		_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"short-answer","value":"answer"}`))
		if !errors.Is(err, ErrEvaluatorConfigInvalid) {
			t.Fatalf("pattern %q error = %v, want ErrEvaluatorConfigInvalid", pattern, err)
		}
	}
}

func TestFillBlanksScoring(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewTextEvaluator(ActivityKindFillBlanks))
	baseConfig := map[string]any{
		"blanks": []any{
			map[string]any{"id": "subject", "acceptedAnswers": []any{"She"}, "normalization": map[string]any{"caseSensitive": false}},
			map[string]any{"id": "verb", "acceptedAnswers": []any{"writes"}},
		},
	}

	for _, test := range []struct {
		name    string
		scoring string
		score   float64
		passed  bool
	}{
		{name: "all or nothing", scoring: "all-or-nothing", score: 0, passed: false},
		{name: "per blank", scoring: "per-blank", score: 2, passed: false},
	} {
		test := test
		t.Run(test.name, func(t *testing.T) {
			config := cloneMap(baseConfig)
			config["scoring"] = test.scoring
			definition := evaluatorDefinition(ActivityKindFillBlanks, 4, config)
			result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"fill-blanks","values":{"subject":"she","verb":"write"}}`))
			if err != nil {
				t.Fatal(err)
			}
			if result.Score != test.score || result.Passed != test.passed {
				t.Fatalf("result = score %v passed %v, want %v/%v", result.Score, result.Passed, test.score, test.passed)
			}
			if got := feedbackDetail(result.Feedback, "BLANK_INCORRECT", stringPointer("verb")); got == "" {
				t.Fatal("missing field-scoped feedback for incorrect blank")
			}
		})
	}
}

func TestTextEvaluatorRejectsMalformedAnswerShape(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewTextEvaluator(ActivityKindShortAnswer), NewTextEvaluator(ActivityKindFillBlanks))
	tests := []struct {
		definition ActivityDefinition
		answer     string
	}{
		{evaluatorDefinition(ActivityKindShortAnswer, 1, map[string]any{"acceptedAnswers": []any{"yes"}}), `{"kind":"short-answer","value":3}`},
		{evaluatorDefinition(ActivityKindFillBlanks, 1, map[string]any{"blanks": []any{map[string]any{"id": "one", "acceptedAnswers": []any{"1"}}}}), `{"kind":"fill-blanks","values":{"one":1}}`},
	}
	for _, test := range tests {
		_, err := registry.Evaluate(context.Background(), test.definition, json.RawMessage(test.answer))
		if !errors.Is(err, ErrMalformedAnswer) {
			t.Fatalf("error = %v, want ErrMalformedAnswer", err)
		}
	}
}

func feedbackDetail(feedback ActivityFeedback, code string, field *string) string {
	for _, detail := range feedback.Details {
		if detail.Code != code {
			continue
		}
		if field == nil && detail.Field == nil {
			return detail.Message
		}
		if field != nil && detail.Field != nil && *field == *detail.Field {
			return detail.Message
		}
	}
	return ""
}

func stringPointer(value string) *string { return &value }
