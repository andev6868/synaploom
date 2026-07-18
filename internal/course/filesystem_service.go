package course

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/activity"
	contractvalidator "github.com/synaploom/synaploom/internal/contracts"
	"github.com/synaploom/synaploom/internal/runner"
	"github.com/synaploom/synaploom/internal/workspace"
)

type FilesystemService struct {
	manifest   contracts.CourseManifest
	root       string
	lessons    []filesystemLessonRef
	mu         sync.RWMutex
	current    string
	states     map[string]*lessonState
	workspaces workspace.Manager
}

type filesystemLessonRef struct {
	ID        string
	Path      string
	Position  int
	Required  bool
	ChapterID string
}

type lessonState struct {
	status              contracts.LessonPayloadStatus
	readingAcknowledged bool
	latestCheck         any
}

func OpenFilesystemService(root string) (*FilesystemService, error) {
	workspaceRoot, err := os.MkdirTemp("", "synaploom-workspaces-")
	if err != nil {
		return nil, fmt.Errorf("create workspace root: %w", err)
	}
	return OpenFilesystemServiceWithWorkspace(root, workspaceRoot)
}

func OpenFilesystemServiceWithWorkspace(root, workspaceRoot string) (*FilesystemService, error) {
	data, err := os.ReadFile(filepath.Join(root, "course.json"))
	if err != nil {
		return nil, fmt.Errorf("read course manifest: %w", err)
	}
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	if err := contractvalidator.NewValidator().Validate("course", raw); err != nil {
		return nil, err
	}
	var manifest contracts.CourseManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, err
	}
	lessons, err := buildFilesystemLessonCatalog(root, manifest)
	if err != nil {
		return nil, err
	}
	states := make(map[string]*lessonState, len(lessons))
	current := ""
	for i, lesson := range lessons {
		status := contracts.LessonPayloadStatusLOCKED
		if i == 0 {
			status = contracts.LessonPayloadStatusAVAILABLE
			current = lesson.ID
		}
		states[lesson.ID] = &lessonState{status: status}
	}
	return &FilesystemService{manifest: manifest, root: root, lessons: lessons, current: current, states: states, workspaces: workspace.Manager{Root: workspaceRoot}}, nil
}

// ActivitySetSources returns validated owner-scoped activity definitions for runtime wiring.
func (s *FilesystemService) ActivitySetSources(ctx context.Context) (map[string][]ActivitySetSource, error) {
	return loadCourseActivitySets(ctx, s.root, s.manifest)
}

func (s *FilesystemService) Course(context.Context) (contracts.CoursePayload, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	lessons := append([]filesystemLessonRef(nil), s.lessons...)
	summaries := make([]contracts.CourseLessonSummary, 0, len(lessons))
	for _, lesson := range lessons {
		state := s.states[lesson.ID]
		status := contracts.CourseLessonSummaryStatusLOCKED
		if state != nil {
			status = contracts.CourseLessonSummaryStatus(state.status)
		}
		summaries = append(summaries, contracts.CourseLessonSummary{
			Id: lesson.ID, Position: lesson.Position, Status: status, Title: lesson.ID,
		})
	}
	var current contracts.CoursePayloadCurrentLessonId
	if s.current != "" {
		value := s.current
		current = &value
	}
	return contracts.CoursePayload{Id: string(s.manifest.Id), Version: s.manifest.Version, Title: s.manifest.Title, Description: s.manifest.Description, CurrentLessonId: current, Lessons: summaries}, nil
}
func (s *FilesystemService) Lesson(_ context.Context, id string) (contracts.LessonPayload, error) {
	for _, l := range s.lessons {
		if l.ID != id {
			continue
		}
		lessonPath := filepath.Join(s.root, filepath.FromSlash(l.Path))
		info, err := os.Stat(lessonPath)
		if err != nil {
			return contracts.LessonPayload{}, err
		}
		if info.IsDir() {
			lessonPath = filepath.Join(lessonPath, "lesson.md")
		}
		data, err := os.ReadFile(lessonPath)
		if err != nil {
			return contracts.LessonPayload{}, err
		}
		frontMatter, markdownBody, err := parseLessonFrontMatter(data)
		if err != nil {
			return contracts.LessonPayload{}, err
		}
		title := frontMatter.Title
		if title == "" {
			title = l.ID
		}
		doc, err := ParseLesson(markdownBody, LessonMetadata{ID: l.ID, CourseID: string(s.manifest.Id), Position: l.Position, Title: title, Type: contracts.LessonDocumentType(frontMatter.Type)})
		if err != nil {
			return contracts.LessonPayload{}, err
		}
		s.mu.RLock()
		state := s.states[l.ID]
		st := contracts.LessonPayloadStatusLOCKED
		readingAcknowledged := false
		if state != nil {
			st = state.status
			readingAcknowledged = state.readingAcknowledged
		}
		s.mu.RUnlock()
		blocks := doc.Blocks
		exercise, err := loadLessonExercise(filepath.Dir(lessonPath), frontMatter.Exercise)
		if err != nil {
			return contracts.LessonPayload{}, err
		}
		var exercisePayload any
		if exercise != nil {
			exercisePayload = *exercise
		}
		var latestCheck any
		s.mu.RLock()
		if state := s.states[l.ID]; state != nil {
			latestCheck = state.latestCheck
		}
		s.mu.RUnlock()
		return contracts.LessonPayload{
			Id: l.ID, Position: l.Position, Title: title, Type: frontMatter.Type,
			EstimatedMinutes: frontMatter.EstimatedMinutes, Status: st, ReadingAcknowledged: readingAcknowledged,
			Blocks: blocks, Exercise: exercisePayload, LatestCheck: latestCheck,
		}, nil
	}
	return contracts.LessonPayload{}, ErrLessonNotFound
}

