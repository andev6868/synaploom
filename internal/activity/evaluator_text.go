package activity

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

type textEvaluator struct {
	kind ActivityKind
}

func NewTextEvaluator(kind ActivityKind) Evaluator {
	return &textEvaluator{kind: kind}
}

func (e *textEvaluator) Kind() ActivityKind { return e.kind }

func (e *textEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	if definition.Kind != e.kind {
		return EvaluationResult{}, evaluatorConfigError(e.kind, "definition kind does not match evaluator")
	}
	switch e.kind {
	case ActivityKindShortAnswer:
		return evaluateShortAnswer(definition, raw)
	case ActivityKindFillBlanks:
		return evaluateFillBlanks(definition, raw)
	default:
		return EvaluationResult{}, ErrEvaluatorUnavailable
	}
}

type textNormalization struct {
	trim                 bool
	unicodeNormalization string
	caseSensitive        bool
	collapseWhitespace   bool
	removePunctuation    bool
}

func evaluateShortAnswer(definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	var answer struct {
		Kind  ActivityKind `json:"kind"`
		Value any          `json:"value"`
	}
	if err := decodeAnswer(raw, ActivityKindShortAnswer, &answer); err != nil {
		return EvaluationResult{}, err
	}
	value, ok := answer.Value.(string)
	if answer.Kind != ActivityKindShortAnswer || !ok {
		return EvaluationResult{}, malformedAnswer(ActivityKindShortAnswer, "value must be a string")
	}
	normalization, err := parseTextNormalization(definition.Config["normalization"])
	if err != nil {
		return EvaluationResult{}, err
	}
	normalized := normalizeText(value, normalization)
	accepted, correctAnswer, err := textAccepted(definition.Config, normalized, normalization)
	if err != nil {
		return EvaluationResult{}, err
	}
	score := 0.0
	if accepted {
		score = definition.Evaluation.Points
	}
	details := []ActivityFeedbackItem{{Code: "NORMALIZED_ANSWER", Message: normalized}}
	return evaluatedResult(definition, score, accepted, details, correctAnswer), nil
}

func evaluateFillBlanks(definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	var answer struct {
		Kind   ActivityKind `json:"kind"`
		Values any          `json:"values"`
	}
	if err := decodeAnswer(raw, ActivityKindFillBlanks, &answer); err != nil {
		return EvaluationResult{}, err
	}
	values, ok := answer.Values.(map[string]any)
	if answer.Kind != ActivityKindFillBlanks || !ok {
		return EvaluationResult{}, malformedAnswer(ActivityKindFillBlanks, "values must be an object of strings")
	}
	blanks, ok := definition.Config["blanks"].([]any)
	if !ok || len(blanks) == 0 {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindFillBlanks, "blanks must be a non-empty array")
	}

	correctCount := 0
	details := make([]ActivityFeedbackItem, 0, len(blanks)*2)
	correctAnswers := make(map[string]any, len(blanks))
	configuredIDs := make(map[string]struct{}, len(blanks))
	for _, rawBlank := range blanks {
		blank, ok := rawBlank.(map[string]any)
		if !ok {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindFillBlanks, "each blank must be an object")
		}
		id, ok := blank["id"].(string)
		if !ok || id == "" {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindFillBlanks, "each blank must have a non-empty id")
		}
		if _, duplicate := configuredIDs[id]; duplicate {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindFillBlanks, "blank ids must be unique")
		}
		configuredIDs[id] = struct{}{}
		learnerValue, exists := values[id]
		text, stringValue := learnerValue.(string)
		if !exists || !stringValue {
			return EvaluationResult{}, malformedAnswer(ActivityKindFillBlanks, "every configured blank must have a string value")
		}
		normalization, err := parseTextNormalization(blank["normalization"])
		if err != nil {
			return EvaluationResult{}, err
		}
		normalized := normalizeText(text, normalization)
		details = append(details, ActivityFeedbackItem{Code: "NORMALIZED_ANSWER", Message: normalized, Field: stringPointer(id)})
		accepted, correctAnswer, err := textAccepted(blank, normalized, normalization)
		if err != nil {
			return EvaluationResult{}, err
		}
		correctAnswers[id] = correctAnswer
		if accepted {
			correctCount++
		} else {
			details = append(details, ActivityFeedbackItem{Code: "BLANK_INCORRECT", Message: "Câu trả lời cho ô này chưa chính xác.", Field: stringPointer(id)})
		}
	}
	for id, value := range values {
		if _, configured := configuredIDs[id]; !configured {
			return EvaluationResult{}, malformedAnswer(ActivityKindFillBlanks, "values contains an unknown blank: "+id)
		}
		if _, ok := value.(string); !ok {
			return EvaluationResult{}, malformedAnswer(ActivityKindFillBlanks, "blank values must be strings")
		}
	}

	fullyCorrect := correctCount == len(blanks)
	scoring, _ := definition.Config["scoring"].(string)
	if scoring == "" {
		scoring = "all-or-nothing"
	}
	score := 0.0
	switch scoring {
	case "all-or-nothing":
		if fullyCorrect {
			score = definition.Evaluation.Points
		}
	case "per-blank":
		score = definition.Evaluation.Points * float64(correctCount) / float64(len(blanks))
	default:
		return EvaluationResult{}, evaluatorConfigError(ActivityKindFillBlanks, "scoring must be all-or-nothing or per-blank")
	}
	return evaluatedResult(definition, score, fullyCorrect, details, correctAnswers), nil
}

