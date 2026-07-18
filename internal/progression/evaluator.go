package progression

import "time"

type Status string

const (
	StatusLocked             Status = "LOCKED"
	StatusAvailable          Status = "AVAILABLE"
	StatusInProgress         Status = "IN_PROGRESS"
	StatusAssessmentRequired Status = "ASSESSMENT_REQUIRED"
	StatusCompleted          Status = "COMPLETED"
)

type PracticeKey struct{ LessonID, PracticeID string }
type AssessmentKey struct{ ChapterID, AssessmentID string }
type ActivitySetKey struct{ OwnerKind, OwnerID, SetID string }

type AttemptResult struct {
	Passed      bool
	Score       *float64
	CompletedAt time.Time
	Summary     string
}

type PracticeProgress struct{ BestResult, LatestResult *AttemptResult }
type ActivitySetProgress struct {
	Status                      string
	CompletedRequiredActivities int
	RequiredActivities          int
	Score                       *float64
	MaxScore                    *float64
	Passed                      *bool
}
type LessonProgress struct {
	ReadingCompleted bool
	Status           Status
}
type ChapterProgress struct{ Status Status }
type CourseProgress struct {
	Status          Status
	CurrentLessonID string
}

type ProgressSnapshot struct {
	Course       CourseProgress
	Chapters     map[string]ChapterProgress
	Lessons      map[string]LessonProgress
	Practices    map[PracticeKey]PracticeProgress
	Assessments  map[AssessmentKey]PracticeProgress
	ActivitySets map[ActivitySetKey]ActivitySetProgress
}

type RequirementView struct {
	ID, Kind            string
	Required, Satisfied bool
	Attempted           bool
	LatestPassed        *bool
}
type LessonEvaluation struct {
	LessonID     string
	Status       Status
	Complete     bool
	Requirements []RequirementView
}
type ChapterEvaluation struct {
	ChapterID    string
	Status       Status
	Complete     bool
	Requirements []RequirementView
}
type Evaluation struct {
	CourseStatus    Status
	Lessons         map[string]LessonEvaluation
	Chapters        map[string]ChapterEvaluation
	CurrentLessonID string
}

func practiceSatisfied(progress PracticeProgress, rule CompletionRule) bool {
	if progress.BestResult == nil || !progress.BestResult.Passed {
		return false
	}
	if rule.Type == CompletionMinimumScore {
		return progress.BestResult.Score != nil && *progress.BestResult.Score >= rule.Threshold
	}
	return true
}

func EvaluateLesson(graph CourseGraph, snapshot ProgressSnapshot, lessonID string) (LessonEvaluation, error) {
	lesson, ok := graph.LessonIndex[lessonID]
	if !ok {
		return LessonEvaluation{}, &UnknownItemError{ItemID: lessonID}
	}
	reqs := make([]RequirementView, 0, 1+len(lesson.Practices))
	complete := true
	if lesson.ReadingRequired {
		satisfied := snapshot.Lessons[lesson.ID].ReadingCompleted
		reqs = append(reqs, RequirementView{ID: "reading", Kind: "reading", Required: true, Satisfied: satisfied})
		complete = complete && satisfied
	}
	for _, practice := range lesson.Practices {
		satisfied := practiceSatisfied(snapshot.Practices[PracticeKey{LessonID: lesson.ID, PracticeID: practice.ID}], practice.Rule)
		progress := snapshot.Practices[PracticeKey{LessonID: lesson.ID, PracticeID: practice.ID}]
		var latestPassed *bool
		if progress.LatestResult != nil {
			value := progress.LatestResult.Passed
			latestPassed = &value
		}
		reqs = append(reqs, RequirementView{ID: practice.ID, Kind: "practice", Required: practice.Required, Satisfied: satisfied, Attempted: progress.LatestResult != nil, LatestPassed: latestPassed})
		if practice.Required {
			complete = complete && satisfied
		}
	}
	for _, set := range lesson.ActivitySets {
		progress := snapshot.ActivitySets[ActivitySetKey{OwnerKind: "lesson", OwnerID: lesson.ID, SetID: set.ID}]
		satisfied := progress.Status == "COMPLETED" && progress.Passed != nil && *progress.Passed
		attempted := progress.Status != "" && progress.Status != "NOT_STARTED"
		reqs = append(reqs, RequirementView{ID: set.ID, Kind: "activity-set", Required: set.Required, Satisfied: satisfied, Attempted: attempted, LatestPassed: progress.Passed})
		if set.Required {
			complete = complete && satisfied
		}
	}
	status := snapshot.Lessons[lesson.ID].Status
	if complete {
		status = StatusCompleted
	} else if status == "" {
		status = StatusLocked
	}
	return LessonEvaluation{LessonID: lesson.ID, Status: status, Complete: complete, Requirements: reqs}, nil
}

