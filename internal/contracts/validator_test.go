package contracts

import "testing"

func TestValidateRejectsUnknownProcessEvent(t *testing.T) {
	validator := NewValidator()
	if err := validator.Validate("process-event", map[string]any{"type": "process.unknown"}); err == nil {
		t.Fatal("expected invalid process event to be rejected")
	}
}

func TestValidateAcceptsHierarchicalCourse(t *testing.T) {
	validator := NewValidator()
	course := map[string]any{
		"schemaVersion": "1.1.0",
		"id":            "runtime-course",
		"title":         "Runtime Course",
		"description":   "A course organized into chapters.",
		"version":       "1.0.0",
		"language":      "vi",
		"chapters": []any{
			map[string]any{
				"id":       "runtime",
				"title":    "Runtime",
				"required": true,
				"lessons": []any{
					map[string]any{"id": "call-stack", "required": true},
				},
				"assessments": []any{
					map[string]any{
						"id":              "runtime-capstone",
						"title":           "Runtime Capstone",
						"required":        true,
						"path":            "assessments/runtime-capstone",
						"requiresLessons": []any{"call-stack"},
						"completion":      map[string]any{"type": "all-required-checks"},
					},
				},
			},
		},
	}
	if err := validator.Validate("course", course); err != nil {
		t.Fatalf("expected hierarchical course to validate: %v", err)
	}
}
