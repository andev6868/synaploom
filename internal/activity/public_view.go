package activity

import "fmt"

func publicView(definition ActivityDefinition) (PublicActivityView, error) {
	config, err := redactConfig(definition.Kind, definition.Config)
	if err != nil {
		return PublicActivityView{}, err
	}
	view := PublicActivityView{
		ID: definition.ID, Kind: definition.Kind, Title: definition.Title,
		Prompt: cloneMap(definition.Prompt), Config: config,
		Evaluation: definition.Evaluation, Completion: definition.Completion,
	}
	if definition.Feedback.ShowExplanation {
		feedback := definition.Feedback
		view.Feedback = &feedback
	}
	return view, nil
}

func redactConfig(kind ActivityKind, config map[string]any) (map[string]any, error) {
	copyKeys := func(keys ...string) map[string]any {
		out := make(map[string]any, len(keys))
		for _, key := range keys {
			if value, ok := config[key]; ok {
				out[key] = cloneValue(value)
			}
		}
		return out
	}
	switch kind {
	case ActivityKindSingleChoice:
		return sanitizeOptions(copyKeys("options", "randomize")), nil
	case ActivityKindMultipleChoice:
		return sanitizeOptions(copyKeys("options", "evaluationMode", "randomize")), nil
	case ActivityKindTrueFalse:
		return map[string]any{}, nil
	case ActivityKindShortAnswer:
		return copyKeys("normalization", "maximumLength"), nil
	case ActivityKindFillBlanks:
		out := copyKeys("scoring")
		if blanks, ok := config["blanks"].([]any); ok {
			publicBlanks := make([]any, 0, len(blanks))
			for _, item := range blanks {
				blank, ok := item.(map[string]any)
				if !ok {
					continue
				}
				public := map[string]any{}
				for _, key := range []string{"id", "label", "normalization"} {
					if value, exists := blank[key]; exists {
						public[key] = cloneValue(value)
					}
				}
				publicBlanks = append(publicBlanks, public)
			}
			out["blanks"] = publicBlanks
		}
		return out, nil
	case ActivityKindOrdering:
		return sanitizeOptions(copyKeys("items", "evaluationMode", "randomize")), nil
	case ActivityKindMatching:
		out := copyKeys("left", "right", "randomize")
		return sanitizeOptions(out), nil
	case ActivityKindNumeric:
		return copyKeys("answerMode", "absoluteTolerance", "relativeTolerance", "unit", "requireUnit"), nil
	case ActivityKindWriting:
		return copyKeys("minimumCharacters", "maximumCharacters", "answerFormat", "rubric", "outlinePrompts"), nil
	case ActivityKindCoding:
		return copyKeys("schemaVersion", "id", "title", "runtime", "workspace", "actions", "checks", "completion"), nil
	default:
		return nil, fmt.Errorf("unsupported activity kind %q", kind)
	}
}

func sanitizeOptions(config map[string]any) map[string]any {
	for _, key := range []string{"options", "items", "left", "right"} {
		items, ok := config[key].([]any)
		if !ok {
			continue
		}
		publicItems := make([]any, 0, len(items))
		for _, item := range items {
			option, ok := item.(map[string]any)
			if !ok {
				continue
			}
			public := map[string]any{}
			for _, field := range []string{"id", "label"} {
				if value, exists := option[field]; exists {
					public[field] = cloneValue(value)
				}
			}
			publicItems = append(publicItems, public)
		}
		config[key] = publicItems
	}
	return config
}

func cloneMap(input map[string]any) map[string]any {
	return cloneValue(input).(map[string]any)
}

func cloneValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, child := range typed {
			out[key] = cloneValue(child)
		}
		return out
	case []any:
		out := make([]any, len(typed))
		for index, child := range typed {
			out[index] = cloneValue(child)
		}
		return out
	default:
		return typed
	}
}
