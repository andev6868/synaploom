package progression

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var ErrRequirementUnsatisfied = errors.New("required lesson work is not satisfied")

type MutationResult struct{ Evaluation Evaluation }

type ServiceImpl struct {
	db    *sql.DB
	store Store
	graph CourseGraph
	now   func() time.Time
}

func NewService(db *sql.DB, store Store, graph CourseGraph) *ServiceImpl {
	return &ServiceImpl{db: db, store: store, graph: graph, now: func() time.Time { return time.Now().UTC() }}
}

func (s *ServiceImpl) Initialize(ctx context.Context) (MutationResult, error) {
	return s.mutate(ctx, func(tx *sql.Tx) error { return s.store.Initialize(ctx, tx, s.graph) })
}

func (s *ServiceImpl) AcknowledgeReading(ctx context.Context, lessonID string) (MutationResult, error) {
	if _, ok := s.graph.LessonIndex[lessonID]; !ok {
		return MutationResult{}, &UnknownItemError{ItemID: lessonID}
	}
	return s.mutate(ctx, func(tx *sql.Tx) error {
		return s.store.AcknowledgeReading(ctx, tx, LessonKey{CourseID: s.graph.ID, Version: s.graph.Version, LessonID: lessonID}, s.now())
	})
}

func (s *ServiceImpl) RecordLessonPracticeResult(ctx context.Context, lessonID, practiceID string, result AttemptResult) (MutationResult, error) {
	lesson, ok := s.graph.LessonIndex[lessonID]
	if !ok {
		return MutationResult{}, &UnknownItemError{ItemID: lessonID}
	}
	found := false
	for _, practice := range lesson.Practices {
		if practice.ID == practiceID {
			found = true
			break
		}
	}
	if !found {
		return MutationResult{}, &UnknownItemError{ItemID: practiceID}
	}
	return s.mutate(ctx, func(tx *sql.Tx) error {
		return s.store.RecordPracticeAttempt(ctx, tx, CoursePracticeKey{CourseID: s.graph.ID, Version: s.graph.Version, LessonID: lessonID, PracticeID: practiceID}, result)
	})
}

func (s *ServiceImpl) RecordChapterAssessmentResult(ctx context.Context, chapterID, assessmentID string, result AttemptResult) (MutationResult, error) {
	found := false
	for _, chapter := range s.graph.Chapters {
		if chapter.ID != chapterID {
			continue
		}
		for _, assessment := range chapter.Assessments {
			if assessment.ID == assessmentID {
				found = true
				break
			}
		}
	}
	if !found {
		return MutationResult{}, &UnknownItemError{ItemID: assessmentID}
	}
	return s.mutate(ctx, func(tx *sql.Tx) error {
		return s.store.RecordAssessmentAttempt(ctx, tx, CourseAssessmentKey{CourseID: s.graph.ID, Version: s.graph.Version, ChapterID: chapterID, AssessmentID: assessmentID}, result)
	})
}

// CompleteLesson is a compatibility check. Completion remains derived from requirements.
func (s *ServiceImpl) CompleteLesson(ctx context.Context, lessonID string) (MutationResult, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return MutationResult{}, err
	}
	defer tx.Rollback()
	snapshot, err := s.store.Snapshot(ctx, tx, s.graph.ID, s.graph.Version)
	if err != nil {
		return MutationResult{}, err
	}
	lesson, err := EvaluateLesson(s.graph, snapshot, lessonID)
	if err != nil {
		return MutationResult{}, err
	}
	if !lesson.Complete {
		return MutationResult{}, ErrRequirementUnsatisfied
	}
	evaluation := Evaluate(s.graph, snapshot)
	if err := s.store.ApplyEvaluation(ctx, tx, s.graph.ID, s.graph.Version, evaluation); err != nil {
		return MutationResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return MutationResult{}, err
	}
	return MutationResult{Evaluation: evaluation}, nil
}

func (s *ServiceImpl) Snapshot(ctx context.Context) (ProgressSnapshot, error) {
	return s.store.Snapshot(ctx, s.db, s.graph.ID, s.graph.Version)
}

