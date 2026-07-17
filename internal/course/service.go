// Package course contains course reading and import domain services.
package course

import (
	"context"
	"errors"

	"github.com/synaploom/synaploom/internal/runner"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

var (
	ErrCourseNotFound        = errors.New("course not found")
	ErrLessonNotFound        = errors.New("lesson not found")
	ErrLessonLocked          = errors.New("lesson locked")
	ErrReadingIncomplete     = errors.New("reading incomplete")
	ErrExerciseNotFound      = errors.New("exercise not found")
	ErrWorkspaceFileNotFound = errors.New("workspace file not found")
)

// Service exposes immutable course and lesson documents to the HTTP layer.
type Service interface {
	Course(context.Context) (contracts.CoursePayload, error)
	Lesson(context.Context, string) (contracts.LessonPayload, error)
}

// Completion describes the authoritative progression result after completing a lesson.
type Completion struct {
	CourseCompleted bool
	NextLessonID    string
	NextLessonTitle string
}

// ProgressService extends immutable course reading with learner progression mutations.
type ProgressService interface {
	Service
	AcknowledgeReading(context.Context, string) error
	CompleteLesson(context.Context, string) (Completion, error)
}

// PracticeService exposes the editable lesson workspace and trusted exercise actions.
type PracticeService interface {
	Service
	WorkspaceFiles(context.Context, string) ([]string, error)
	ReadWorkspaceFile(context.Context, string, string) ([]byte, error)
	WriteWorkspaceFile(context.Context, string, string, []byte) error
	ResetWorkspace(context.Context, string) error
	ResolveAction(context.Context, string, string) (runner.Action, error)
}

// ActionResultRecorder persists the authoritative outcome of a declared lesson action.
type ActionResultRecorder interface {
	RecordActionResult(context.Context, string, string, runner.Result) error
}
