package course

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	contractvalidator "github.com/synaploom/synaploom/internal/contracts"
)

func Validate(sourcePath string) error {
	data, err := os.ReadFile(filepath.Join(sourcePath, "course.json"))
	if err != nil {
		return err
	}
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if err := contractvalidator.NewValidator().Validate("course", raw); err != nil {
		return fmt.Errorf("course schema: %w", err)
	}
	var manifest contracts.CourseManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return fmt.Errorf("decode course manifest: %w", err)
	}
	if err := walkSafe(sourcePath); err != nil {
		return err
	}
	lessons, err := buildFilesystemLessonCatalog(sourcePath, manifest)
	if err != nil {
		return err
	}
	for _, lesson := range lessons {
		lessonPath := filepath.Join(sourcePath, filepath.FromSlash(lesson.Path))
		info, err := os.Stat(lessonPath)
		if err != nil {
			return fmt.Errorf("lesson %q: %w", lesson.ID, err)
		}
		lessonRoot := filepath.Dir(lessonPath)
		if info.IsDir() {
			lessonRoot = lessonPath
			lessonPath = filepath.Join(lessonPath, "lesson.md")
		}
		source, err := os.ReadFile(lessonPath)
		if err != nil {
			return fmt.Errorf("lesson %q: %w", lesson.ID, err)
		}
		frontMatter, markdown, err := parseLessonFrontMatter(source)
		if err != nil {
			return fmt.Errorf("lesson %q: %w", lesson.ID, err)
		}
		title := frontMatter.Title
		if title == "" {
			title = lesson.ID
		}
		_, issues := ParseLessonDocument(string(markdown), MarkdownParseOptions{
			CourseRoot: sourcePath,
			LessonRoot: lessonRoot,
			Strict:     true,
			Metadata: LessonMetadata{
				ID: lesson.ID, CourseID: string(manifest.Id), Position: lesson.Position,
				Title: title, Type: contracts.LessonDocumentType(frontMatter.Type),
			},
		})
		if len(issues) > 0 {
			issue := issues[0]
			return fmt.Errorf("lesson %q: %s: %s (%s)", lesson.ID, issue.Code, issue.Message, issue.Path)
		}
		if _, err := loadLessonExercise(lessonRoot, frontMatter.Exercise); err != nil {
			return fmt.Errorf("lesson %q: %w", lesson.ID, err)
		}
	}
	if _, err := loadCourseActivitySets(context.Background(), sourcePath, manifest); err != nil {
		return err
	}
	if _, err := loadAssessmentActivitySets(context.Background(), sourcePath, manifest); err != nil {
		return err
	}
	workspaceRoot, err := os.MkdirTemp("", "synaploom-validation-workspaces-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(workspaceRoot)
	service, err := OpenFilesystemServiceWithWorkspace(sourcePath, workspaceRoot)
	if err != nil {
		return err
	}
	if _, err := service.ProgressionGraph(); err != nil {
		return err
	}
	return nil
}
