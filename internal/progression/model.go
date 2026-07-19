package progression

// CompletionRuleType identifies how a practice or assessment is satisfied.
type CompletionRuleType string

const (
	CompletionAllRequiredChecks CompletionRuleType = "all-required-checks"
	CompletionMinimumScore      CompletionRuleType = "minimum-score"
)

// CompletionRule is the normalized runtime form of an author-facing completion rule.
type CompletionRule struct {
	Type      CompletionRuleType
	Threshold float64
}

// Practice is a lesson-scoped practice requirement.
type Practice struct {
	ID       string
	Title    string
	Required bool
	Rule     CompletionRule
}

// ActivitySetRequirement is the Course Schema 1.2 completion unit shared by
// lesson practice and chapter assessment flows.
type ActivitySetRequirement struct {
	ID       string
	Title    string
	Required bool
}

// LessonDefinition contains lesson metadata loaded from lesson.md and exercise manifests.
type LessonDefinition struct {
	ID              string
	Title           string
	Position        int
	ReadingRequired bool
	Practices       []Practice
	ActivitySets    []ActivitySetRequirement
}

// LessonRef places a lesson definition inside a chapter.
type LessonRef struct {
	ID              string
	Title           string
	ChapterID       string
	Position        int
	Required        bool
	ReadingRequired bool
	Practices       []Practice
	ActivitySets    []ActivitySetRequirement
}

// Assessment is a chapter-level assessment.
type Assessment struct {
	ID                string
	ChapterID         string
	Title             string
	Position          int
	Required          bool
	Path              string
	RequiresLessonIDs []string
	Rule              CompletionRule
	ActivitySetID     string
}

// Chapter is an ordered course chapter.
type Chapter struct {
	ID          string
	Title       string
	Position    int
	Required    bool
	Lessons     []LessonRef
	Assessments []Assessment
}

// RequiredLessonIDs returns required lessons in chapter order.
func (c Chapter) RequiredLessonIDs() []string {
	ids := make([]string, 0, len(c.Lessons))
	for _, lesson := range c.Lessons {
		if lesson.Required {
			ids = append(ids, lesson.ID)
		}
	}
	return ids
}

// CourseGraph is the normalized runtime representation used by progression evaluation.
type CourseGraph struct {
	ID          string
	Title       string
	Version     string
	Chapters    []Chapter
	LessonIndex map[string]LessonRef
}
