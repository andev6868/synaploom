package ai

import "context"

type Provider interface {
	Stream(context.Context, Request) (<-chan Event, error)
}
type Request struct {
	Question     string        `json:"question"`
	ContextItems []ContextItem `json:"contextItems"`
}
type ContextItem struct {
	Kind    string `json:"kind"`
	Name    string `json:"name"`
	Content string `json:"content"`
}
type Event struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
	Error   string `json:"error,omitempty"`
}
