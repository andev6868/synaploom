package course

import (
	"regexp"
	"strings"

	"github.com/yuin/goldmark/ast"
	extast "github.com/yuin/goldmark/extension/ast"
)

var keyboardPattern = regexp.MustCompile(`^<kbd>([^<]+)</kbd>$`)

func (s *markdownState) inlineChildren(parent ast.Node, source []byte) []any {
	result := []any{}
	for child := parent.FirstChild(); child != nil; child = child.NextSibling() {
		result = append(result, s.inlineNode(child, source)...)
	}
	return result
}

func (s *markdownState) inlineNode(node ast.Node, source []byte) []any {
	switch current := node.(type) {
	case *ast.Text:
		value := string(current.Segment.Value(source))
		nodes := tokenizeInlineMath(value, s)
		if current.HardLineBreak() {
			nodes = append(nodes, map[string]any{"type": "hard-break"})
		} else if current.SoftLineBreak() {
			nodes = append(nodes, map[string]any{"type": "text", "value": "\n"})
		}
		return nodes
	case *ast.String:
		return tokenizeInlineMath(string(current.Value), s)
	case *ast.Emphasis:
		kind := "emphasis"
		if current.Level == 2 {
			kind = "strong"
		}
		return []any{map[string]any{"type": kind, "children": s.inlineChildren(current, source)}}
	case *extast.Strikethrough:
		return []any{map[string]any{"type": "strikethrough", "children": s.inlineChildren(current, source)}}
	case *ast.CodeSpan:
		value := strings.TrimSpace(nodeText(current, source))
		if match := keyboardPattern.FindStringSubmatch(value); len(match) == 2 {
			return []any{map[string]any{"type": "keyboard", "value": match[1]}}
		}
		return []any{map[string]any{"type": "code", "value": value}}
	case *ast.Link:
		href, ok := safeLinkDestination(string(current.Destination))
		if !ok {
			s.issue("DOCUMENT_LINK_UNSAFE", "link destination is unsafe", string(current.Destination))
			return []any{map[string]any{"type": "text", "value": nodeText(current, source)}}
		}
		link := map[string]any{"type": "link", "href": href, "children": s.inlineChildren(current, source)}
		if len(current.Title) > 0 {
			link["title"] = string(current.Title)
		}
		if parsed := strings.ToLower(href); strings.HasPrefix(parsed, "http://") || strings.HasPrefix(parsed, "https://") || strings.HasPrefix(parsed, "mailto:") {
			link["external"] = true
		}
		return []any{link}
	case *ast.AutoLink:
		href := string(current.URL(source))
		if safe, ok := safeLinkDestination(href); ok {
			return []any{map[string]any{"type": "link", "href": safe, "external": true, "children": []any{map[string]any{"type": "text", "value": string(current.Label(source))}}}}
		}
	case *ast.RawHTML:
		return []any{map[string]any{"type": "text", "value": rawHTMLText(current, source)}}
	case *extast.TaskCheckBox:
		return nil
	case *extast.FootnoteLink:
		return []any{map[string]any{"type": "footnote-reference", "id": string(rune(current.Index + '0'))}}
	}
	value := nodeText(node, source)
	if value == "" {
		return nil
	}
	return []any{map[string]any{"type": "text", "value": value}}
}

func tokenizeInlineMath(value string, state *markdownState) []any {
	result := []any{}
	for len(value) > 0 {
		start := strings.IndexByte(value, '$')
		if start < 0 {
			result = appendText(result, value)
			break
		}
		if start > 0 {
			result = appendText(result, value[:start])
		}
		remaining := value[start+1:]
		end := strings.IndexByte(remaining, '$')
		if end < 0 {
			state.issue("MATH_SOURCE_INVALID", "inline math delimiter is not balanced", value[start:])
			result = appendText(result, value[start:])
			break
		}
		source := remaining[:end]
		if strings.TrimSpace(source) == "" {
			state.issue("MATH_SOURCE_INVALID", "math source cannot be empty", "$")
			result = appendText(result, "$$")
		} else {
			result = append(result, map[string]any{"type": "math", "source": source})
		}
		value = remaining[end+1:]
	}
	return result
}

func appendText(nodes []any, value string) []any {
	if value == "" {
		return nodes
	}
	return append(nodes, map[string]any{"type": "text", "value": value})
}

func rawHTMLText(node *ast.RawHTML, source []byte) string {
	var builder strings.Builder
	segments := node.Segments
	for index := 0; index < segments.Len(); index++ {
		segment := segments.At(index)
		builder.Write(segment.Value(source))
	}
	return builder.String()
}

func nodeText(node ast.Node, source []byte) string {
	var builder strings.Builder
	_ = ast.Walk(node, func(current ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := current.(type) {
		case *ast.Text:
			builder.Write(n.Segment.Value(source))
		case *ast.String:
			builder.Write(n.Value)
		}
		return ast.WalkContinue, nil
	})
	return builder.String()
}
