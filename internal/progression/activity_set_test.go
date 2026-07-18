package progression

import "testing"

func TestActivitySetRequirementCompletesLesson(t *testing.T) {
	t.Parallel()
	lesson := LessonRef{
		ID: "lesson", ChapterID: "chapter", Position: 1, Required: true,
		ActivitySets: []ActivitySetRequirement{{ID: "practice", Required: true}},
	}
	graph := CourseGraph{ID: "course", Version: "1", Chapters: []Chapter{{ID: "chapter", Position: 1, Required: true, Lessons: []LessonRef{lesson}}}, LessonIndex: map[string]LessonRef{"lesson": lesson}}
	passed := true
	snapshot := ProgressSnapshot{
		Lessons:   map[string]LessonProgress{"lesson": {Status: StatusAvailable}},
		Practices: map[PracticeKey]PracticeProgress{}, Assessments: map[AssessmentKey]PracticeProgress{},
		ActivitySets: map[ActivitySetKey]ActivitySetProgress{
			{OwnerKind: "lesson", OwnerID: "lesson", SetID: "practice"}: {Status: "COMPLETED", Passed: &passed},
		},
	}
	evaluation, err := EvaluateLesson(graph, snapshot, "lesson")
	if err != nil {
		t.Fatal(err)
	}
	if !evaluation.Complete || len(evaluation.Requirements) != 1 || evaluation.Requirements[0].Kind != "activity-set" || !evaluation.Requirements[0].Satisfied {
		t.Fatalf("evaluation = %+v", evaluation)
	}
}

func TestLegacyPracticeRequirementStillCompletesLesson(t *testing.T) {
	t.Parallel()
	lesson := LessonRef{ID: "lesson", ChapterID: "chapter", Position: 1, Required: true, Practices: []Practice{{ID: "legacy", Required: true, Rule: CompletionRule{Type: CompletionAllRequiredChecks}}}}
	graph := CourseGraph{ID: "course", Version: "1", LessonIndex: map[string]LessonRef{"lesson": lesson}}
	snapshot := ProgressSnapshot{Lessons: map[string]LessonProgress{}, Practices: map[PracticeKey]PracticeProgress{{LessonID: "lesson", PracticeID: "legacy"}: {BestResult: passedAttempt()}}, Assessments: map[AssessmentKey]PracticeProgress{}, ActivitySets: map[ActivitySetKey]ActivitySetProgress{}}
	evaluation, err := EvaluateLesson(graph, snapshot, "lesson")
	if err != nil {
		t.Fatal(err)
	}
	if !evaluation.Complete {
		t.Fatalf("legacy practice no longer completes lesson: %+v", evaluation)
	}
}
