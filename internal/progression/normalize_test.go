package progression

import (
	"errors"
	"testing"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

func linearManifest() contracts.CourseManifest {
	return contracts.CourseManifest{
		SchemaVersion: contracts.CourseManifestSchemaVersionA10,
		Id:            contracts.Id("runtime-course"),
		Title:         "Runtime Course",
		Description:   "Runtime fundamentals",
		Version:       "1.0.0",
		Language:      "vi",
		Lessons: []contracts.LinearLessonReference{
			{Id: contracts.Id("main-thread"), Position: 1, Path: contracts.SafePath("lessons/01-main-thread")},
			{Id: contracts.Id("event-loop"), Position: 2, Path: contracts.SafePath("lessons/02-event-loop")},
		},
	}
}

func chapterManifest() contracts.CourseManifest {
	return contracts.CourseManifest{
		SchemaVersion: contracts.CourseManifestSchemaVersionA110,
		Id:            contracts.Id("runtime-course"),
		Title:         "Runtime Course",
		Description:   "Runtime fundamentals",
		Version:       "1.0.0",
		Language:      "vi",
		Chapters: []contracts.Chapter{
			{
				Id:       contracts.Id("runtime"),
				Title:    "Runtime",
				Required: true,
				Lessons: []contracts.ChapterLessonReference{
					{Id: contracts.Id("main-thread"), Required: true},
					{Id: contracts.Id("event-loop"), Required: true},
					{Id: contracts.Id("deep-dive"), Required: false},
				},
				Assessments: []contracts.ChapterAssessment{
					{
						Id:              contracts.Id("runtime-capstone"),
						Title:           "Runtime Capstone",
						Required:        true,
						Path:            contracts.SafePath("assessments/runtime-capstone"),
						RequiresLessons: []contracts.Id{contracts.Id("main-thread"), contracts.Id("event-loop")},
						Completion:      map[string]any{"type": "all-required-checks"},
					},
					{
						Id:              contracts.Id("advanced-capstone"),
						Title:           "Advanced Capstone",
						Required:        false,
						Path:            contracts.SafePath("assessments/advanced-capstone"),
						RequiresLessons: []contracts.Id{contracts.Id("deep-dive")},
						Completion:      map[string]any{"type": "minimum-score", "threshold": 0.8},
					},
				},
			},
		},
	}
}

func lessonDefinitions() []LessonDefinition {
	return []LessonDefinition{
		{ID: "main-thread", Position: 1, ReadingRequired: true},
		{ID: "event-loop", Position: 2, ReadingRequired: true},
		{ID: "deep-dive", Position: 3, ReadingRequired: true},
	}
}

func TestNormalizeLinearCourseCreatesImplicitChapter(t *testing.T) {
	graph, err := NormalizeCourse(linearManifest(), lessonDefinitions()[:2])
	if err != nil {
		t.Fatal(err)
	}
	if len(graph.Chapters) != 1 {
		t.Fatalf("chapters=%d", len(graph.Chapters))
	}
	chapter := graph.Chapters[0]
	if chapter.ID != "default" || chapter.Title != "Runtime Course" {
		t.Fatalf("chapter=%+v", chapter)
	}
	got := chapter.RequiredLessonIDs()
	want := []string{"main-thread", "event-loop"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("required lessons=%v", got)
	}
}

func TestNormalizeHierarchicalCoursePreservesOptionalItems(t *testing.T) {
	graph, err := NormalizeCourse(chapterManifest(), lessonDefinitions())
	if err != nil {
		t.Fatal(err)
	}
	chapter := graph.Chapters[0]
	if chapter.Lessons[2].Required {
		t.Fatal("deep-dive should be optional")
	}
	if chapter.Assessments[1].Required {
		t.Fatal("advanced-capstone should be optional")
	}
	if chapter.Assessments[1].Rule.Type != CompletionMinimumScore || chapter.Assessments[1].Rule.Threshold != 0.8 {
		t.Fatalf("rule=%+v", chapter.Assessments[1].Rule)
	}
}

func TestNormalizeRejectsUnknownLessonMembership(t *testing.T) {
	_, err := NormalizeCourse(chapterManifest(), lessonDefinitions()[:2])
	if !errors.Is(err, ErrInvalidCourseGraph) {
		t.Fatalf("expected invalid graph, got %v", err)
	}
}

func TestNormalizeRejectsDuplicateLessonMembership(t *testing.T) {
	manifest := chapterManifest()
	manifest.Chapters = append(manifest.Chapters, contracts.Chapter{
		Id:       contracts.Id("second"),
		Title:    "Second",
		Required: true,
		Lessons: []contracts.ChapterLessonReference{
			{Id: contracts.Id("main-thread"), Required: true},
		},
		Assessments: []contracts.ChapterAssessment{},
	})
	_, err := NormalizeCourse(manifest, lessonDefinitions())
	if !errors.Is(err, ErrInvalidCourseGraph) {
		t.Fatalf("expected invalid graph, got %v", err)
	}
}
