package ai

import "strings"

type ContextSelection struct {
	Question        string
	LessonBlocks    []ContextItem
	Exercise        *ContextItem
	SelectedFiles   []ContextItem
	TerminalOutput  string
	Environment     map[string]string
	UnselectedFiles []ContextItem
}

func BuildRequest(s ContextSelection, max int) Request {
	items := append([]ContextItem(nil), s.LessonBlocks...)
	if s.Exercise != nil {
		items = append(items, *s.Exercise)
	}
	items = append(items, s.SelectedFiles...)
	if max < 0 {
		max = 0
	}
	out := s.TerminalOutput
	if len(out) > max {
		out = out[:max]
	}
	if strings.TrimSpace(out) != "" {
		items = append(items, ContextItem{Kind: "terminal", Name: "recent-output", Content: out})
	}
	return Request{Question: s.Question, ContextItems: items}
}
