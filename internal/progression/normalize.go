package progression

import (
	"errors"
	"fmt"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

var ErrInvalidCourseGraph = errors.New("invalid course graph")

func invalidGraph(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidCourseGraph, fmt.Sprintf(format, args...))
}

// NormalizeCourse converts supported course manifests and lesson metadata into one runtime graph.
func NormalizeCourse(manifest contracts.CourseManifest, lessons []LessonDefinition) (CourseGraph, error) {
	definitions, err := indexLessonDefinitions(lessons)
	if err != nil {
		return CourseGraph{}, err
	}
	graph := CourseGraph{
		ID:          string(manifest.Id),
		Title:       manifest.Title,
		Version:     manifest.Version,
		LessonIndex: make(map[string]LessonRef),
	}
	switch manifest.SchemaVersion {
	case contracts.CourseManifestSchemaVersionA10:
		chapter, err := normalizeLinearChapter(manifest, definitions)
		if err != nil {
			return CourseGraph{}, err
		}
		graph.Chapters = []Chapter{chapter}
	case contracts.CourseManifestSchemaVersionA110, contracts.CourseManifestSchemaVersionA120:
		chapters, err := normalizeHierarchicalChapters(manifest, definitions)
		if err != nil {
			return CourseGraph{}, err
		}
		graph.Chapters = chapters
	default:
		return CourseGraph{}, invalidGraph("unsupported schema version %q", manifest.SchemaVersion)
	}
	for _, chapter := range graph.Chapters {
		for _, lesson := range chapter.Lessons {
			graph.LessonIndex[lesson.ID] = lesson
		}
	}
	return graph, nil
}

func indexLessonDefinitions(lessons []LessonDefinition) (map[string]LessonDefinition, error) {
	definitions := make(map[string]LessonDefinition, len(lessons))
	for _, lesson := range lessons {
		if lesson.ID == "" {
			return nil, invalidGraph("lesson definition has empty id")
		}
		if _, exists := definitions[lesson.ID]; exists {
			return nil, invalidGraph("duplicate lesson definition %q", lesson.ID)
		}
		definitions[lesson.ID] = lesson
	}
	return definitions, nil
}

func normalizeLinearChapter(
	manifest contracts.CourseManifest,
	definitions map[string]LessonDefinition,
) (Chapter, error) {
	chapter := Chapter{
		ID:       "default",
		Title:    manifest.Title,
		Position: 1,
		Required: true,
		Lessons:  make([]LessonRef, 0, len(manifest.Lessons)),
	}
	seen := make(map[string]struct{}, len(manifest.Lessons))
	for index, reference := range manifest.Lessons {
		id := string(reference.Id)
		if _, exists := seen[id]; exists {
			return Chapter{}, invalidGraph("duplicate linear lesson %q", id)
		}
		seen[id] = struct{}{}
		definition, ok := definitions[id]
		if !ok {
			return Chapter{}, invalidGraph("unknown lesson %q", id)
		}
		position := index + 1
		if reference.Position != position || (definition.Position != 0 && definition.Position != position) {
			return Chapter{}, invalidGraph("lesson %q has invalid position", id)
		}
		chapter.Lessons = append(chapter.Lessons, lessonRef("default", position, true, definition))
	}
	return chapter, nil
}