func (s *ServiceImpl) mutate(ctx context.Context, fn func(*sql.Tx) error) (MutationResult, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return MutationResult{}, err
	}
	defer tx.Rollback()
	if err := fn(tx); err != nil {
		return MutationResult{}, err
	}
	snapshot, err := s.store.Snapshot(ctx, tx, s.graph.ID, s.graph.Version)
	if err != nil {
		return MutationResult{}, err
	}
	evaluation := Evaluate(s.graph, snapshot)
	if err := s.store.ApplyEvaluation(ctx, tx, s.graph.ID, s.graph.Version, evaluation); err != nil {
		return MutationResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return MutationResult{}, err
	}
	return MutationResult{Evaluation: evaluation}, nil
}

// LessonView combines derived lesson progress with review-aware navigation context.
type LessonView struct {
	Lesson     LessonEvaluation
	Navigation LearningNavigation
}

// ChapterAssessmentView is the read model for one chapter assessment.
type ChapterAssessmentView struct {
	Assessment   Assessment
	Status       Status
	Requirements []RequirementView
	LatestResult *AttemptResult
	BestResult   *AttemptResult
	Navigation   LearningNavigation
}

// Navigation returns a side-effect-free navigation projection for the viewed item.
func (s *ServiceImpl) Navigation(ctx context.Context, viewed ItemRef) (LearningNavigation, error) {
	snapshot, err := s.store.Snapshot(ctx, s.db, s.graph.ID, s.graph.Version)
	if err != nil {
		return LearningNavigation{}, err
	}
	return BuildNavigation(s.graph, Evaluate(s.graph, snapshot), viewed)
}

// LessonView returns a side-effect-free lesson progress projection.
func (s *ServiceImpl) LessonView(ctx context.Context, lessonID string) (LessonView, error) {
	snapshot, err := s.store.Snapshot(ctx, s.db, s.graph.ID, s.graph.Version)
	if err != nil {
		return LessonView{}, err
	}
	evaluation := Evaluate(s.graph, snapshot)
	navigation, err := BuildNavigation(s.graph, evaluation, ItemRef{Kind: ItemLesson, ID: lessonID, ChapterID: s.graph.LessonIndex[lessonID].ChapterID})
	if err != nil {
		return LessonView{}, err
	}
	lesson, ok := evaluation.Lessons[lessonID]
	if !ok {
		return LessonView{}, &UnknownItemError{ItemID: lessonID}
	}
	return LessonView{Lesson: lesson, Navigation: navigation}, nil
}

// ChapterAssessment returns one side-effect-free assessment projection.
func (s *ServiceImpl) ChapterAssessment(ctx context.Context, chapterID, assessmentID string) (ChapterAssessmentView, error) {
	snapshot, err := s.store.Snapshot(ctx, s.db, s.graph.ID, s.graph.Version)
	if err != nil {
		return ChapterAssessmentView{}, err
	}
	evaluation := Evaluate(s.graph, snapshot)
	var assessment *Assessment
	for chapterIndex := range s.graph.Chapters {
		chapter := &s.graph.Chapters[chapterIndex]
		if chapter.ID != chapterID {
			continue
		}
		for assessmentIndex := range chapter.Assessments {
			if chapter.Assessments[assessmentIndex].ID == assessmentID {
				assessment = &chapter.Assessments[assessmentIndex]
				break
			}
		}
	}
	if assessment == nil {
		return ChapterAssessmentView{}, &UnknownItemError{ItemID: assessmentID}
	}
	navigation, err := BuildNavigation(s.graph, evaluation, ItemRef{Kind: ItemChapterAssessment, ID: assessmentID, ChapterID: chapterID})
	if err != nil {
		return ChapterAssessmentView{}, err
	}
	chapterEvaluation := evaluation.Chapters[chapterID]
	status := StatusLocked
	var requirements []RequirementView
	for _, requirement := range chapterEvaluation.Requirements {
		if requirement.Kind == "assessment" && requirement.ID == assessmentID {
			requirements = append(requirements, requirement)
			if requirement.Satisfied {
				status = StatusCompleted
			} else if chapterEvaluation.Status == StatusAssessmentRequired {
				status = StatusAvailable
			}
		}
	}
	progress := snapshot.Assessments[AssessmentKey{ChapterID: chapterID, AssessmentID: assessmentID}]
	return ChapterAssessmentView{Assessment: *assessment, Status: status, Requirements: requirements, LatestResult: progress.LatestResult, BestResult: progress.BestResult, Navigation: navigation}, nil
}

func (s *ServiceImpl) CourseID() string { return s.graph.ID }
func (s *ServiceImpl) LessonChapter(lessonID string) (string, bool) {
	lesson, ok := s.graph.LessonIndex[lessonID]
	return lesson.ChapterID, ok
}
