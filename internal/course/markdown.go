package course

import (
	"bytes"
	"fmt"
	"net/url"
	"strings"

	generated "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

type LessonMetadata struct {
	ID       string
	CourseID string
	Position int
	Title    string
	Type     generated.LessonDocumentType
}

func ParseLesson(markdown []byte, metadata LessonMetadata) (generated.LessonDocument, error) {
	md := goldmark.New(goldmark.WithParserOptions(parser.WithAutoHeadingID()))
	doc := md.Parser().Parse(text.NewReader(markdown))
	blocks := make([]generated.LessonDocumentBlocksElem, 0)
	for node := doc.FirstChild(); node != nil; node = node.NextSibling() {
		block, include, err := normalizeNode(node, markdown, metadata.Title)
		if err != nil {
			return generated.LessonDocument{}, err
		}
		if include {
			blocks = append(blocks, block)
		}
	}
	return generated.LessonDocument{Id: metadata.ID, CourseId: metadata.CourseID, Position: metadata.Position, Title: metadata.Title, Type: metadata.Type, Blocks: blocks}, nil
}

func normalizeNode(node ast.Node, source []byte, title string) (generated.LessonDocumentBlocksElem, bool, error) {
	props := map[string]any{}
	switch current := node.(type) {
	case *ast.Heading:
		value := nodeText(current, source)
		if current.Level == 1 && strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(title)) {
			return generated.LessonDocumentBlocksElem{}, false, nil
		}
		props["level"] = current.Level
		props["text"] = value
		return block("heading", props), true, nil
	case *ast.Paragraph:
		props["text"] = nodeText(current, source)
		return block("paragraph", props), true, nil
	case *ast.FencedCodeBlock:
		var value bytes.Buffer
		lines := current.Lines()
		for i := 0; i < lines.Len(); i++ {
			segment := lines.At(i)
			value.Write(segment.Value(source))
		}
		props["language"] = string(current.Language(source))
		props["code"] = value.String()
		return block("code", props), true, nil
	case *ast.CodeBlock:
		var value bytes.Buffer
		lines := current.Lines()
		for i := 0; i < lines.Len(); i++ {
			segment := lines.At(i)
			value.Write((&segment).Value(source))
		}
		props["code"] = value.String()
		return block("code", props), true, nil
	case *ast.List:
		var items []string
		for item := current.FirstChild(); item != nil; item = item.NextSibling() {
			items = append(items, nodeText(item, source))
		}
		props["ordered"] = current.IsOrdered()
		props["items"] = items
		return block("list", props), true, nil
	case *ast.HTMLBlock:
		var value bytes.Buffer
		lines := current.Lines()
		for i := 0; i < lines.Len(); i++ {
			segment := lines.At(i)
			value.Write((&segment).Value(source))
		}
		props["text"] = value.String()
		return block("paragraph", props), true, nil
	default:
		value := strings.TrimSpace(nodeText(node, source))
		if value == "" {
			return generated.LessonDocumentBlocksElem{}, false, nil
		}
		props["text"] = value
		return block("paragraph", props), true, nil
	}
}

func block(kind string, properties map[string]any) generated.LessonDocumentBlocksElem {
	return generated.LessonDocumentBlocksElem{Type: kind, AdditionalProperties: properties}
}

func nodeText(node ast.Node, source []byte) string {
	var builder strings.Builder
	_ = ast.Walk(node, func(current ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := current.(type) {
		case *ast.Text:
			segment := n.Segment
			builder.Write((&segment).Value(source))
			if n.SoftLineBreak() {
				builder.WriteByte('\n')
			}
		case *ast.Link:
			if unsafeURL(string(n.Destination)) {
				builder.WriteString("[unsafe link]")
			}
		}
		return ast.WalkContinue, nil
	})
	return builder.String()
}

func unsafeURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	return err != nil || strings.EqualFold(parsed.Scheme, "javascript")
}

func ValidateAssetPath(path string) error {
	if err := validateRelativePath(path); err != nil {
		return fmt.Errorf("asset path: %w", err)
	}
	return nil
}
