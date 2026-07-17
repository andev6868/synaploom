package course

import (
	"context"
	"path/filepath"
	"testing"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

func TestFilesystemServiceTracksReadingAndSequentialCompletion(t *testing.T) {
	service, err := OpenFilesystemService(filepath.Join("..", "..", "examples", "frontend-performance-foundations"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	if _, err := service.CompleteLesson(ctx, "main-thread"); err != ErrReadingIncomplete {
		t.Fatalf("complete before reading err=%v", err)
	}
	if err := service.AcknowledgeReading(ctx, "main-thread"); err != nil {
		t.Fatal(err)
	}
	lesson, err := service.Lesson(ctx, "main-thread")
	if err != nil {
		t.Fatal(err)
	}
	if !lesson.ReadingAcknowledged || lesson.Status != contracts.LessonPayloadStatusINPROGRESS {
		t.Fatalf("lesson after acknowledge=%+v", lesson)
	}

	completion, err := service.CompleteLesson(ctx, "main-thread")
	if err != nil {
		t.Fatal(err)
	}
	if completion.CourseCompleted || completion.NextLessonID != "event-loop" {
		t.Fatalf("completion=%+v", completion)
	}
	coursePayload, err := service.Course(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if coursePayload.CurrentLessonId == nil || *coursePayload.CurrentLessonId != "event-loop" {
		t.Fatalf("current lesson=%v", coursePayload.CurrentLessonId)
	}
	if err := service.AcknowledgeReading(ctx, "main-thread"); err != ErrLessonLocked {
		t.Fatalf("completed old lesson acknowledge err=%v", err)
	}
}
