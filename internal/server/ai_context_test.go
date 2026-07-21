package server

import (
	"strings"
	"testing"
)

func TestNormalizeAISelectedTextUsesUnicodeLimit(t *testing.T) {
	input := strings.Repeat("界", 2001)
	_, err := normalizeAISelectedText(input)
	if err == nil {
		t.Fatal("expected selected text limit error")
	}

	got, err := normalizeAISelectedText("  dòng một\r\n\r\n  dòng hai  ")
	if err != nil {
		t.Fatal(err)
	}
	if got != "dòng một\n\ndòng hai" {
		t.Fatalf("got %q", got)
	}
}

func TestValidateAIPayloadRejectsCrossSourceActivity(t *testing.T) {
	err := validateAIPayload(aiGeneratePayload{
		Kind: "explain", Prompt: "why", Source: "theory", ActivityID: "a1",
	})
	if err == nil {
		t.Fatal("expected theory activityId validation error")
	}
}
