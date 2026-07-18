package activity

import (
	"encoding/json"
	"fmt"
	"strings"
)

// CodingWorkspaceDefinition is the trusted runtime configuration carried by a coding activity.
// It is decoded only after Course Schema validation and remains behind the local runner boundary.
type CodingWorkspaceDefinition struct {
	SchemaVersion string                  `json:"schemaVersion"`
	ID            string                  `json:"id"`
	Title         string                  `json:"title"`
	Runtime       CodingRuntimeDefinition `json:"runtime"`
	Workspace     CodingWorkspaceFiles    `json:"workspace"`
	Actions       map[string]CodingAction `json:"actions"`
	Checks        []CodingCheck           `json:"checks"`
	Completion    CodingCompletion        `json:"completion"`
}

type CodingRuntimeDefinition struct {
	Kind     string   `json:"kind"`
	Requires []string `json:"requires"`
}

type CodingWorkspaceFiles struct {
	Starter  string   `json:"starter,omitempty"`
	Editable []string `json:"editable"`
}

type CodingAction struct {
	Label          string   `json:"label"`
	Executable     string   `json:"executable"`
	Args           []string `json:"args"`
	TimeoutMs      int      `json:"timeoutMs"`
	MaxOutputBytes int64    `json:"maxOutputBytes,omitempty"`
}

type CodingCheck struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Required bool   `json:"required"`
}

type CodingCompletion struct {
	RequireAllRequiredChecks bool `json:"requireAllRequiredChecks"`
}

// DecodeCodingActivity converts a validated activity definition to a typed trusted-runner config.
func DecodeCodingActivity(definition ActivityDefinition) (CodingWorkspaceDefinition, error) {
	if definition.Kind != ActivityKindCoding {
		return CodingWorkspaceDefinition{}, fmt.Errorf("%w: activity %q is not coding", ErrEvaluatorConfigInvalid, definition.ID)
	}
	data, err := json.Marshal(definition.Config)
	if err != nil {
		return CodingWorkspaceDefinition{}, fmt.Errorf("encode coding config: %w", err)
	}
	var config CodingWorkspaceDefinition
	if err := json.Unmarshal(data, &config); err != nil {
		return CodingWorkspaceDefinition{}, fmt.Errorf("%w: decode coding config: %v", ErrEvaluatorConfigInvalid, err)
	}
	if config.ID == "" {
		config.ID = definition.ID
	}
	if config.Title == "" {
		config.Title = definition.Title
	}
	if config.SchemaVersion != "1.0" || config.ID == "" || config.Title == "" || config.Runtime.Kind != "local" {
		return CodingWorkspaceDefinition{}, fmt.Errorf("%w: invalid coding identity or runtime", ErrEvaluatorConfigInvalid)
	}
	if len(config.Workspace.Editable) == 0 {
		return CodingWorkspaceDefinition{}, fmt.Errorf("%w: coding workspace requires editable files", ErrEvaluatorConfigInvalid)
	}
	for id, action := range config.Actions {
		if strings.TrimSpace(id) == "" || strings.TrimSpace(action.Label) == "" || strings.TrimSpace(action.Executable) == "" || action.TimeoutMs <= 0 {
			return CodingWorkspaceDefinition{}, fmt.Errorf("%w: invalid coding action %q", ErrEvaluatorConfigInvalid, id)
		}
	}
	return config, nil
}
