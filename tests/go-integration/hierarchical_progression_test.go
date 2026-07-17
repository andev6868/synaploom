package gointegration

import (
  "context"
  "path/filepath"
  "testing"
  "time"

  "github.com/synaploom/synaploom/internal/progression"
  "github.com/synaploom/synaploom/internal/storage"
)

func TestHierarchicalProgressionPersistsBestResultAndReviewState(t *testing.T) {
  ctx := context.Background()
  dbPath := filepath.Join(t.TempDir(), "progress.db")
  graph := progression.CourseGraph{ID: "course", Version: "1.1.0"}
  reading := progression.LessonRef{ID: "reading", ChapterID: "runtime", Position: 1, Required: true, ReadingRequired: true}
  mixed := progression.LessonRef{ID: "mixed", ChapterID: "runtime", Position: 2, Required: true, ReadingRequired: true, Practices: []progression.Practice{{ID: "check", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}}
  next := progression.LessonRef{ID: "next", ChapterID: "rendering", Position: 1, Required: true, ReadingRequired: true}
  graph.Chapters = []progression.Chapter{
    {ID: "runtime", Position: 1, Required: true, Lessons: []progression.LessonRef{reading, mixed}, Assessments: []progression.Assessment{{ID: "capstone", ChapterID: "runtime", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}},
    {ID: "rendering", Position: 2, Required: true, Lessons: []progression.LessonRef{next}},
  }
  graph.LessonIndex = map[string]progression.LessonRef{"reading": reading, "mixed": mixed, "next": next}

  db, err := storage.Open(ctx, dbPath)
  if err != nil { t.Fatal(err) }
  service := progression.NewService(db.SQL, storage.NewHierarchicalProgressRepository(), graph)
  if _, err := service.Initialize(ctx); err != nil { t.Fatal(err) }
  _, _ = service.AcknowledgeReading(ctx, "reading")
  _, _ = service.AcknowledgeReading(ctx, "mixed")
  _, _ = service.RecordLessonPracticeResult(ctx, "mixed", "check", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(1, 0)})
  _, _ = service.RecordChapterAssessmentResult(ctx, "runtime", "capstone", progression.AttemptResult{Passed: true, CompletedAt: time.Unix(2, 0)})
  if err := db.Close(); err != nil { t.Fatal(err) }

  db, err = storage.Open(ctx, dbPath)
  if err != nil { t.Fatal(err) }
  defer db.Close()
  service = progression.NewService(db.SQL, storage.NewHierarchicalProgressRepository(), graph)
  if _, err := service.Initialize(ctx); err != nil { t.Fatal(err) }
  result, err := service.RecordLessonPracticeResult(ctx, "mixed", "check", progression.AttemptResult{Passed: false, CompletedAt: time.Unix(3, 0)})
  if err != nil { t.Fatal(err) }
  if result.Evaluation.CurrentLessonID != "next" { t.Fatalf("current lesson regressed to %q", result.Evaluation.CurrentLessonID) }
  if result.Evaluation.Lessons["mixed"].Status != progression.StatusCompleted { t.Fatal("best passing result was revoked") }
  nav, err := service.Navigation(ctx, progression.ItemRef{Kind: progression.ItemLesson, ID: "mixed", ChapterID: "runtime"})
  if err != nil { t.Fatal(err) }
  if nav.ViewMode != progression.ViewModeReview { t.Fatalf("view mode=%q", nav.ViewMode) }
}
