package ai

import (
	"context"
	"strings"
	"testing"
)

func TestDisabledProviderReturnsStableUnavailableEvent(t *testing.T) {
	ch, err := (DisabledProvider{}).Stream(context.Background(), Request{Question: "why"})
	if err != nil {
		t.Fatal(err)
	}
	e := <-ch
	if e.Type != "ai.unavailable" {
		t.Fatalf("%#v", e)
	}
}
func TestBuildContextIncludesOnlySelectedData(t *testing.T) {
	r := BuildRequest(ContextSelection{Question: "q", LessonBlocks: []ContextItem{{Kind: "lesson", Name: "x", Content: "safe"}}, SelectedFiles: []ContextItem{{Kind: "workspace", Name: "main.go", Content: "code"}}, TerminalOutput: "out", Environment: map[string]string{"API_KEY": "secret"}, UnselectedFiles: []ContextItem{{Name: "secret.txt", Content: "hidden"}}}, 32)
	b := r.Question
	for _, i := range r.ContextItems {
		b += i.Name + i.Content
	}
	for _, x := range []string{"API_KEY", "secret.txt", "hidden"} {
		if strings.Contains(b, x) {
			t.Fatalf("leaked %s", x)
		}
	}
}
