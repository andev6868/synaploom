package course

import (
	"regexp"
	"strconv"
	"strings"
)

var directiveStart = regexp.MustCompile(`^:::([a-z][a-z0-9-]*)(?:\s+(.*))?$`)
var directiveAttribute = regexp.MustCompile(`([a-zA-Z][a-zA-Z0-9-]*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))`)

var allowedDirectives = map[string]struct{}{
	"note": {}, "hint": {}, "warning": {}, "important": {}, "misconception": {},
	"details": {}, "tabs": {}, "objectives": {}, "definition": {}, "theorem": {},
	"proof": {}, "worked-example": {}, "summary": {}, "vocabulary": {}, "compare": {},
	"walkthrough": {}, "activity": {}, "figure": {}, "audio": {}, "video": {}, "attachment": {},
}

type markdownChunk struct {
	plain      string
	directive  string
	attributes map[string]string
	body       string
}

func (s *markdownState) parseDocument(source string) []any {
	chunks := splitMarkdownChunks(source, s)
	blocks := []any{}
	for _, chunk := range chunks {
		if chunk.directive == "" {
			blocks = append(blocks, s.parseDisplayMathAndMarkdown(chunk.plain)...)
			continue
		}
		if block, ok := s.directiveBlock(chunk); ok {
			blocks = append(blocks, block)
		}
	}
	return blocks
}

func (s *markdownState) parseDisplayMathAndMarkdown(source string) []any {
	blocks := []any{}
	lines := strings.Split(source, "\n")
	var markdown strings.Builder
	flush := func() {
		if markdown.Len() > 0 {
			blocks = append(blocks, s.parseMarkdown(markdown.String())...)
			markdown.Reset()
		}
	}
	for index := 0; index < len(lines); {
		if strings.TrimSpace(lines[index]) != "$$" {
			markdown.WriteString(lines[index])
			markdown.WriteByte('\n')
			index++
			continue
		}
		flush()
		index++
		var math strings.Builder
		for index < len(lines) && strings.TrimSpace(lines[index]) != "$$" {
			math.WriteString(lines[index])
			math.WriteByte('\n')
			index++
		}
		if index >= len(lines) {
			s.issue("MATH_SOURCE_INVALID", "display math delimiter is not balanced", "$$")
			break
		}
		index++
		source := strings.TrimSpace(math.String())
		if source == "" {
			s.issue("MATH_SOURCE_INVALID", "math source cannot be empty", "$$")
			continue
		}
		blocks = append(blocks, map[string]any{"type": "math", "source": source})
	}
	flush()
	return blocks
}

func splitMarkdownChunks(source string, state *markdownState) []markdownChunk {
	lines := strings.Split(source, "\n")
	chunks := []markdownChunk{}
	var plain strings.Builder
	flush := func() {
		if plain.Len() > 0 {
			chunks = append(chunks, markdownChunk{plain: plain.String()})
			plain.Reset()
		}
	}
	for index := 0; index < len(lines); {
		match := directiveStart.FindStringSubmatch(strings.TrimSpace(lines[index]))
		if len(match) == 0 {
			plain.WriteString(lines[index])
			plain.WriteByte('\n')
			index++
			continue
		}
		flush()
		name := match[1]
		if _, ok := allowedDirectives[name]; !ok {
			state.issue("DOCUMENT_DIRECTIVE_UNKNOWN", "unknown directive "+name, name)
		}
		attributes := parseDirectiveAttributes(match[2])
		index++
		depth := 1
		var body strings.Builder
		for index < len(lines) {
			trimmed := strings.TrimSpace(lines[index])
			if directiveStart.MatchString(trimmed) {
				depth++
			}
			if trimmed == ":::" {
				depth--
				if depth == 0 {
					index++
					break
				}
			}
			body.WriteString(lines[index])
			body.WriteByte('\n')
			index++
		}
		chunks = append(chunks, markdownChunk{directive: name, attributes: attributes, body: body.String()})
	}
	flush()
	return chunks
}

func parseDirectiveAttributes(raw string) map[string]string {
	attributes := map[string]string{}
	for _, match := range directiveAttribute.FindAllStringSubmatch(raw, -1) {
		value := match[2]
		if value == "" {
			value = match[3]
		}
		if value == "" {
			value = match[4]
		}
		attributes[match[1]] = value
	}
	return attributes
}

