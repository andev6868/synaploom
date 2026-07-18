package activity

import "testing"

func TestDefaultRegistryContainsEveryNonCodingEvaluator(t *testing.T) {
	t.Parallel()
	registry := DefaultRegistry()
	for _, kind := range []ActivityKind{
		ActivityKindSingleChoice,
		ActivityKindMultipleChoice,
		ActivityKindTrueFalse,
		ActivityKindShortAnswer,
		ActivityKindFillBlanks,
		ActivityKindOrdering,
		ActivityKindMatching,
		ActivityKindNumeric,
		ActivityKindWriting,
	} {
		if _, ok := registry.evaluators[kind]; !ok {
			t.Fatalf("default registry missing %s evaluator", kind)
		}
	}
	if _, ok := registry.evaluators[ActivityKindCoding]; ok {
		t.Fatal("coding evaluator must remain behind the trusted runner adapter")
	}
}
