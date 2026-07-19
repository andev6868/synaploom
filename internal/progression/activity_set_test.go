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

func TestAssessmentActivitySetCompletesChapterAndUnlocksNextChapter(t *testing.T) {
	t.Parallel()
	lesson := LessonRef{ID: "lesson", ChapterID: "chapter", Position: 1, Required: true, ReadingRequired: true}
	next := LessonRef{ID: "next", ChapterID: "next-chapter", Position: 1, Required: true, ReadingRequired: true}
	assessment := Assessment{
		ID: "checkpoint", ChapterID: "chapter", Position: 1, Required: true,
		ActivitySetID: "checkpoint-set",
	}
	graph := CourseGraph{
		ID: "course", Version: "1",
		Chapters: []Chapter{
			{ID: "chapter", Position: 1, Required: true, Lessons: []LessonRef{lesson}, Assessments: []Assessment{assessment}},
			{ID: "next-chapter", Position: 2, Required: true, Lessons: []LessonRef{next}},
		},
		LessonIndex: map[string]LessonRef{lesson.ID: lesson, next.ID: next},
	}
	passed := true
	snapshot := ProgressSnapshot{
		Lessons:   map[string]LessonProgress{lesson.ID: {ReadingCompleted: true}},
		Practices: map[PracticeKey]PracticeProgress{}, Assessments: map[AssessmentKey]PracticeProgress{},
		ActivitySets: map[ActivitySetKey]ActivitySetProgress{
			{OwnerKind: "assessment", OwnerID: assessment.ID, SetID: assessment.ActivitySetID}: {
				Status: "COMPLETED", Passed: &passed, RequiredActivities: 2, CompletedRequiredActivities: 2,
			},
		},
	}

	evaluation := Evaluate(graph, snapshot)

	if got := evaluation.Chapters["chapter"].Status; got != StatusCompleted {
		t.Fatalf("chapter status = %s", got)
	}
	if got := evaluation.Lessons["next"].Status; got != StatusAvailable {
		t.Fatalf("next lesson status = %s", got)
	}
	requirements := evaluation.Chapters["chapter"].Requirements
	if len(requirements) != 2 || requirements[1].Kind != "assessment" || !requirements[1].Satisfied || requirements[1].LatestPassed == nil || !*requirements[1].LatestPassed {
		t.Fatalf("assessment requirement = %+v", requirements)
	}
}

func TestFailedAssessmentActivitySetKeepsChapterAtAssessmentRequired(t *testing.T) {
	t.Parallel()
	lesson := LessonRef{ID: "lesson", ChapterID: "chapter", Position: 1, Required: true, ReadingRequired: true}
	assessment := Assessment{ID: "checkpoint", ChapterID: "chapter", Position: 1, Required: true, ActivitySetID: "checkpoint-set"}
	graph := CourseGraph{
		ID: "course", Version: "1",
		Chapters:    []Chapter{{ID: "chapter", Position: 1, Required: true, Lessons: []LessonRef{lesson}, Assessments: []Assessment{assessment}}},
		LessonIndex: map[string]LessonRef{lesson.ID: lesson},
	}
	passed := false
	snapshot := ProgressSnapshot{
		Lessons:   map[string]LessonProgress{lesson.ID: {ReadingCompleted: true}},
		Practices: map[PracticeKey]PracticeProgress{}, Assessments: map[AssessmentKey]PracticeProgress{},
		ActivitySets: map[ActivitySetKey]ActivitySetProgress{
			{OwnerKind: "assessment", OwnerID: assessment.ID, SetID: assessment.ActivitySetID}: {
				Status: "COMPLETED", Passed: &passed, RequiredActivities: 1, CompletedRequiredActivities: 1,
			},
		},
	}

	evaluation := Evaluate(graph, snapshot)

	if got := evaluation.Chapters["chapter"].Status; got != StatusAssessmentRequired {
		t.Fatalf("chapter status = %s", got)
	}
	requirement := evaluation.Chapters["chapter"].Requirements[1]
	if !requirement.Attempted || requirement.Satisfied || requirement.LatestPassed == nil || *requirement.LatestPassed {
		t.Fatalf("assessment requirement = %+v", requirement)
	}
}