func (s *FilesystemService) AcknowledgeReading(_ context.Context, lessonID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.states[lessonID]
	if !ok {
		return ErrLessonNotFound
	}
	if s.current != lessonID || state.status == contracts.LessonPayloadStatusLOCKED {
		return ErrLessonLocked
	}
	state.readingAcknowledged = true
	if state.status == contracts.LessonPayloadStatusAVAILABLE {
		state.status = contracts.LessonPayloadStatusINPROGRESS
	}
	return nil
}

func (s *FilesystemService) CompleteLesson(_ context.Context, lessonID string) (Completion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.states[lessonID]
	if !ok {
		return Completion{}, ErrLessonNotFound
	}
	if s.current != lessonID || state.status == contracts.LessonPayloadStatusLOCKED {
		return Completion{}, ErrLessonLocked
	}
	if !state.readingAcknowledged {
		return Completion{}, ErrReadingIncomplete
	}
	state.status = contracts.LessonPayloadStatusCOMPLETED
	lessons := append([]filesystemLessonRef(nil), s.lessons...)
	for i, lesson := range lessons {
		if lesson.ID != lessonID {
			continue
		}
		if i+1 >= len(lessons) {
			s.current = ""
			return Completion{CourseCompleted: true}, nil
		}
		next := lessons[i+1]
		nextState := s.states[next.ID]
		nextState.status = contracts.LessonPayloadStatusAVAILABLE
		s.current = next.ID
		return Completion{NextLessonID: next.ID, NextLessonTitle: next.ID}, nil
	}
	return Completion{}, ErrLessonNotFound
}

type lessonExerciseRuntime struct {
	lessonDir   string
	manifest    *exerciseManifest
	activityID  string
	workspaceID string
}

func exerciseManifestFromCoding(config activity.CodingWorkspaceDefinition) *exerciseManifest {
	manifest := &exerciseManifest{ID: config.ID, Title: config.Title}
	manifest.Workspace.Starter = config.Workspace.Starter
	manifest.Workspace.Editable = append([]string(nil), config.Workspace.Editable...)
	manifest.Actions = make(map[string]struct {
		Label          string   `json:"label"`
		Executable     string   `json:"executable"`
		Args           []string `json:"args"`
		TimeoutMs      int      `json:"timeoutMs"`
		MaxOutputBytes int64    `json:"maxOutputBytes"`
	}, len(config.Actions))
	for id, action := range config.Actions {
		manifest.Actions[id] = struct {
			Label          string   `json:"label"`
			Executable     string   `json:"executable"`
			Args           []string `json:"args"`
			TimeoutMs      int      `json:"timeoutMs"`
			MaxOutputBytes int64    `json:"maxOutputBytes"`
		}{Label: action.Label, Executable: action.Executable, Args: append([]string(nil), action.Args...), TimeoutMs: action.TimeoutMs, MaxOutputBytes: action.MaxOutputBytes}
	}
	for _, check := range config.Checks {
		manifest.Checks = append(manifest.Checks, struct {
			ID       string `json:"id"`
			Title    string `json:"title"`
			Required bool   `json:"required"`
		}{ID: check.ID, Title: check.Title, Required: check.Required})
	}
	return manifest
}