func normalizeHierarchicalChapters(
	manifest contracts.CourseManifest,
	definitions map[string]LessonDefinition,
) ([]Chapter, error) {
	chapters := make([]Chapter, 0, len(manifest.Chapters))
	chapterIDs := make(map[string]struct{}, len(manifest.Chapters))
	lessonMembership := make(map[string]string, len(definitions))
	for chapterIndex, rawChapter := range manifest.Chapters {
		chapterID := string(rawChapter.Id)
		if _, exists := chapterIDs[chapterID]; exists {
			return nil, invalidGraph("duplicate chapter %q", chapterID)
		}
		chapterIDs[chapterID] = struct{}{}
		chapter := Chapter{
			ID:          chapterID,
			Title:       rawChapter.Title,
			Position:    chapterIndex + 1,
			Required:    rawChapter.Required,
			Lessons:     make([]LessonRef, 0, len(rawChapter.Lessons)),
			Assessments: make([]Assessment, 0, len(rawChapter.Assessments)),
		}
		chapterLessonIDs := make(map[string]struct{}, len(rawChapter.Lessons))
		for lessonIndex, rawLesson := range rawChapter.Lessons {
			lessonID := string(rawLesson.Id)
			if owner, exists := lessonMembership[lessonID]; exists {
				return nil, invalidGraph("lesson %q belongs to both %q and %q", lessonID, owner, chapterID)
			}
			definition, ok := definitions[lessonID]
			if !ok {
				return nil, invalidGraph("unknown lesson %q in chapter %q", lessonID, chapterID)
			}
			lessonMembership[lessonID] = chapterID
			chapterLessonIDs[lessonID] = struct{}{}
			chapter.Lessons = append(chapter.Lessons, lessonRef(chapterID, lessonIndex+1, rawLesson.Required, definition))
		}
		assessmentIDs := make(map[string]struct{}, len(rawChapter.Assessments))
		for assessmentIndex, rawAssessment := range rawChapter.Assessments {
			assessmentID := string(rawAssessment.Id)
			if _, exists := assessmentIDs[assessmentID]; exists {
				return nil, invalidGraph("duplicate assessment %q in chapter %q", assessmentID, chapterID)
			}
			assessmentIDs[assessmentID] = struct{}{}
			requires := make([]string, 0, len(rawAssessment.RequiresLessons))
			for _, rawLessonID := range rawAssessment.RequiresLessons {
				lessonID := string(rawLessonID)
				if _, exists := chapterLessonIDs[lessonID]; !exists {
					return nil, invalidGraph("assessment %q references lesson %q outside chapter %q", assessmentID, lessonID, chapterID)
				}
				requires = append(requires, lessonID)
			}
			rule, err := normalizeCompletionRule(rawAssessment.Completion)
			if err != nil {
				return nil, invalidGraph("assessment %q: %v", assessmentID, err)
			}
			chapter.Assessments = append(chapter.Assessments, Assessment{
				ID:                assessmentID,
				ChapterID:         chapterID,
				Title:             rawAssessment.Title,
				Position:          assessmentIndex + 1,
				Required:          rawAssessment.Required,
				Path:              string(rawAssessment.Path),
				RequiresLessonIDs: requires,
				Rule:              rule,
			})
		}
		chapters = append(chapters, chapter)
	}
	return chapters, nil
}

func lessonRef(chapterID string, position int, required bool, definition LessonDefinition) LessonRef {
	practices := append([]Practice(nil), definition.Practices...)
	activitySets := append([]ActivitySetRequirement(nil), definition.ActivitySets...)
	return LessonRef{
		ID:              definition.ID,
		Title:           definition.Title,
		ChapterID:       chapterID,
		Position:        position,
		Required:        required,
		ReadingRequired: definition.ReadingRequired,
		Practices:       practices,
		ActivitySets:    activitySets,
	}
}

func normalizeCompletionRule(raw any) (CompletionRule, error) {
	value, ok := raw.(map[string]any)
	if !ok {
		return CompletionRule{}, fmt.Errorf("completion rule must be an object")
	}
	ruleType, _ := value["type"].(string)
	switch CompletionRuleType(ruleType) {
	case CompletionAllRequiredChecks:
		return CompletionRule{Type: CompletionAllRequiredChecks}, nil
	case CompletionMinimumScore:
		threshold, ok := value["threshold"].(float64)
		if !ok || threshold < 0 || threshold > 1 {
			return CompletionRule{}, fmt.Errorf("minimum-score threshold must be between 0 and 1")
		}
		return CompletionRule{Type: CompletionMinimumScore, Threshold: threshold}, nil
	default:
		return CompletionRule{}, fmt.Errorf("unsupported completion rule %q", ruleType)
	}
}
