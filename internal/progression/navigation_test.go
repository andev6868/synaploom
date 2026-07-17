package progression

import "testing"

func TestReviewModeReturnsToCurrentLesson(t *testing.T) {
	g := evaluatorGraph()
	e := Evaluation{CourseStatus: StatusInProgress, CurrentLessonID: "l2", Lessons: map[string]LessonEvaluation{"l1": {LessonID: "l1", Status: StatusCompleted, Complete: true}, "l2": {LessonID: "l2", Status: StatusAvailable}}, Chapters: map[string]ChapterEvaluation{"c1": {ChapterID: "c1", Status: StatusInProgress}}}
	nav, err := BuildNavigation(g, e, ItemRef{Kind: ItemLesson, ID: "l1", ChapterID: "c1"})
	if err != nil {
		t.Fatal(err)
	}
	if nav.ViewMode != ViewModeReview {
		t.Fatalf("mode=%s", nav.ViewMode)
	}
	if nav.NextAction.Type != NextActionReturnToCurrent || nav.NextAction.Target.ID != "l2" {
		t.Fatalf("action=%+v", nav.NextAction)
	}
}

func TestNextActionPriorities(t *testing.T) {
	g := evaluatorGraph()
	tests := []struct {
		name string
		req  RequirementView
		want NextActionType
	}{
		{"reading", RequirementView{ID: "reading", Kind: "reading", Required: true}, NextActionAcknowledgeReading},
		{"practice start", RequirementView{ID: "p1", Kind: "practice", Required: true}, NextActionStartRequiredPractice},
		{"practice retry", RequirementView{ID: "p1", Kind: "practice", Required: true, Attempted: true}, NextActionRetryRequiredPractice},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := Evaluation{CurrentLessonID: "l1", Lessons: map[string]LessonEvaluation{"l1": {LessonID: "l1", Status: StatusAvailable, Requirements: []RequirementView{tt.req}}}, Chapters: map[string]ChapterEvaluation{"c1": {ChapterID: "c1", Status: StatusInProgress}}}
			got := NextActionFor(g, e, ItemRef{Kind: ItemLesson, ID: "l1", ChapterID: "c1"})
			if got.Type != tt.want {
				t.Fatalf("got %s want %s", got.Type, tt.want)
			}
		})
	}
}

func TestLockedLessonReturnsBlockingRequirements(t *testing.T) {
	g := evaluatorGraph()
	e := Evaluation{CurrentLessonID: "l1", Lessons: map[string]LessonEvaluation{"l1": {LessonID: "l1", Status: StatusAvailable}, "l2": {LessonID: "l2", Status: StatusLocked, Requirements: []RequirementView{{ID: "l1", Kind: "lesson", Required: true}}}}, Chapters: map[string]ChapterEvaluation{"c1": {ChapterID: "c1", Status: StatusInProgress}}}
	_, err := BuildNavigation(g, e, ItemRef{Kind: ItemLesson, ID: "l2", ChapterID: "c1"})
	locked, ok := err.(*ItemLockedError)
	if !ok {
		t.Fatalf("err=%T %v", err, err)
	}
	if len(locked.Blocking) != 1 {
		t.Fatalf("blocking=%v", locked.Blocking)
	}
}