func (s *markdownState) directiveBlock(chunk markdownChunk) (any, bool) {
	if _, ok := allowedDirectives[chunk.directive]; !ok {
		return nil, false
	}
	blocks := s.parseDocument(chunk.body)
	title := chunk.attributes["title"]
	switch chunk.directive {
	case "note", "hint", "warning", "important", "misconception":
		block := map[string]any{"type": "callout", "kind": chunk.directive, "blocks": blocks}
		if title != "" {
			block["title"] = title
		}
		return block, true
	case "details":
		summary := chunk.attributes["summary"]
		if summary == "" {
			summary = title
		}
		if summary == "" {
			summary = "Details"
		}
		block := map[string]any{"type": "details", "summary": []any{map[string]any{"type": "text", "value": summary}}, "blocks": blocks}
		if open, err := strconv.ParseBool(chunk.attributes["open"]); err == nil {
			block["open"] = open
		}
		return block, true
	case "tabs":
		label := title
		if label == "" {
			label = "Content"
		}
		return map[string]any{"type": "tabs", "tabs": []any{map[string]any{"id": "content", "label": label, "blocks": blocks}}}, true
	case "objectives":
		items := []any{}
		for _, line := range strings.Split(chunk.body, "\n") {
			line = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "-"))
			if line != "" {
				items = append(items, []any{map[string]any{"type": "text", "value": line}})
			}
		}
		return map[string]any{"type": "objectives", "title": title, "items": items}, true
	case "definition", "theorem", "worked-example":
		if title == "" {
			title = strings.ReplaceAll(strings.Title(strings.ReplaceAll(chunk.directive, "-", " ")), " ", " ")
		}
		return map[string]any{"type": chunk.directive, "title": title, "blocks": blocks}, true
	case "proof", "summary":
		block := map[string]any{"type": chunk.directive, "blocks": blocks}
		if title != "" {
			block["title"] = title
		}
		return block, true
	case "vocabulary":
		term := chunk.attributes["term"]
		if term == "" {
			term = title
		}
		return map[string]any{"type": "vocabulary", "items": []any{map[string]any{"term": []any{map[string]any{"type": "text", "value": term}}, "definition": blocks}}}, true
	case "compare":
		left := chunk.attributes["left"]
		right := chunk.attributes["right"]
		if left == "" {
			left = "A"
		}
		if right == "" {
			right = "B"
		}
		return map[string]any{"type": "compare", "title": title, "columns": []any{map[string]any{"title": left, "blocks": blocks}, map[string]any{"title": right, "blocks": []any{}}}}, true
	case "walkthrough":
		stepTitle := title
		if stepTitle == "" {
			stepTitle = "Step 1"
		}
		return map[string]any{"type": "walkthrough", "steps": []any{map[string]any{"title": stepTitle, "blocks": blocks}}}, true
	case "activity":
		id := chunk.attributes["id"]
		if id == "" {
			s.issue("ACTIVITY_CONFIG_INVALID", "activity directive requires id", "activity")
			return nil, false
		}
		if _, exists := s.activities[id]; exists {
			s.issue("ACTIVITY_EMBED_DUPLICATE", "activity is embedded more than once", id)
			return nil, false
		}
		s.activities[id] = struct{}{}
		return map[string]any{"type": "activity", "activityId": id}, true
	case "figure":
		source := chunk.attributes["source"]
		if !s.validateMediaPath(source) {
			return nil, false
		}
		alt := chunk.attributes["alt"]
		if alt == "" {
			s.issue("DOCUMENT_ASSET_INVALID", "figure alt text is required", source)
			return nil, false
		}
		block := map[string]any{"type": "figure", "source": source, "alt": alt}
		if strings.TrimSpace(chunk.body) != "" {
			block["caption"] = []any{map[string]any{"type": "text", "value": strings.TrimSpace(chunk.body)}}
		}
		if credit := chunk.attributes["credit"]; credit != "" {
			block["credit"] = credit
		}
		return block, true
	case "audio", "video":
		source := chunk.attributes["source"]
		if !s.validateMediaPath(source) {
			return nil, false
		}
		if len(blocks) == 0 {
			s.issue("DOCUMENT_MEDIA_TRANSCRIPT_REQUIRED", "audio and video require a transcript", source)
			return nil, false
		}
		block := map[string]any{"type": chunk.directive, "source": source, "title": title, "transcript": blocks}
		if chunk.directive == "video" {
			if captions := chunk.attributes["captions"]; captions != "" && s.validateMediaPath(captions) {
				block["captions"] = captions
			}
			if poster := chunk.attributes["poster"]; poster != "" && s.validateMediaPath(poster) {
				block["poster"] = poster
			}
		}
		return block, true
	case "attachment":
		source := chunk.attributes["source"]
		if !s.validateMediaPath(source) {
			return nil, false
		}
		label := chunk.attributes["label"]
		if label == "" {
			label = title
		}
		if label == "" {
			label = source
		}
		block := map[string]any{"type": "attachment", "source": source, "label": label}
		if strings.TrimSpace(chunk.body) != "" {
			block["description"] = []any{map[string]any{"type": "text", "value": strings.TrimSpace(chunk.body)}}
		}
		return block, true
	}
	return nil, false
}
