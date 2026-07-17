package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type HTTPProvider struct {
	config Config
	client *http.Client
}

func NewHTTPProvider(c Config) *HTTPProvider {
	if c.ReadTimeout <= 0 {
		c.ReadTimeout = 2 * time.Minute
	}
	if c.MaxResponseBytes <= 0 {
		c.MaxResponseBytes = 1 << 20
	}
	return &HTTPProvider{config: c, client: &http.Client{Timeout: c.ReadTimeout}}
}
func (p *HTTPProvider) Stream(ctx context.Context, r Request) (<-chan Event, error) {
	if strings.TrimSpace(p.config.Endpoint) == "" {
		return nil, errors.New("AI endpoint is required")
	}
	payload, _ := json.Marshal(map[string]any{"model": p.config.Model, "stream": true, "question": r.Question, "contextItems": r.ContextItems})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.config.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if p.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("AI upstream returned %s: %s", resp.Status, strings.TrimSpace(string(b)))
	}
	out := make(chan Event)
	go func() {
		defer close(out)
		defer resp.Body.Close()
		s := bufio.NewScanner(io.LimitReader(resp.Body, p.config.MaxResponseBytes))
		for s.Scan() {
			var e Event
			if json.Unmarshal(s.Bytes(), &e) != nil {
				continue
			}
			select {
			case out <- e:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out, nil
}

type DisclosureItem struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}
type Disclosure struct {
	Local bool             `json:"local"`
	Items []DisclosureItem `json:"items"`
}

func Disclose(r Request, local bool) Disclosure {
	items := make([]DisclosureItem, 0, len(r.ContextItems))
	for _, i := range r.ContextItems {
		items = append(items, DisclosureItem{Kind: i.Kind, Name: i.Name})
	}
	return Disclosure{Local: local, Items: items}
}