func activityWorkspaceID(lessonID, activityID string) string {
	if activityID == "" {
		return lessonID
	}
	return lessonID + "--" + activityID
}

func (s *FilesystemService) exerciseRuntime(lessonID string) (lessonExerciseRuntime, error) {
	return s.exerciseRuntimeForActivity(context.Background(), lessonID, "")
}

func (s *FilesystemService) exerciseRuntimeForActivity(ctx context.Context, lessonID, activityID string) (lessonExerciseRuntime, error) {
	for _, lesson := range s.lessons {
		if lesson.ID != lessonID {
			continue
		}
		lessonPath := filepath.Join(s.root, filepath.FromSlash(lesson.Path))
		info, err := os.Stat(lessonPath)
		if err != nil {
			return lessonExerciseRuntime{}, err
		}
		lessonDir := lessonPath
		if info.IsDir() {
			lessonPath = filepath.Join(lessonPath, "lesson.md")
		} else {
			lessonDir = filepath.Dir(lessonPath)
		}
		data, err := os.ReadFile(lessonPath)
		if err != nil {
			return lessonExerciseRuntime{}, err
		}
		frontMatter, _, err := parseLessonFrontMatter(data)
		if err != nil {
			return lessonExerciseRuntime{}, err
		}
		if frontMatter.Exercise != "" {
			clean := filepath.Clean(filepath.FromSlash(frontMatter.Exercise))
			if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
				return lessonExerciseRuntime{}, ErrExerciseNotFound
			}
			manifest, err := readExerciseManifest(filepath.Join(lessonDir, clean))
			if err != nil {
				return lessonExerciseRuntime{}, err
			}
			if activityID != "" && activityID != manifest.ID {
				return lessonExerciseRuntime{}, ErrExerciseNotFound
			}
			return lessonExerciseRuntime{
				lessonDir: lessonDir, manifest: manifest, activityID: manifest.ID,
				workspaceID: activityWorkspaceID(lessonID, activityID),
			}, nil
		}

		sets, err := loadLessonActivitySets(ctx, lessonDir, frontMatter)
		if err != nil {
			return lessonExerciseRuntime{}, err
		}
		for _, set := range sets {
			for _, source := range set.Activities {
				if source.Kind != string(activity.ActivityKindCoding) || (activityID != "" && source.ID != activityID) {
					continue
				}
				definition, err := activity.DefinitionFromMap(source.Definition)
				if err != nil {
					return lessonExerciseRuntime{}, err
				}
				coding, err := activity.DecodeCodingActivity(definition)
				if err != nil {
					return lessonExerciseRuntime{}, err
				}
				manifest := exerciseManifestFromCoding(coding)
				return lessonExerciseRuntime{
					lessonDir: lessonDir, manifest: manifest, activityID: coding.ID,
					workspaceID: activityWorkspaceID(lessonID, coding.ID),
				}, nil
			}
		}
		return lessonExerciseRuntime{}, ErrExerciseNotFound
	}
	return lessonExerciseRuntime{}, ErrLessonNotFound
}

func (s *FilesystemService) prepareWorkspace(ctx context.Context, lessonID string) (lessonExerciseRuntime, string, error) {
	return s.prepareWorkspaceForActivity(ctx, lessonID, "")
}

func (s *FilesystemService) prepareWorkspaceForActivity(ctx context.Context, lessonID, activityID string) (lessonExerciseRuntime, string, error) {
	runtime, err := s.exerciseRuntimeForActivity(ctx, lessonID, activityID)
	if err != nil {
		return lessonExerciseRuntime{}, "", err
	}
	starter := filepath.Join(runtime.lessonDir, filepath.FromSlash(runtime.manifest.Workspace.Starter))
	checks := filepath.Join(runtime.lessonDir, "checks")
	if runtime.manifest.Workspace.Starter == "" {
		return lessonExerciseRuntime{}, "", ErrExerciseNotFound
	}
	if _, err := os.Stat(checks); errors.Is(err, os.ErrNotExist) {
		checks = ""
	} else if err != nil {
		return lessonExerciseRuntime{}, "", err
	}
	root, err := s.workspaces.Prepare(ctx, string(s.manifest.Id), runtime.workspaceID, starter, checks)
	return runtime, root, err
}

