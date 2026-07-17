package contracts

import (
	"encoding/json"
	"testing"
)

func TestLessonBlockPreservesAdditionalFields(t *testing.T) {
	input := []byte(`{"type":"heading","level":2,"text":"Goal"}`)
	var block LessonBlock
	if err := json.Unmarshal(input, &block); err != nil {
		t.Fatal(err)
	}
	output, err := json.Marshal(block)
	if err != nil {
		t.Fatal(err)
	}
	var actual, expected any
	_ = json.Unmarshal(output, &actual)
	_ = json.Unmarshal(input, &expected)
	if string(mustJSON(actual)) != string(mustJSON(expected)) {
		t.Fatalf("output=%s", output)
	}
}
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
