package activity

import "testing"

func TestResolvePresentationSystemDefaults(t *testing.T) {
	cases := []struct {
		kind    ActivityKind
		config  map[string]any
		surface string
		width   string
	}{
		{ActivityKindTrueFalse, map[string]any{}, "inline", "compact"},
		{ActivityKindSingleChoice, map[string]any{"options": []any{1, 2}}, "inline", "compact"},
		{ActivityKindSingleChoice, map[string]any{"options": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
		{ActivityKindShortAnswer, map[string]any{}, "inline", "compact"},
		{ActivityKindFillBlanks, map[string]any{}, "inline", "compact"},
		{ActivityKindNumeric, map[string]any{}, "inline", "compact"},
		{ActivityKindMultipleChoice, map[string]any{"options": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
		{ActivityKindOrdering, map[string]any{"items": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
		{ActivityKindMatching, map[string]any{"left": []any{1, 2, 3, 4, 5, 6}}, "practice", "standard"},
		{ActivityKindWriting, map[string]any{}, "practice", "wide"},
		{ActivityKindCoding, map[string]any{}, "practice", "wide"},
	}
	for _, tc := range cases {
		t.Run(string(tc.kind), func(t *testing.T) {
			got := ResolvePresentation(ActivityDefinition{Kind: tc.kind, Config: tc.config})
			if got.DefaultSurface != tc.surface || got.PreferredWidth != tc.width {
				t.Fatalf("ResolvePresentation()=%+v", got)
			}
		})
	}
}

func TestResolvePresentationHonorsAuthoredPolicyAndPublicView(t *testing.T) {
	presentation := ActivityPresentation{DefaultSurface: "inline", AllowInline: true, AllowPractice: false, PreferredWidth: "standard", SupportsFullscreen: false}
	definition := ActivityDefinition{ID: "quiz", Kind: ActivityKindSingleChoice, Title: "Quiz", Prompt: map[string]any{"blocks": []any{}}, Config: map[string]any{"options": []any{}}, Presentation: &presentation}
	got := ResolvePresentation(definition)
	if got != presentation {
		t.Fatalf("got=%+v", got)
	}
	view, err := publicView(definition)
	if err != nil {
		t.Fatal(err)
	}
	if view.Presentation != presentation {
		t.Fatalf("view=%+v", view.Presentation)
	}
}
