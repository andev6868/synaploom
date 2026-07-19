package course

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	generated "github.com/synaploom/synaploom/generated/go/contracts"
)

func lessonBlockAt(t *testing.T, document generated.LessonDocument, index int) map[string]any {
	t.Helper()
	block, ok := document.Blocks[index].(map[string]any)
	if !ok {
		t.Fatalf("block %d has type %T", index, document.Blocks[index])
	}
	return block
}

func TestParseLessonKeepsRawHTMLInertAndDropsDuplicateH1(t *testing.T) {
	document, err := ParseLesson([]byte("# Event Loop\n\n<script>alert(1)</script>\n\n## Details\n\nText"), LessonMetadata{ID: "event-loop", CourseID: "course", Position: 1, Title: "Event Loop", Type: generated.LessonDocumentTypeTheory})
	if err != nil {
		t.Fatal(err)
	}
	if len(document.Blocks) != 3 {
		t.Fatalf("blocks=%#v", document.Blocks)
	}
	first := lessonBlockAt(t, document, 0)
	if first["type"] != "paragraph" {
		t.Fatalf("first=%v", first)
	}
	children, _ := first["children"].([]any)
	if len(children) == 0 || !strings.Contains(children[0].(map[string]any)["value"].(string), "<script>") {
		t.Fatalf("first=%v", first)
	}
	for index := range document.Blocks {
		if lessonBlockAt(t, document, index)["type"] == "html" {
			t.Fatal("executable html block emitted")
		}
	}
}

func TestParseLessonDocumentSupportsRichMarkdownAndDirectives(t *testing.T) {
	root := t.TempDir()
	lessonRoot := filepath.Join(root, "lessons", "rich")
	if err := os.MkdirAll(filepath.Join(lessonRoot, "media"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"figure.png", "audio.mp3", "video.mp4", "video.vtt"} {
		if err := os.WriteFile(filepath.Join(lessonRoot, "media", name), []byte("fixture"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	source := `# Rich Lesson

Paragraph with *emphasis*, **strong**, ~~strike~~, $a^2$, and [link](https://example.com).

- [x] Completed
  - Nested

| Name | Value |
| :--- | ---: |
| x | 1 |

$$
a^2+b^2=c^2
$$

:::definition title="Pythagoras"
A right triangle relation.
:::

:::activity id="question-1"
:::

:::figure source="media/figure.png" alt="Triangle" credit="Author"
Figure caption
:::
`
	document, issues := ParseLessonDocument(source, MarkdownParseOptions{
		CourseRoot: root,
		LessonRoot: lessonRoot,
		Strict:     true,
		Metadata:   LessonMetadata{ID: "rich", CourseID: "course", Position: 1, Title: "Rich Lesson", Type: generated.LessonDocumentTypeMixed},
	})
	if len(issues) != 0 {
		t.Fatalf("issues=%#v", issues)
	}
	kinds := map[string]bool{}
	for index := range document.Blocks {
		kinds[lessonBlockAt(t, document, index)["type"].(string)] = true
	}
	for _, kind := range []string{"paragraph", "list", "table", "math", "definition", "activity", "figure"} {
		if !kinds[kind] {
			t.Fatalf("missing %s in %#v", kind, document.Blocks)
		}
	}
}

func TestParseLessonDocumentReportsUnknownAndDuplicateActivityDirectives(t *testing.T) {
	_, issues := ParseLessonDocument(":::unknown\nbody\n:::\n\n:::activity id=one\n:::\n:::activity id=one\n:::\n", MarkdownParseOptions{})
	codes := map[string]bool{}
	for _, issue := range issues {
		codes[issue.Code] = true
	}
	if !codes["DOCUMENT_DIRECTIVE_UNKNOWN"] || !codes["ACTIVITY_EMBED_DUPLICATE"] {
		t.Fatalf("issues=%#v", issues)
	}
}

func TestValidateAssetPathRejectsTraversal(t *testing.T) {
	if ValidateAssetPath("../secret") == nil {
		t.Fatal("expected traversal rejection")
	}
}

func TestMarkdownGoldenOutputIsStable(t *testing.T) {
	source, err := os.ReadFile(filepath.Join("testdata", "markdown", "standard.md"))
	if err != nil {
		t.Fatal(err)
	}
	document, issues := ParseLessonDocument(string(source), MarkdownParseOptions{Metadata: LessonMetadata{ID: "standard", CourseID: "course", Position: 1, Title: "Standard", Type: generated.LessonDocumentTypeTheory}})
	if len(issues) != 0 {
		t.Fatalf("issues=%#v", issues)
	}
	actual, err := json.MarshalIndent(document.Blocks, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	actual = append(actual, '\n')
	goldenPath := filepath.Join("testdata", "markdown", "standard.golden.json")
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(goldenPath, actual, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	expected, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(actual) != string(expected) {
		t.Fatalf("golden mismatch\nactual:\n%s\nexpected:\n%s", actual, expected)
	}
}

func TestParseLessonDocumentKeepsInlineMathBalancedAcrossAdjacentTextNodes(t *testing.T) {
	document, issues := ParseLessonDocument(`:::worked-example title="Giải từng bước"
$2x = 8$, vì vậy $x = 4$.
:::
`, MarkdownParseOptions{Metadata: LessonMetadata{ID: "math", CourseID: "course", Position: 1, Title: "Math", Type: generated.LessonDocumentTypeMixed}})
	if len(issues) != 0 {
		t.Fatalf("issues=%#v", issues)
	}
	block := lessonBlockAt(t, document, 0)
	blocks, ok := block["blocks"].([]any)
	if !ok || len(blocks) != 1 {
		t.Fatalf("block=%#v", block)
	}
	paragraph := blocks[0].(map[string]any)
	children := paragraph["children"].([]any)
	math := []string{}
	for _, raw := range children {
		node := raw.(map[string]any)
		if node["type"] == "math" {
			math = append(math, node["source"].(string))
		}
	}
	if len(math) != 2 || math[0] != "2x = 8" || math[1] != "x = 4" {
		t.Fatalf("children=%#v", children)
	}
}

func TestParseLessonDocumentHumanizesDirectiveTitle(t *testing.T) {
	document, issues := ParseLessonDocument(":::worked-example\nExample body.\n:::\n", MarkdownParseOptions{Metadata: LessonMetadata{ID: "example", CourseID: "course", Position: 1, Title: "Example", Type: generated.LessonDocumentTypeMixed}})
	if len(issues) != 0 {
		t.Fatalf("issues=%#v", issues)
	}
	block := lessonBlockAt(t, document, 0)
	if got := block["title"]; got != "Worked Example" {
		t.Fatalf("title=%v, want Worked Example", got)
	}
}
