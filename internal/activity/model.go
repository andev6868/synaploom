package activity

import (
	"context"
	"encoding/json"
	"time"
)

type OwnerKind string

const (
	OwnerKindLesson     OwnerKind = "lesson"
	OwnerKindAssessment OwnerKind = "assessment"
)

type OwnerIdentity struct {
	CourseID      string
	CourseVersion string
	Kind          OwnerKind
	ID            string
}

type AttemptIdentity struct {
	Owner      OwnerIdentity
	ActivityID string
}

type ActivityKind string

const (
	ActivityKindSingleChoice   ActivityKind = "single-choice"
	ActivityKindMultipleChoice ActivityKind = "multiple-choice"
	ActivityKindTrueFalse      ActivityKind = "true-false"
	ActivityKindShortAnswer    ActivityKind = "short-answer"
	ActivityKindFillBlanks     ActivityKind = "fill-blanks"
	ActivityKindOrdering       ActivityKind = "ordering"
	ActivityKindMatching       ActivityKind = "matching"
	ActivityKindNumeric        ActivityKind = "numeric"
	ActivityKindWriting        ActivityKind = "writing"
	ActivityKindCoding         ActivityKind = "coding"
)

type EvaluationMode string

const (
	EvaluationModeAutomatic  EvaluationMode = "automatic"
	EvaluationModeSubmission EvaluationMode = "submission"
	EvaluationModeCoding     EvaluationMode = "coding"
)

type EvaluationPolicy struct {
	Mode   EvaluationMode `json:"mode"`
	Points float64        `json:"points"`
}

type CompletionPolicy struct {
	Required     bool     `json:"required"`
	PassingScore *float64 `json:"passingScore,omitempty"`
}

type FeedbackPolicy struct {
	ShowExplanation bool `json:"showExplanation,omitempty"`
}

type ActivityDefinition struct {
	ID         string           `json:"id"`
	Kind       ActivityKind     `json:"kind"`
	Title      string           `json:"title"`
	Prompt     map[string]any   `json:"prompt"`
	Config     map[string]any   `json:"config"`
	Evaluation EvaluationPolicy `json:"evaluation"`
	Completion CompletionPolicy `json:"completion"`
	Feedback   FeedbackPolicy   `json:"feedback,omitempty"`
}

type ActivityPurpose string

const (
	ActivityPurposePractice   ActivityPurpose = "practice"
	ActivityPurposeAssessment ActivityPurpose = "assessment"
)

type ActivitySetPolicy struct {
	Purpose       ActivityPurpose `json:"purpose"`
	MaxAttempts   *int            `json:"maxAttempts"`
	FeedbackMode  string          `json:"feedbackMode"`
	RevealAnswers string          `json:"revealAnswers"`
	Scoring       string          `json:"scoring"`
	PassingScore  *float64        `json:"passingScore"`
}

type ActivityReference struct {
	ID       string `json:"id"`
	Required bool   `json:"required"`
}

type ActivitySetDefinition struct {
	ID         string              `json:"id"`
	Title      string              `json:"title,omitempty"`
	Policy     ActivitySetPolicy   `json:"policy"`
	Activities []ActivityReference `json:"activities"`
}

type Catalog interface {
	Activity(context.Context, OwnerIdentity, string) (ActivityDefinition, ActivitySetPolicy, error)
	ActivitySet(context.Context, OwnerIdentity, string) (ActivitySetDefinition, error)
}

type PublicActivityView struct {
	ID         string           `json:"id"`
	Kind       ActivityKind     `json:"kind"`
	Title      string           `json:"title"`
	Prompt     map[string]any   `json:"prompt"`
	Config     map[string]any   `json:"config"`
	Evaluation EvaluationPolicy `json:"evaluation"`
	Completion CompletionPolicy `json:"completion"`
	Feedback   *FeedbackPolicy  `json:"feedback,omitempty"`
}

type AttemptStatus string

const (
	AttemptStatusDraft     AttemptStatus = "DRAFT"
	AttemptStatusSubmitted AttemptStatus = "SUBMITTED"
	AttemptStatusEvaluated AttemptStatus = "EVALUATED"
)

type ActivityFeedbackItem struct {
	Code    string  `json:"code"`
	Message string  `json:"message"`
	Field   *string `json:"field,omitempty"`
}

type ActivityFeedback struct {
	Summary       string                 `json:"summary"`
	Details       []ActivityFeedbackItem `json:"details"`
	CorrectAnswer any                    `json:"correctAnswer,omitempty"`
	NextAction    string                 `json:"nextAction,omitempty"`
}

type ActivityAttempt struct {
	ID            string            `json:"id"`
	Owner         OwnerIdentity     `json:"owner"`
	ActivityID    string            `json:"activityId"`
	AttemptNumber int               `json:"attemptNumber"`
	Status        AttemptStatus     `json:"status"`
	Answer        json.RawMessage   `json:"answer"`
	Feedback      *ActivityFeedback `json:"feedback"`
	Score         *float64          `json:"score"`
	MaxScore      *float64          `json:"maxScore"`
	Passed        *bool             `json:"passed"`
	RandomSeed    int64             `json:"randomSeed"`
	Revision      int64             `json:"revision"`
	StartedAt     string            `json:"startedAt"`
	SubmittedAt   *string           `json:"submittedAt"`
	EvaluatedAt   *string           `json:"evaluatedAt"`
}

type SaveDraftCommand struct {
	Identity AttemptIdentity
	Answer   json.RawMessage
	Revision int64
	Seed     int64
	At       time.Time
}

type SubmitCommand struct {
	Identity       AttemptIdentity
	Answer         json.RawMessage
	IdempotencyKey string
	Seed           int64
	At             time.Time
}

type EvaluationResult struct {
	Score    float64
	MaxScore float64
	Passed   bool
	Feedback ActivityFeedback
}

type EvaluationEngine interface {
	Evaluate(context.Context, ActivityDefinition, json.RawMessage) (EvaluationResult, error)
}

type ActivityProgress struct {
	ActivityID string  `json:"activityId"`
	Required   bool    `json:"required"`
	Completed  bool    `json:"completed"`
	Passed     bool    `json:"passed"`
	Score      float64 `json:"score"`
	MaxScore   float64 `json:"maxScore"`
}

type ActivitySetProgress struct {
	SetID      string             `json:"setId"`
	Completed  bool               `json:"completed"`
	Passed     bool               `json:"passed"`
	Score      float64            `json:"score"`
	MaxScore   float64            `json:"maxScore"`
	Activities []ActivityProgress `json:"activities"`
}
