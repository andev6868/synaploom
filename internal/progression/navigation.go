package progression

import "fmt"

type ItemKind string

const (
	ItemLesson            ItemKind = "LESSON"
	ItemChapterAssessment ItemKind = "CHAPTER_ASSESSMENT"
	ItemChapter           ItemKind = "CHAPTER"
	ItemCourse            ItemKind = "COURSE"
)

type ItemRef struct {
	Kind          ItemKind
	ID, ChapterID string
}
type ViewMode string

const (
	ViewModeLearning ViewMode = "LEARNING"
	ViewModeReview   ViewMode = "REVIEW"
)

type NextActionType string

const (
	NextActionNone                   NextActionType = "NONE"
	NextActionReturnToCurrent        NextActionType = "RETURN_TO_CURRENT_LESSON"
	NextActionAcknowledgeReading     NextActionType = "ACKNOWLEDGE_READING"
	NextActionStartRequiredPractice  NextActionType = "START_REQUIRED_PRACTICE"
	NextActionRetryRequiredPractice  NextActionType = "RETRY_REQUIRED_PRACTICE"
	NextActionContinueToLesson       NextActionType = "CONTINUE_TO_LESSON"
	NextActionStartChapterAssessment NextActionType = "START_CHAPTER_ASSESSMENT"
	NextActionRetryChapterAssessment NextActionType = "RETRY_CHAPTER_ASSESSMENT"
	NextActionContinueToChapter      NextActionType = "CONTINUE_TO_CHAPTER"
	NextActionViewCourseSummary      NextActionType = "VIEW_COURSE_SUMMARY"
)

type NextAction struct {
	Type          NextActionType
	Target        ItemRef
	RequirementID string
	Label         string
}
type LessonNavigationItem struct {
	ID                        string
	Status                    Status
	Required, Viewed, Current bool
}
type AssessmentNavigationItem struct {
	ID               string
	Status           Status
	Required, Viewed bool
}
type ChapterNavigationItem struct {
	ID, Title   string
	Status      Status
	Required    bool
	Lessons     []LessonNavigationItem
	Assessments []AssessmentNavigationItem
}
type LearningNavigation struct {
	CourseID                      string
	CurrentLessonID, ViewedItemID string
	ViewMode                      ViewMode
	Chapters                      []ChapterNavigationItem
	ReturnTarget                  *NavigationTarget
	NextAction                    NextAction
}

func BuildNavigation(graph CourseGraph, evaluation Evaluation, viewed ItemRef) (LearningNavigation, error) {
	if viewed.Kind == "" {
		viewed = ItemRef{Kind: ItemLesson, ID: evaluation.CurrentLessonID}
	}
	if viewed.Kind == ItemLesson {
		lesson, ok := evaluation.Lessons[viewed.ID]
		if !ok {
			return LearningNavigation{}, &UnknownItemError{ItemID: viewed.ID}
		}
		if lesson.Status == StatusLocked {
			return LearningNavigation{}, lockedError(viewed.ID, evaluation, lesson.Requirements)
		}
	}
	nav := LearningNavigation{CourseID: graph.ID, CurrentLessonID: evaluation.CurrentLessonID, ViewedItemID: viewed.ID, ViewMode: ViewModeLearning}
	if viewed.Kind == ItemLesson && viewed.ID != evaluation.CurrentLessonID && evaluation.Lessons[viewed.ID].Status == StatusCompleted {
		nav.ViewMode = ViewModeReview
		nav.ReturnTarget = &NavigationTarget{Type: string(ItemLesson), ID: evaluation.CurrentLessonID}
	}
	for _, chapter := range graph.Chapters {
		ce := evaluation.Chapters[chapter.ID]
		item := ChapterNavigationItem{ID: chapter.ID, Title: chapter.Title, Status: ce.Status, Required: chapter.Required}
		for _, lesson := range chapter.Lessons {
			le := evaluation.Lessons[lesson.ID]
			item.Lessons = append(item.Lessons, LessonNavigationItem{ID: lesson.ID, Status: le.Status, Required: lesson.Required, Viewed: viewed.Kind == ItemLesson && viewed.ID == lesson.ID, Current: evaluation.CurrentLessonID == lesson.ID})
		}
		for _, assessment := range chapter.Assessments {
			status := StatusLocked
			for _, req := range ce.Requirements {
				if req.Kind == "assessment" && req.ID == assessment.ID {
					if req.Satisfied {
						status = StatusCompleted
					} else if ce.Status == StatusAssessmentRequired {
						status = StatusAvailable
					}
				}
			}
			item.Assessments = append(item.Assessments, AssessmentNavigationItem{ID: assessment.ID, Status: status, Required: assessment.Required, Viewed: viewed.Kind == ItemChapterAssessment && viewed.ID == assessment.ID})
		}
		nav.Chapters = append(nav.Chapters, item)
	}
	nav.NextAction = NextActionFor(graph, evaluation, viewed)
	return nav, nil
}

