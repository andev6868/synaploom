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
	if nav.ReturnTarget == nil || nav.ReturnTarget.ChapterID != "c1" {
		t.Fatalf("return target=%+v", nav.ReturnTarget)
	}
	if nav.NextAction.Type != NextActionReturnToCurrent || nav.NextAction.Target.ID != "l2" || nav.NextAction.Target.ChapterID != "c1" {
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

func TestCompletedCourseHasNoSyntheticSummaryAction(t *testing.T) {
	g := evaluatorGraph()
	e := Evaluation{
		CourseStatus:    StatusCompleted,
		CurrentLessonID: "",
		Lessons: map[string]LessonEvaluation{
			"l1": {LessonID: "l1", Status: StatusCompleted, Complete: true},
			"l2": {LessonID: "l2", Status: StatusCompleted, Complete: true},
			"l3": {LessonID: "l3", Status: StatusCompleted, Complete: true},
		},
		Chapters: map[string]ChapterEvaluation{
			"c1": {ChapterID: "c1", Status: StatusCompleted},
			"c2": {ChapterID: "c2", Status: StatusCompleted},
		},
	}

	action := NextActionFor(g, e, ItemRef{Kind: ItemLesson, ID: "l3", ChapterID: "c2"})
	if action.Type != NextActionNone {
		t.Fatalf("got %s want %s", action.Type, NextActionNone)
	}
}

func TestNavigationCarriesAuthoredLessonAndAssessmentTitles(t *testing.T) {
	graph := CourseGraph{
		ID: "course", Version: "1", LessonIndex: map[string]LessonRef{},
		Chapters: []Chapter{{
			ID: "chapter", Title: "Chương", Required: true,
			Lessons:     []LessonRef{{ID: "lesson", Title: "Tên bài học", ChapterID: "chapter", Required: true}},
			Assessments: []Assessment{{ID: "checkpoint", Title: "Đánh giá tổng hợp", ChapterID: "chapter", Required: true}},
		}},
	}
	graph.LessonIndex["lesson"] = graph.Chapters[0].Lessons[0]
	evaluation := Evaluation{
		CourseStatus: StatusInProgress, CurrentLessonID: "lesson",
		Lessons:  map[string]LessonEvaluation{"lesson": {LessonID: "lesson", Status: StatusAvailable}},
		Chapters: map[string]ChapterEvaluation{"chapter": {ChapterID: "chapter", Status: StatusInProgress}},
	}
	navigation, err := BuildNavigation(graph, evaluation, ItemRef{Kind: ItemLesson, ID: "lesson", ChapterID: "chapter"})
	if err != nil {
		t.Fatal(err)
	}
	if got := navigation.Chapters[0].Lessons[0].Title; got != "Tên bài học" {
		t.Fatalf("lesson title=%q", got)
	}
	if got := navigation.Chapters[0].Assessments[0].Title; got != "Đánh giá tổng hợp" {
		t.Fatalf("assessment title=%q", got)
	}
}
