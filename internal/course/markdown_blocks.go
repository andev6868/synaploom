package course

import (
	"bytes"
	"strings"

	"github.com/yuin/goldmark/ast"
	extast "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/text"
)

func (s *markdownState) parseMarkdown(source string) []any {
	reader := text.NewReader([]byte(source))
	document := s.markdown.Parser().Parse(reader)
	return s.blockChildren(document, []byte(source))
}

func (s *markdownState) blockChildren(parent ast.Node, source []byte) []any {
	blocks := []any{}
	for node := parent.FirstChild(); node != nil; node = node.NextSibling() {
		if block, include := s.blockNode(node, source); include {
			blocks = append(blocks, block)
		}
	}
	return blocks
}

func (s *markdownState) blockNode(node ast.Node, source []byte) (any, bool) {
	switch current := node.(type) {
	case *ast.Heading:
		children := s.inlineChildren(current, source)
		if current.Level == 1 && strings.EqualFold(strings.TrimSpace(inlinePlainText(children)), strings.TrimSpace(s.options.Metadata.Title)) {
			return nil, false
		}
		return map[string]any{"type": "heading", "level": current.Level, "children": children}, true
	case *ast.Paragraph:
		return map[string]any{"type": "paragraph", "children": s.inlineChildren(current, source)}, true
	case *ast.Blockquote:
		return map[string]any{"type": "blockquote", "blocks": s.blockChildren(current, source)}, true
	case *ast.List:
		items := []any{}
		for item := current.FirstChild(); item != nil; item = item.NextSibling() {
			checked := any(nil)
			_ = ast.Walk(item, func(descendant ast.Node, entering bool) (ast.WalkStatus, error) {
				if entering {
					if checkbox, ok := descendant.(*extast.TaskCheckBox); ok {
						checked = checkbox.IsChecked
						return ast.WalkStop, nil
					}
				}
				return ast.WalkContinue, nil
			})
			items = append(items, map[string]any{"checked": checked, "blocks": s.blockChildren(item, source)})
		}
		block := map[string]any{"type": "list", "ordered": current.IsOrdered(), "items": items}
		if current.IsOrdered() && current.Start > 1 {
			block["start"] = current.Start
		}
		return block, true
	case *ast.FencedCodeBlock:
		return codeBlock(current.Lines(), source, string(current.Language(source))), true
	case *ast.CodeBlock:
		return codeBlock(current.Lines(), source, ""), true
	case *ast.ThematicBreak:
		return map[string]any{"type": "thematic-break"}, true
	case *extast.Table:
		alignments := make([]any, len(current.Alignments))
		for index, alignment := range current.Alignments {
			if alignment == extast.AlignNone {
				alignments[index] = nil
			} else {
				alignments[index] = alignment.String()
			}
		}
		var header any = map[string]any{"cells": []any{}}
		rows := []any{}
		for child := current.FirstChild(); child != nil; child = child.NextSibling() {
			row := tableRow(child, source, s)
			if _, ok := child.(*extast.TableHeader); ok {
				header = row
			} else {
				rows = append(rows, row)
			}
		}
		return map[string]any{"type": "table", "alignments": alignments, "header": header, "rows": rows}, true
	case *extast.Footnote:
		return map[string]any{"type": "footnote-definition", "id": string(current.Ref), "blocks": s.blockChildren(current, source)}, true
	case *extast.FootnoteList:
		blocks := s.blockChildren(current, source)
		if len(blocks) == 1 {
			return blocks[0], true
		}
		return map[string]any{"type": "blockquote", "blocks": blocks}, true
	case *ast.HTMLBlock:
		var value bytes.Buffer
		for index := 0; index < current.Lines().Len(); index++ {
			segment := current.Lines().At(index)
			value.Write(segment.Value(source))
		}
		return map[string]any{"type": "paragraph", "children": []any{map[string]any{"type": "text", "value": value.String()}}}, true
	default:
		value := strings.TrimSpace(nodeText(node, source))
		if value == "" {
			return nil, false
		}
		return map[string]any{"type": "paragraph", "children": []any{map[string]any{"type": "text", "value": value}}}, true
	}
}

func codeBlock(lines *text.Segments, source []byte, language string) map[string]any {
	var value bytes.Buffer
	for index := 0; index < lines.Len(); index++ {
		segment := lines.At(index)
		value.Write(segment.Value(source))
	}
	return map[string]any{"type": "code", "language": language, "code": value.String()}
}

func tableRow(node ast.Node, source []byte, state *markdownState) map[string]any {
	cells := []any{}
	for cell := node.FirstChild(); cell != nil; cell = cell.NextSibling() {
		cells = append(cells, map[string]any{"children": state.inlineChildren(cell, source)})
	}
	return map[string]any{"cells": cells}
}

func inlinePlainText(nodes []any) string {
	var builder strings.Builder
	for _, raw := range nodes {
		node, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if value, ok := node["value"].(string); ok {
			builder.WriteString(value)
		}
		if children, ok := node["children"].([]any); ok {
			builder.WriteString(inlinePlainText(children))
		}
	}
	return builder.String()
}
