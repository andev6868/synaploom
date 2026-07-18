package activity

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"testing"
)

func TestOrderingEvaluator(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewOrderingEvaluator())
	base := map[string]any{
		"items": []any{
			map[string]any{"id": "a"}, map[string]any{"id": "b"},
			map[string]any{"id": "c"}, map[string]any{"id": "d"},
		},
		"correctOrder": []any{"a", "b", "c", "d"},
	}
	for _, test := range []struct {
		name   string
		mode   string
		answer string
		score  float64
		passed bool
	}{
		{name: "exact order", mode: "exact", answer: `{"kind":"ordering","itemIds":["a","b","c","d"]}`, score: 3, passed: true},
		{name: "exact rejects different order", mode: "exact", answer: `{"kind":"ordering","itemIds":["a","b","d","c"]}`, score: 0, passed: false},
		{name: "adjacent partial credit", mode: "adjacent", answer: `{"kind":"ordering","itemIds":["a","b","d","c"]}`, score: 1, passed: false},
	} {
		test := test
		t.Run(test.name, func(t *testing.T) {
			config := cloneMap(base)
			config["evaluationMode"] = test.mode
			result, err := registry.Evaluate(context.Background(), evaluatorDefinition(ActivityKindOrdering, 3, config), json.RawMessage(test.answer))
			if err != nil {
				t.Fatal(err)
			}
			if math.Abs(resultScore(result)-test.score) > 1e-9 || resultPassed(result) != test.passed {
				t.Fatalf("result = score %v passed %v, want %v/%v", result.Score, result.Passed, test.score, test.passed)
			}
		})
	}
}

func TestOrderingEvaluatorRejectsInvalidPermutation(t *testing.T) {
	t.Parallel()
	definition := evaluatorDefinition(ActivityKindOrdering, 1, map[string]any{
		"items":        []any{map[string]any{"id": "a"}, map[string]any{"id": "b"}},
		"correctOrder": []any{"a", "b"}, "evaluationMode": "exact",
	})
	registry := NewRegistry(NewOrderingEvaluator())
	for _, answer := range []string{
		`{"kind":"ordering","itemIds":["a","a"]}`,
		`{"kind":"ordering","itemIds":["a"]}`,
		`{"kind":"ordering","itemIds":["a","missing"]}`,
	} {
		_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(answer))
		if !errors.Is(err, ErrMalformedAnswer) {
			t.Fatalf("answer %s error = %v, want ErrMalformedAnswer", answer, err)
		}
	}
}
