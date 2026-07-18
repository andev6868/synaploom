package activity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestNumericEvaluatorNumbersToleranceAndUnits(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewNumericEvaluator())
	for _, test := range []struct {
		name   string
		config map[string]any
		answer string
		passed bool
	}{
		{name: "scientific notation", config: map[string]any{"answerMode": "number", "expected": "42", "absoluteTolerance": 0.0}, answer: `{"kind":"numeric","value":"4.2e1"}`, passed: true},
		{name: "absolute tolerance", config: map[string]any{"answerMode": "number", "expected": "10", "absoluteTolerance": 0.1}, answer: `{"kind":"numeric","value":"10.09"}`, passed: true},
		{name: "relative tolerance", config: map[string]any{"answerMode": "number", "expected": "1000", "relativeTolerance": 0.01}, answer: `{"kind":"numeric","value":"1009"}`, passed: true},
		{name: "unit normalization", config: map[string]any{"answerMode": "number", "expected": "1", "unit": "m", "requireUnit": true}, answer: `{"kind":"numeric","value":"100","unit":"cm"}`, passed: true},
		{name: "missing required unit", config: map[string]any{"answerMode": "number", "expected": "1", "unit": "m", "requireUnit": true}, answer: `{"kind":"numeric","value":"1"}`, passed: false},
	} {
		test := test
		t.Run(test.name, func(t *testing.T) {
			result, err := registry.Evaluate(context.Background(), evaluatorDefinition(ActivityKindNumeric, 2, test.config), json.RawMessage(test.answer))
			if err != nil {
				t.Fatal(err)
			}
			if resultPassed(result) != test.passed {
				t.Fatalf("Passed = %v, want %v; result=%+v", result.Passed, test.passed, result)
			}
		})
	}
}

func TestNumericEvaluatorExpressionEquivalence(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewNumericEvaluator())
	definition := evaluatorDefinition(ActivityKindNumeric, 1, map[string]any{"answerMode": "expression", "expected": "2*x + 2"})
	result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"numeric","value":"2*(x+1)"}`))
	if err != nil {
		t.Fatal(err)
	}
	if !resultPassed(result) {
		t.Fatalf("equivalent expression did not pass: %+v", result)
	}
	_, err = registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"numeric","value":"os.system(1)"}`))
	if !errors.Is(err, ErrMalformedAnswer) {
		t.Fatalf("unsafe expression error = %v, want ErrMalformedAnswer", err)
	}
}

func TestNumericEvaluatorRejectsIncompatibleUnits(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewNumericEvaluator())
	definition := evaluatorDefinition(ActivityKindNumeric, 1, map[string]any{"answerMode": "number", "expected": "1", "unit": "m", "requireUnit": true})
	_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"numeric","value":"1","unit":"s"}`))
	if !errors.Is(err, ErrMalformedAnswer) {
		t.Fatalf("unit error = %v, want ErrMalformedAnswer", err)
	}
}