func lockedError(itemID string, evaluation Evaluation, requirements []RequirementView) error {
	blocking := make([]RequirementView, 0)
	for _, req := range requirements {
		if req.Required && !req.Satisfied {
			blocking = append(blocking, req)
		}
	}
	return &ItemLockedError{ItemID: itemID, CurrentItem: NavigationTarget{Type: string(ItemLesson), ID: evaluation.CurrentLessonID}, Blocking: blocking}
}

func NextActionFor(graph CourseGraph, evaluation Evaluation, viewed ItemRef) NextAction {
	if viewed.Kind == ItemLesson {
		le, ok := evaluation.Lessons[viewed.ID]
		if ok && le.Status == StatusCompleted && viewed.ID != evaluation.CurrentLessonID {
			return NextAction{Type: NextActionReturnToCurrent, Target: ItemRef{Kind: ItemLesson, ID: evaluation.CurrentLessonID}, Label: "Quay lại bài đang học"}
		}
		for _, req := range le.Requirements {
			if req.Required && !req.Satisfied && req.Kind == "reading" {
				return NextAction{Type: NextActionAcknowledgeReading, Target: viewed, Label: "Đã đọc xong"}
			}
		}
		for _, req := range le.Requirements {
			if !req.Required || req.Satisfied || req.Kind != "practice" {
				continue
			}
			kind := NextActionStartRequiredPractice
			label := "Đi đến bài thực hành"
			if req.Attempted {
				kind = NextActionRetryRequiredPractice
				label = "Thử lại bài thực hành"
			}
			return NextAction{Type: kind, Target: ItemRef{Kind: ItemLesson, ID: viewed.ID, ChapterID: viewed.ChapterID}, RequirementID: req.ID, Label: label}
		}
	}
	if evaluation.CurrentLessonID != "" && evaluation.CurrentLessonID != viewed.ID {
		if le := evaluation.Lessons[evaluation.CurrentLessonID]; le.Status == StatusAvailable {
			return NextAction{Type: NextActionContinueToLesson, Target: ItemRef{Kind: ItemLesson, ID: evaluation.CurrentLessonID}, Label: "Tiếp tục bài tiếp theo"}
		}
	}
	for _, chapter := range graph.Chapters {
		ce := evaluation.Chapters[chapter.ID]
		if ce.Status == StatusAssessmentRequired {
			for _, req := range ce.Requirements {
				if req.Kind != "assessment" || !req.Required || req.Satisfied {
					continue
				}
				kind := NextActionStartChapterAssessment
				label := "Bắt đầu bài thực hành của chương"
				if req.Attempted {
					kind = NextActionRetryChapterAssessment
					label = "Thử lại bài thực hành của chương"
				}
				return NextAction{Type: kind, Target: ItemRef{Kind: ItemChapterAssessment, ID: req.ID, ChapterID: chapter.ID}, Label: label}
			}
		}
	}
	for _, chapter := range graph.Chapters {
		if evaluation.Chapters[chapter.ID].Status == StatusInProgress {
			for _, lesson := range chapter.Lessons {
				if evaluation.Lessons[lesson.ID].Status == StatusAvailable && lesson.ID != viewed.ID {
					return NextAction{Type: NextActionContinueToChapter, Target: ItemRef{Kind: ItemChapter, ID: chapter.ID}, Label: fmt.Sprintf("Tiếp tục %s", chapter.Title)}
				}
			}
		}
	}
	if evaluation.CourseStatus == StatusCompleted {
		return NextAction{Type: NextActionViewCourseSummary, Target: ItemRef{Kind: ItemCourse, ID: graph.ID}, Label: "Xem tổng kết khóa học"}
	}
	return NextAction{Type: NextActionNone}
}
