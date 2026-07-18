package course

import (
	"fmt"
	"strings"

	generated "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
)

type LessonMetadata struct {
	ID       string
	CourseID string
	Position int
	Title    string
	Type     generated.LessonDocumentType
}

type MarkdownParseOptions struct {
	CourseRoot string
	LessonRoot string
	Strict     bool
	Metadata   LessonMetadata
}

func ParseLessonDocument(source string, options MarkdownParseOptions) (generated.LessonDocument, []ValidationIssue) {
	state := &markdownState{
		source:     []byte(source),
		options:    options,
		activities: map[string]struct{}{},
		markdown: goldmark.New(
			goldmark.WithExtensions(extension.GFM, extension.Footnote),
			goldmark.WithParserOptions(parser.WithAutoHeadingID()),
		),
	}
	rawBlocks := state.parseDocument(source)
	blocks := make([]generated.LessonBlock, len(rawBlocks))
	for index, block := range rawBlocks {
		blocks[index] = block
	}
	return generated.LessonDocument{
		Id:       options.Metadata.ID,
		CourseId: options.Metadata.CourseID,
		Position: options.Metadata.Position,
		Title:    options.Metadata.Title,
		Type:     options.Metadata.Type,
		Blocks:   blocks,
	}, state.issues
}

func ParseLesson(markdown []byte, metadata LessonMetadata) (generated.LessonDocument, error) {
	document, issues := ParseLessonDocument(string(markdown), MarkdownParseOptions{Metadata: metadata})
	for _, issue := range issues {
		if strings.HasSuffix(issue.Code, "_INVALID") || strings.HasSuffix(issue.Code, "_UNKNOWN") || issue.Code == "ACTIVITY_EMBED_DUPLICATE" {
			return generated.LessonDocument{}, fmt.Errorf("%s: %s", issue.Code, issue.Message)
		}
	}
	return document, nil
}

type markdownState struct {
	source     []byte
	options    MarkdownParseOptions
	issues     []ValidationIssue
	activities map[string]struct{}
	markdown   goldmark.Markdown
}

func (s *markdownState) issue(code, message, path string) {
	s.issues = append(s.issues, ValidationIssue{Code: code, Message: message, Path: path})
}