func parseTextNormalization(raw any) (textNormalization, error) {
	configuration := textNormalization{trim: true, unicodeNormalization: "NFC", caseSensitive: false, collapseWhitespace: true}
	if raw == nil {
		return configuration, nil
	}
	values, ok := raw.(map[string]any)
	if !ok {
		return textNormalization{}, evaluatorConfigError(ActivityKindShortAnswer, "normalization must be an object")
	}
	if value, exists := values["trim"]; exists {
		parsed, ok := value.(bool)
		if !ok {
			return textNormalization{}, evaluatorConfigError(ActivityKindShortAnswer, "normalization.trim must be boolean")
		}
		configuration.trim = parsed
	}
	if value, exists := values["unicodeNormalization"]; exists {
		parsed, ok := value.(string)
		if !ok || (parsed != "NFC" && parsed != "NFKC" && parsed != "none") {
			return textNormalization{}, evaluatorConfigError(ActivityKindShortAnswer, "unicodeNormalization must be NFC, NFKC, or none")
		}
		configuration.unicodeNormalization = parsed
	}
	for key, target := range map[string]*bool{
		"caseSensitive":      &configuration.caseSensitive,
		"collapseWhitespace": &configuration.collapseWhitespace,
		"removePunctuation":  &configuration.removePunctuation,
	} {
		if value, exists := values[key]; exists {
			parsed, ok := value.(bool)
			if !ok {
				return textNormalization{}, evaluatorConfigError(ActivityKindShortAnswer, "normalization."+key+" must be boolean")
			}
			*target = parsed
		}
	}
	return configuration, nil
}

func normalizeText(value string, configuration textNormalization) string {
	switch configuration.unicodeNormalization {
	case "NFKC":
		value = norm.NFKC.String(value)
	case "NFC", "":
		value = norm.NFC.String(value)
	}
	if configuration.removePunctuation {
		value = strings.Map(func(r rune) rune {
			if unicode.IsPunct(r) {
				return -1
			}
			return r
		}, value)
	}
	if !configuration.caseSensitive {
		value = strings.ToLower(value)
	}
	if configuration.collapseWhitespace {
		value = strings.Join(strings.Fields(value), " ")
	} else if configuration.trim {
		value = strings.TrimSpace(value)
	}
	return value
}

func textAccepted(config map[string]any, normalized string, normalization textNormalization) (bool, any, error) {
	acceptedAnswers, answersPresent := stringSlice(config["acceptedAnswers"])
	patterns, patternsPresent := stringSlice(config["acceptedPatterns"])
	if (!answersPresent || len(acceptedAnswers) == 0) && (!patternsPresent || len(patterns) == 0) {
		return false, nil, evaluatorConfigError(ActivityKindShortAnswer, "acceptedAnswers or acceptedPatterns must be configured")
	}
	for _, accepted := range acceptedAnswers {
		if normalized == normalizeText(accepted, normalization) {
			return true, acceptedAnswers, nil
		}
	}
	for _, pattern := range patterns {
		compiled, err := compileSafePattern(pattern)
		if err != nil {
			return false, nil, err
		}
		if compiled.MatchString(normalized) {
			return true, acceptedAnswers, nil
		}
	}
	return false, acceptedAnswers, nil
}

func compileSafePattern(pattern string) (*regexp.Regexp, error) {
	if !utf8.ValidString(pattern) || len(pattern) > 256 {
		return nil, evaluatorConfigError(ActivityKindShortAnswer, "accepted pattern must be valid UTF-8 and at most 256 bytes")
	}
	if strings.Contains(pattern, "(?") || regexp.MustCompile(`\\[1-9]`).MatchString(pattern) || hasNestedQuantifier(pattern) {
		return nil, evaluatorConfigError(ActivityKindShortAnswer, "accepted pattern uses a prohibited construct")
	}
	compiled, err := regexp.Compile("^(?:" + pattern + ")$")
	if err != nil {
		return nil, evaluatorConfigError(ActivityKindShortAnswer, "accepted pattern is invalid")
	}
	return compiled, nil
}

func hasNestedQuantifier(pattern string) bool {
	depth := 0
	quantifiedAtDepth := make(map[int]bool)
	escaped := false
	for index, r := range pattern {
		if escaped {
			escaped = false
			continue
		}
		if r == '\\' {
			escaped = true
			continue
		}
		switch r {
		case '(':
			depth++
		case ')':
			if depth > 0 && index+1 < len(pattern) {
				next := pattern[index+1]
				if quantifiedAtDepth[depth] && (next == '+' || next == '*' || next == '?' || next == '{') {
					return true
				}
			}
			delete(quantifiedAtDepth, depth)
			if depth > 0 {
				depth--
			}
		case '+', '*', '?', '{':
			if depth > 0 {
				quantifiedAtDepth[depth] = true
			}
		}
	}
	return false
}