func (s *FilesystemService) WorkspaceFiles(ctx context.Context, lessonID string) ([]string, error) {
	return s.WorkspaceFilesForActivity(ctx, lessonID, "")
}

func (s *FilesystemService) WorkspaceFilesForActivity(ctx context.Context, lessonID, activityID string) ([]string, error) {
	runtime, _, err := s.prepareWorkspaceForActivity(ctx, lessonID, activityID)
	if err != nil {
		return nil, err
	}
	files := append([]string(nil), runtime.manifest.Workspace.Editable...)
	sort.Strings(files)
	return files, nil
}

func (s *FilesystemService) ReadWorkspaceFile(ctx context.Context, lessonID, relative string) ([]byte, error) {
	return s.ReadWorkspaceFileForActivity(ctx, lessonID, "", relative)
}

func (s *FilesystemService) ReadWorkspaceFileForActivity(ctx context.Context, lessonID, activityID, relative string) ([]byte, error) {
	runtime, _, err := s.prepareWorkspaceForActivity(ctx, lessonID, activityID)
	if err != nil {
		return nil, err
	}
	if !editableFile(runtime.manifest.Workspace.Editable, relative) {
		return nil, ErrWorkspaceFileNotFound
	}
	data, err := s.workspaces.ReadFile(ctx, string(s.manifest.Id), runtime.workspaceID, relative)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrWorkspaceFileNotFound
	}
	return data, err
}

func (s *FilesystemService) WriteWorkspaceFile(ctx context.Context, lessonID, relative string, data []byte) error {
	return s.WriteWorkspaceFileForActivity(ctx, lessonID, "", relative, data)
}

func (s *FilesystemService) WriteWorkspaceFileForActivity(ctx context.Context, lessonID, activityID, relative string, data []byte) error {
	runtime, _, err := s.prepareWorkspaceForActivity(ctx, lessonID, activityID)
	if err != nil {
		return err
	}
	if !editableFile(runtime.manifest.Workspace.Editable, relative) {
		return ErrWorkspaceFileNotFound
	}
	return s.workspaces.WriteFile(ctx, string(s.manifest.Id), runtime.workspaceID, relative, data)
}

func (s *FilesystemService) ResetWorkspace(ctx context.Context, lessonID string) error {
	return s.ResetWorkspaceForActivity(ctx, lessonID, "")
}

func (s *FilesystemService) ResetWorkspaceForActivity(ctx context.Context, lessonID, activityID string) error {
	runtime, _, err := s.prepareWorkspaceForActivity(ctx, lessonID, activityID)
	if err != nil {
		return err
	}
	starter := filepath.Join(runtime.lessonDir, filepath.FromSlash(runtime.manifest.Workspace.Starter))
	checks := filepath.Join(runtime.lessonDir, "checks")
	if _, err := os.Stat(checks); errors.Is(err, os.ErrNotExist) {
		checks = ""
	} else if err != nil {
		return err
	}
	return s.workspaces.Reset(ctx, string(s.manifest.Id), runtime.workspaceID, starter, checks)
}

func (s *FilesystemService) ResolveAction(ctx context.Context, lessonID, actionID string) (runner.Action, error) {
	return s.ResolveActivityAction(ctx, lessonID, "", actionID)
}

func (s *FilesystemService) ResolveActivityAction(ctx context.Context, lessonID, activityID, actionID string) (runner.Action, error) {
	runtime, root, err := s.prepareWorkspaceForActivity(ctx, lessonID, activityID)
	if err != nil {
		return runner.Action{}, err
	}
	action, ok := runtime.manifest.Actions[actionID]
	if !ok {
		return runner.Action{}, runner.ErrActionNotFound
	}
	return runner.Action{
		Program: action.Executable, Args: append([]string(nil), action.Args...), WorkingDir: root,
		Timeout: time.Duration(action.TimeoutMs) * time.Millisecond, MaxOutputByte: action.MaxOutputBytes,
		TrustedWorkingDir: true,
	}, nil
}

