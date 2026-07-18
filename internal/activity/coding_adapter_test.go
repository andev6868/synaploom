package activity

import "testing"

func TestDecodeCodingActivityPreservesWorkspaceActionsChecksAndCompletion(t *testing.T) {
	definition := ActivityDefinition{
		ID:    "event-loop-code",
		Kind:  ActivityKindCoding,
		Title: "Event Loop Lab",
		Config: map[string]any{
			"schemaVersion": "1.0",
			"id":            "event-loop-code",
			"title":         "Event Loop Lab",
			"runtime":       map[string]any{"kind": "local", "requires": []any{"node"}},
			"workspace":     map[string]any{"starter": "starter", "editable": []any{"index.js"}},
			"actions": map[string]any{
				"run":   map[string]any{"label": "Chạy chương trình", "executable": "node", "args": []any{"index.js"}, "timeoutMs": float64(1500), "maxOutputBytes": float64(4096)},
				"check": map[string]any{"label": "Kiểm tra kết quả", "executable": "node", "args": []any{"checks/check.mjs"}, "timeoutMs": float64(2000)},
			},
			"checks":     []any{map[string]any{"id": "order", "title": "Đúng thứ tự", "required": true}},
			"completion": map[string]any{"requireAllRequiredChecks": true},
		},
	}

	coding, err := DecodeCodingActivity(definition)
	if err != nil {
		t.Fatal(err)
	}
	if coding.ID != "event-loop-code" || coding.Title != "Event Loop Lab" {
		t.Fatalf("identity=%+v", coding)
	}
	if coding.Workspace.Starter != "starter" || len(coding.Workspace.Editable) != 1 || coding.Workspace.Editable[0] != "index.js" {
		t.Fatalf("workspace=%+v", coding.Workspace)
	}
	if coding.Actions["check"].Label != "Kiểm tra kết quả" || coding.Actions["run"].MaxOutputBytes != 4096 {
		t.Fatalf("actions=%+v", coding.Actions)
	}
	if len(coding.Checks) != 1 || !coding.Checks[0].Required || !coding.Completion.RequireAllRequiredChecks {
		t.Fatalf("checks=%+v completion=%+v", coding.Checks, coding.Completion)
	}
}

func TestDecodeCodingActivityRejectsNonCodingAndInvalidCommands(t *testing.T) {
	if _, err := DecodeCodingActivity(ActivityDefinition{Kind: ActivityKindWriting}); err == nil {
		t.Fatal("expected non-coding definition to be rejected")
	}
	_, err := DecodeCodingActivity(ActivityDefinition{
		ID: "bad", Kind: ActivityKindCoding, Title: "Bad",
		Config: map[string]any{
			"schemaVersion": "1.0", "id": "bad", "title": "Bad",
			"runtime":   map[string]any{"kind": "local", "requires": []any{}},
			"workspace": map[string]any{"editable": []any{"index.js"}},
			"actions":   map[string]any{"run": map[string]any{"label": "Run", "executable": "", "args": []any{}, "timeoutMs": float64(1000)}},
			"checks":    []any{}, "completion": map[string]any{"requireAllRequiredChecks": true},
		},
	})
	if err == nil {
		t.Fatal("expected empty executable to be rejected")
	}
}
