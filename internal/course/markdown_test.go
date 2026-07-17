package course

import (
	generated "github.com/synaploom/synaploom/generated/go/contracts"
	"strings"
	"testing"
)

func TestParseLessonKeepsRawHTMLInertAndDropsDuplicateH1(t *testing.T) {
	document, err := ParseLesson([]byte("# Event Loop\n\n<script>alert(1)</script>\n\n## Details\n\nText"), LessonMetadata{ID: "event-loop", CourseID: "course", Position: 1, Title: "Event Loop", Type: generated.LessonDocumentTypeTheory})
	if err != nil {
		t.Fatal(err)
	}
	if len(document.Blocks) != 3 {
		t.Fatalf("blocks=%#v", document.Blocks)
	}
	if document.Blocks[0].Type != "paragraph" {
		t.Fatalf("first=%s", document.Blocks[0].Type)
	}
	props, _ := document.Blocks[0].AdditionalProperties.(map[string]any)
	if !strings.Contains(props["text"].(string), "<script>") {
		t.Fatalf("props=%v", props)
	}
	for _, b := range document.Blocks {
		if b.Type == "html" {
			t.Fatal("executable html block emitted")
		}
	}
}

func TestValidateAssetPathRejectsTraversal(t *testing.T) {
	if ValidateAssetPath("../secret") == nil {
		t.Fatal("expected traversal rejection")
	}
}