func Evaluate(graph CourseGraph, snapshot ProgressSnapshot) Evaluation {
	out := Evaluation{CourseStatus: StatusInProgress, Lessons: map[string]LessonEvaluation{}, Chapters: map[string]ChapterEvaluation{}}
	previousRequiredChapterComplete := true
	for _, chapter := range graph.Chapters {
		chapterAvailable := !chapter.Required || previousRequiredChapterComplete
		allRequiredLessons := true
		previousRequiredLessonComplete := true
		creqs := []RequirementView{}
		for _, lesson := range chapter.Lessons {
			le, _ := EvaluateLesson(graph, snapshot, lesson.ID)
			available := chapterAvailable && (!lesson.Required || previousRequiredLessonComplete)
			if le.Complete {
				le.Status = StatusCompleted
			} else if available {
				le.Status = StatusAvailable
			} else {
				le.Status = StatusLocked
			}
			out.Lessons[lesson.ID] = le
			creqs = append(creqs, RequirementView{ID: lesson.ID, Kind: "lesson", Required: lesson.Required, Satisfied: le.Complete})
			if lesson.Required {
				allRequiredLessons = allRequiredLessons && le.Complete
				previousRequiredLessonComplete = previousRequiredLessonComplete && le.Complete
			}
			if out.CurrentLessonID == "" && lesson.Required && le.Status == StatusAvailable {
				out.CurrentLessonID = lesson.ID
			}
		}
		allRequiredAssessments := true
		for _, assessment := range chapter.Assessments {
			satisfied, attempted, latestPassed := evaluateAssessmentRequirement(snapshot, chapter.ID, assessment)
			creqs = append(creqs, RequirementView{ID: assessment.ID, Kind: "assessment", Required: assessment.Required, Satisfied: satisfied, Attempted: attempted, LatestPassed: latestPassed})
			if assessment.Required {
				allRequiredAssessments = allRequiredAssessments && satisfied
			}
		}
		complete := allRequiredLessons && allRequiredAssessments
		status := StatusLocked
		if complete {
			status = StatusCompleted
		} else if chapterAvailable && allRequiredLessons && !allRequiredAssessments {
			status = StatusAssessmentRequired
		} else if chapterAvailable {
			status = StatusInProgress
		}
		out.Chapters[chapter.ID] = ChapterEvaluation{ChapterID: chapter.ID, Status: status, Complete: complete, Requirements: creqs}
		if chapter.Required {
			previousRequiredChapterComplete = previousRequiredChapterComplete && complete
		}
	}
	if previousRequiredChapterComplete {
		out.CourseStatus = StatusCompleted
	}
	if out.CurrentLessonID == "" {
		out.CurrentLessonID = snapshot.Course.CurrentLessonID
	}
	return out
}

func evaluateAssessmentRequirement(snapshot ProgressSnapshot, chapterID string, assessment Assessment) (bool, bool, *bool) {
	if assessment.ActivitySetID != "" {
		progress := snapshot.ActivitySets[ActivitySetKey{OwnerKind: "assessment", OwnerID: assessment.ID, SetID: assessment.ActivitySetID}]
		attempted := progress.Status != "" && progress.Status != "NOT_STARTED"
		satisfied := progress.Status == "COMPLETED" && progress.Passed != nil && *progress.Passed
		return satisfied, attempted, progress.Passed
	}
	progress := snapshot.Assessments[AssessmentKey{ChapterID: chapterID, AssessmentID: assessment.ID}]
	var latestPassed *bool
	if progress.LatestResult != nil {
		value := progress.LatestResult.Passed
		latestPassed = &value
	}
	return practiceSatisfied(progress, assessment.Rule), progress.LatestResult != nil, latestPassed
}