func editableFile(editable []string, relative string) bool {
	clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(relative)))
	for _, allowed := range editable {
		if clean == filepath.ToSlash(filepath.Clean(filepath.FromSlash(allowed))) {
			return true
		}
	}
	return false
}

// RecordActionResult stores check outcomes so the learner UI can refresh after the SSE terminal event.
func (s *FilesystemService) RecordActionResult(ctx context.Context, lessonID, actionID string, result runner.Result) error {
	return s.RecordActivityActionResult(ctx, lessonID, "", actionID, "", result)
}

// RecordActivityActionResult stores check outcomes for the exact authored coding activity.
// executionID is accepted for interface symmetry; persistent attempt idempotency is owned
// by the activity service at the application composition boundary.
func (s *FilesystemService) RecordActivityActionResult(ctx context.Context, lessonID, activityID, actionID, executionID string, result runner.Result) error {
	_ = executionID
	if actionID != "check" {
		return nil
	}
	runtime, err := s.exerciseRuntimeForActivity(ctx, lessonID, activityID)
	if err != nil {
		return err
	}
	passed := result.ExitCode != nil && *result.ExitCode == 0 && result.Err == nil
	message := "Check passed."
	if !passed {
		message = "Check failed."
		if result.ExitCode != nil {
			message = fmt.Sprintf("Check failed with exit code %d.", *result.ExitCode)
		}
	}
	checks := make([]map[string]any, 0, len(runtime.manifest.Checks))
	for _, check := range runtime.manifest.Checks {
		checks = append(checks, map[string]any{
			"id": check.ID, "title": check.Title, "required": check.Required,
			"passed": passed, "message": message,
		})
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, ok := s.states[lessonID]
	if !ok {
		return ErrLessonNotFound
	}
	state.latestCheck = map[string]any{"activityId": runtime.activityID, "checks": checks}
	return nil
}

func buildFilesystemLessonCatalog(root string, manifest contracts.CourseManifest) ([]filesystemLessonRef, error) {
	if manifest.SchemaVersion == contracts.CourseManifestSchemaVersionA10 {
		lessons := make([]filesystemLessonRef, 0, len(manifest.Lessons))
		for _, lesson := range manifest.Lessons {
			lessons = append(lessons, filesystemLessonRef{ID: string(lesson.Id), Path: string(lesson.Path), Position: lesson.Position, Required: true, ChapterID: "default"})
		}
		sort.Slice(lessons, func(i, j int) bool { return lessons[i].Position < lessons[j].Position })
		return lessons, nil
	}
	if manifest.SchemaVersion != contracts.CourseManifestSchemaVersionA110 && manifest.SchemaVersion != contracts.CourseManifestSchemaVersionA120 {
		return nil, fmt.Errorf("unsupported course schema version %q", manifest.SchemaVersion)
	}
	discovered := map[string]string{}
	entries, err := filepath.Glob(filepath.Join(root, "lessons", "*"))
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		info, err := os.Stat(entry)
		if err != nil || !info.IsDir() {
			continue
		}
		lessonPath := filepath.Join(entry, "lesson.md")
		data, err := os.ReadFile(lessonPath)
		if err != nil {
			continue
		}
		frontMatter, _, err := parseLessonFrontMatter(data)
		if err != nil {
			return nil, err
		}
		if frontMatter.ID == "" {
			continue
		}
		relative, err := filepath.Rel(root, entry)
		if err != nil {
			return nil, err
		}
		discovered[frontMatter.ID] = filepath.ToSlash(relative)
	}
	lessons := []filesystemLessonRef{}
	position := 1
	seen := map[string]struct{}{}
	for _, chapter := range manifest.Chapters {
		for _, reference := range chapter.Lessons {
			id := string(reference.Id)
			if _, exists := seen[id]; exists {
				return nil, fmt.Errorf("duplicate lesson %q", id)
			}
			path, ok := discovered[id]
			if !ok {
				return nil, fmt.Errorf("lesson %q has no lesson.md source", id)
			}
			lessons = append(lessons, filesystemLessonRef{ID: id, Path: path, Position: position, Required: reference.Required, ChapterID: string(chapter.Id)})
			seen[id] = struct{}{}
			position++
		}
	}
	return lessons, nil
}
