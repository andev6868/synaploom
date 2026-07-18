package course

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/synaploom/synaploom/internal/progression"
)

// ProgressionGraph builds the authoritative hierarchical learning graph from
// the validated course manifest and lesson exercise metadata.
func (s *FilesystemService) ProgressionGraph() (progression.CourseGraph, error) {
	definitions := make([]progression.LessonDefinition, 0, len(s.lessons))
	for _, lesson := range s.lessons {
		lessonPath := filepath.Join(s.root, filepath.FromSlash(lesson.Path))
		info, err := os.Stat(lessonPath)
		if err != nil {
			return progression.CourseGraph{}, err
		}
		lessonDir := filepath.Dir(lessonPath)
		if info.IsDir() {
			lessonDir = lessonPath
			lessonPath = filepath.Join(lessonPath, "lesson.md")
		}
		source, err := os.ReadFile(lessonPath)
		if err != nil {
			return progression.CourseGraph{}, err
		}
		frontMatter, _, err := parseLessonFrontMatter(source)
		if err != nil {
			return progression.CourseGraph{}, err
		}
		definition := progression.LessonDefinition{
			ID:              lesson.ID,
			Position:        lesson.Position,
			ReadingRequired: true,
		}
		if frontMatter.Exercise != "" {
			manifest, err := readExerciseManifest(filepath.Join(lessonDir, filepath.FromSlash(frontMatter.Exercise)))
			if err != nil {
				return progression.CourseGraph{}, fmt.Errorf("load progression exercise for %q: %w", lesson.ID, err)
			}
			required := false
			for _, check := range manifest.Checks {
				required = required || check.Required
			}
			definition.Practices = []progression.Practice{{
				ID:       manifest.ID,
				Title:    manifest.Title,
				Required: required,
				Rule:     progression.CompletionRule{Type: progression.CompletionAllRequiredChecks},
			}}
		}
		if len(frontMatter.ActivitySets) > 0 {
			sets, err := LoadActivitySets(context.Background(), lessonDir, frontMatter.ActivitySets)
			if err != nil {
				return progression.CourseGraph{}, fmt.Errorf("load progression activity sets for %q: %w", lesson.ID, err)
			}
			for _, set := range sets {
				required := false
				for _, reference := range set.Definition.Activities {
					required = required || reference.Required
				}
				title := string(set.Definition.Id)
				if set.Definition.Title != nil {
					title = *set.Definition.Title
				}
				definition.ActivitySets = append(definition.ActivitySets, progression.ActivitySetRequirement{
					ID: string(set.Definition.Id), Title: title, Required: required,
				})
			}
		}
		definitions = append(definitions, definition)
	}
	return progression.NormalizeCourse(s.manifest, definitions)
}
