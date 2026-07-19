package activity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestMatchingEvaluatorScoresOneToOnePairs(t *testing.T) {
	t.Parallel()
	definition := evaluatorDefinition(ActivityKindMatching, 4, map[string]any{
		"left":           []any{map[string]any{"id": "l1"}, map[string]any{"id": "l2"}},
		"right":          []any{map[string]any{"id": "r1"}, map[string]any{"id": "r2"}},
		"correctMatches": map[string]any{"l1": "r1", "l2": "r2"},
	})
	registry := NewRegistry(NewMatchingEvaluator())
	_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"matching","pairs":{"l1":"r1","l2":"r1"}}`))
	if !errors.Is(err, ErrMalformedAnswer) {
		t.Fatalf("duplicate right-side match error = %v, want ErrMalformedAnswer", err)
	}
	result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"matching","pairs":{"l1":"r1","l2":"r2"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if resultScore(result) != 4 || !resultPassed(result) {
		t.Fatalf("exact result = %+v", result)
	}
	result, err = registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"matching","pairs":{"l1":"r2","l2":"r1"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if resultScore(result) != 0 || resultPassed(result) {
		t.Fatalf("incorrect result = %+v", result)
	}
}
