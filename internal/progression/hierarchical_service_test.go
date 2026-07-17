package progression_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/synaploom/synaploom/internal/progression"
	"github.com/synaploom/synaploom/internal/storage"
)

func newHierarchicalFixture(t *testing.T, graph progression.CourseGraph) (*progression.ServiceImpl, *storage.Database) {
	t.Helper()
	db, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "hierarchical.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	service := progression.NewService(db.SQL, storage.NewHierarchicalProgressRepository(), graph)
	if _, err := service.Initialize(context.Background()); err != nil {
		t.Fatal(err)
	}
	return service, db
}

func readingAndPracticeGraph() progression.CourseGraph {
	l1 := progression.LessonRef{ID: "reading", ChapterID: "c1", Position: 1, Required: true, ReadingRequired: true}
	l2 := progression.LessonRef{ID: "mixed", ChapterID: "c1", Position: 2, Required: true, ReadingRequired: true, Practices: []progression.Practice{{ID: "check", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}}
	l3 := progression.LessonRef{ID: "next", ChapterID: "c2", Position: 1, Required: true, ReadingRequired: true}
	return progression.CourseGraph{ID: "course", Version: "1", Chapters: []progression.Chapter{{ID: "c1", Position: 1, Required: true, Lessons: []progression.LessonRef{l1, l2}, Assessments: []progression.Assessment{{ID: "capstone", ChapterID: "c1", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}}, {ID: "c2", Position: 2, Required: true, Lessons: []progression.LessonRef{l3}}}, LessonIndex: map[string]progression.LessonRef{"reading": l1, "mixed": l2, "next": l3}}
}

func TestAcknowledgeReadingCompletesReadingOnlyLessonAndUnlocksNext(t *testing.T) {
	s, _ := newHierarchicalFixture(t, readingAndPracticeGraph())
	result, err := s.AcknowledgeReading(context.Background(), "reading")
	if err != nil {
		t.Fatal(err)
	}
	if result.Evaluation.Lessons["reading"].Status != progression.StatusCompleted {
		t.Fatal("reading lesson not completed")
	}
	if result.Evaluation.Lessons["mixed"].Status != progression.StatusAvailable {
		t.Fatal("next lesson not unlocked")
	}
}

func TestAcknowledgeReadingDoesNotCompleteLessonWithRequiredPractice(t *testing.T) {
	s, _ := newHierarchicalFixture(t, readingAndPracticeGraph())
	if _, err := s.AcknowledgeReading(context.Background(), "reading"); err != nil {
		t.Fatal(err)
	}
	result, err := s.AcknowledgeReading(context.Background(), "mixed")
	if err != nil {
		t.Fatal(err)
	}
	if result.Evaluation.Lessons["mixed"].Status == progression.StatusCompleted {
		t.Fatal("required practice was ignored")
	}
}

func TestPassingChapterAssessmentUnlocksNextChapter(t *testing.T) {
	s, _ := newHierarchicalFixture(t, readingAndPracticeGraph())
	_, _ = s.AcknowledgeReading(context.Background(), "reading")
	_, _ = s.AcknowledgeReading(context.Background(), "mixed")
	_, _ = s.RecordLessonPracticeResult(context.Background(), "mixed", "check", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(1, 0)})
	result, err := s.RecordChapterAssessmentResult(context.Background(), "c1", "capstone", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(2, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if result.Evaluation.Chapters["c1"].Status != progression.StatusCompleted {
		t.Fatal("chapter not completed")
	}
	if result.Evaluation.Lessons["next"].Status != progression.StatusAvailable {
		t.Fatal("next chapter lesson not unlocked")
	}
}

func TestFailedReviewAttemptDoesNotMoveCurrentLessonBackward(t *testing.T) {
	s, _ := newHierarchicalFixture(t, readingAndPracticeGraph())
	_, _ = s.AcknowledgeReading(context.Background(), "reading")
	_, _ = s.AcknowledgeReading(context.Background(), "mixed")
	_, _ = s.RecordLessonPracticeResult(context.Background(), "mixed", "check", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(1, 0)})
	_, _ = s.RecordChapterAssessmentResult(context.Background(), "c1", "capstone", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(2, 0)})
	result, err := s.RecordLessonPracticeResult(context.Background(), "mixed", "check", progression.AttemptResult{Passed: false, CompletedAt: time.Unix(3, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if result.Evaluation.CurrentLessonID != "next" {
		t.Fatalf("current lesson regressed to %q", result.Evaluation.CurrentLessonID)
	}
	if result.Evaluation.Lessons["mixed"].Status != progression.StatusCompleted {
		t.Fatal("best pass was revoked")
	}
}
