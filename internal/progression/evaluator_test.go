package progression

import (
	"testing"
	"time"
)

func score(v float64) *float64 { return &v }
func passedAttempt() *AttemptResult {
	return &AttemptResult{Passed: true, CompletedAt: time.Unix(1, 0)}
}

func evaluatorGraph() CourseGraph {
	l1 := LessonRef{ID: "l1", ChapterID: "c1", Position: 1, Required: true, ReadingRequired: true, Practices: []Practice{{ID: "p1", Required: true, Rule: CompletionRule{Type: CompletionAllRequiredChecks}}}}
	l2 := LessonRef{ID: "l2", ChapterID: "c1", Position: 2, Required: true, ReadingRequired: true}
	l3 := LessonRef{ID: "l3", ChapterID: "c2", Position: 1, Required: true, ReadingRequired: true}
	return CourseGraph{
		ID: "course",
		Chapters: []Chapter{
			{ID: "c1", Position: 1, Required: true, Lessons: []LessonRef{l1, l2}, Assessments: []Assessment{{ID: "a1", ChapterID: "c1", Required: true, Rule: CompletionRule{Type: CompletionAllRequiredChecks}}}},
			{ID: "c2", Position: 2, Required: true, Lessons: []LessonRef{l3}},
		},
		LessonIndex: map[string]LessonRef{"l1": l1, "l2": l2, "l3": l3},
	}
}

func TestEvaluateLessonCompletion(t *testing.T) {
	g := evaluatorGraph()
	s := ProgressSnapshot{Lessons: map[string]LessonProgress{"l1": {ReadingCompleted: true}}, Practices: map[PracticeKey]PracticeProgress{}, Assessments: map[AssessmentKey]PracticeProgress{}}
	le, err := EvaluateLesson(g, s, "l1")
	if err != nil {
		t.Fatal(err)
	}
	if le.Complete {
		t.Fatal("expected required practice to block completion")
	}
	s.Practices[PracticeKey{LessonID: "l1", PracticeID: "p1"}] = PracticeProgress{BestResult: passedAttempt(), LatestResult: &AttemptResult{Passed: false}}
	le, err = EvaluateLesson(g, s, "l1")
	if err != nil {
		t.Fatal(err)
	}
	if !le.Complete {
		t.Fatal("expected best pass to satisfy lesson")
	}
}

func TestChapterEntersAssessmentRequired(t *testing.T) {
	g := evaluatorGraph()
	s := ProgressSnapshot{
		Lessons:     map[string]LessonProgress{"l1": {ReadingCompleted: true}, "l2": {ReadingCompleted: true}},
		Practices:   map[PracticeKey]PracticeProgress{{LessonID: "l1", PracticeID: "p1"}: {BestResult: passedAttempt()}},
		Assessments: map[AssessmentKey]PracticeProgress{},
	}
	e := Evaluate(g, s)
	if got := e.Chapters["c1"].Status; got != StatusAssessmentRequired {
		t.Fatalf("c1 status = %s", got)
	}
	if got := e.Chapters["c2"].Status; got != StatusLocked {
		t.Fatalf("c2 status = %s", got)
	}
	s.Assessments[AssessmentKey{ChapterID: "c1", AssessmentID: "a1"}] = PracticeProgress{BestResult: passedAttempt()}
	e = Evaluate(g, s)
	if got := e.Chapters["c1"].Status; got != StatusCompleted {
		t.Fatalf("c1 status = %s", got)
	}
	if got := e.Chapters["c2"].Status; got != StatusInProgress {
		t.Fatalf("c2 status = %s", got)
	}
	if e.CurrentLessonID != "l3" {
		t.Fatalf("current lesson = %q", e.CurrentLessonID)
	}
}

func TestMinimumScoreUsesBestResult(t *testing.T) {
	lesson := LessonRef{ID: "l", Required: true, Practices: []Practice{{ID: "p", Required: true, Rule: CompletionRule{Type: CompletionMinimumScore, Threshold: .8}}}}
	g := CourseGraph{LessonIndex: map[string]LessonRef{"l": lesson}}
	s := ProgressSnapshot{Lessons: map[string]LessonProgress{}, Practices: map[PracticeKey]PracticeProgress{{LessonID: "l", PracticeID: "p"}: {BestResult: &AttemptResult{Passed: true, Score: score(.9)}, LatestResult: &AttemptResult{Passed: false, Score: score(.2)}}}}
	le, err := EvaluateLesson(g, s, "l")
	if err != nil {
		t.Fatal(err)
	}
	if !le.Complete {
		t.Fatal("later failed attempt revoked best pass")
	}
}
