package activity

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestWritingEvaluatorValidatesSubmissionWithoutAutoGrading(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewWritingEvaluator())
	definition := evaluatorDefinition(ActivityKindWriting, 0, map[string]any{
		"minimumCharacters": 5, "maximumCharacters": 20, "answerFormat": "plain-text",
	})
	result, err := registry.Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"writing","value":"Một ý kiến"}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Passed != nil || !result.Completed || result.Score != nil || result.MaxScore != nil {
		t.Fatalf("writing result falsely graded: %+v", result)
	}
}

func TestWritingEvaluatorRejectsLengthAndShape(t *testing.T) {
	t.Parallel()
	registry := NewRegistry(NewWritingEvaluator())
	definition := evaluatorDefinition(ActivityKindWriting, 0, map[string]any{
		"minimumCharacters": 5, "maximumCharacters": 10, "answerFormat": "plain-text",
	})
	for _, answer := range []string{
		`{"kind":"writing","value":"abc"}`,
		`{"kind":"writing","value":"this response is much too long"}`,
		`{"kind":"writing","value":5}`,
	} {
		_, err := registry.Evaluate(context.Background(), definition, json.RawMessage(answer))
		if !errors.Is(err, ErrMalformedAnswer) {
			t.Fatalf("answer %s error = %v, want ErrMalformedAnswer", answer, err)
		}
	}
}

func TestWritingEvaluatorAcceptsSafeMarkdownContract(t *testing.T) {
	definition := ActivityDefinition{
		ID: "writing", Kind: ActivityKindWriting,
		Config: map[string]any{"minimumCharacters": float64(1), "maximumCharacters": float64(500), "answerFormat": "safe-markdown"},
	}
	result, err := NewWritingEvaluator().Evaluate(context.Background(), definition, json.RawMessage(`{"kind":"writing","value":"**Dẫn chứng** rõ ràng."}`))
	if err != nil {
		t.Fatal(err)
	}
	if !result.Completed {
		t.Fatalf("result=%#v", result)
	}
}
