package course

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

type lessonFrontMatter struct {
	ID               string
	Title            string
	Type             contracts.LessonPayloadType
	EstimatedMinutes *int
	Exercise         string
	ActivitySets     []string
}

func parseLessonFrontMatter(source []byte) (lessonFrontMatter, []byte, error) {
	scanner := bufio.NewScanner(bytes.NewReader(source))
	if !scanner.Scan() || strings.TrimSpace(scanner.Text()) != "---" {
		return lessonFrontMatter{}, source, nil
	}
	values := map[string]string{}
	lists := map[string][]string{}
	currentList := ""
	closed := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "---" {
			closed = true
			break
		}
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- ") && currentList != "" {
			value := strings.Trim(strings.TrimSpace(strings.TrimPrefix(trimmed, "- ")), `"'`)
			if value != "" {
				lists[currentList] = append(lists[currentList], value)
			}
			continue
		}
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		currentList = ""
		if value == "" {
			currentList = key
			continue
		}
		values[key] = value
	}
	if !closed {
		return lessonFrontMatter{}, nil, fmt.Errorf("lesson front matter is not closed")
	}
	var body bytes.Buffer
	for scanner.Scan() {
		body.WriteString(scanner.Text())
		body.WriteByte('\n')
	}
	if err := scanner.Err(); err != nil {
		return lessonFrontMatter{}, nil, err
	}
	metadata := lessonFrontMatter{ID: values["id"], Title: values["title"], Exercise: values["exercise"], ActivitySets: lists["activitySets"]}
	switch values["type"] {
	case "practice":
		metadata.Type = contracts.LessonPayloadTypePractice
	case "mixed":
		metadata.Type = contracts.LessonPayloadTypeMixed
	default:
		metadata.Type = contracts.LessonPayloadTypeTheory
	}
	if raw := values["estimatedMinutes"]; raw != "" {
		minutes, err := strconv.Atoi(raw)
		if err != nil || minutes < 1 {
			return lessonFrontMatter{}, nil, fmt.Errorf("invalid estimatedMinutes %q", raw)
		}
		metadata.EstimatedMinutes = &minutes
	}
	return metadata, body.Bytes(), nil
}

type exerciseManifest struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Workspace struct {
		Starter  string   `json:"starter"`
		Editable []string `json:"editable"`
	} `json:"workspace"`
	Actions map[string]struct {
		Label          string   `json:"label"`
		Executable     string   `json:"executable"`
		Args           []string `json:"args"`
		TimeoutMs      int      `json:"timeoutMs"`
		MaxOutputBytes int64    `json:"maxOutputBytes"`
	} `json:"actions"`
	Checks []struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Required bool   `json:"required"`
	} `json:"checks"`
}

func loadLessonExercise(lessonDir, relativePath string) (*contracts.LessonExercise, error) {
	if relativePath == "" {
		return nil, nil
	}
	clean := filepath.Clean(filepath.FromSlash(relativePath))
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return nil, fmt.Errorf("exercise path escapes lesson directory: %q", relativePath)
	}
	path := filepath.Join(lessonDir, clean)
	rel, err := filepath.Rel(lessonDir, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, fmt.Errorf("exercise path escapes lesson directory: %q", relativePath)
	}
	manifest, err := readExerciseManifest(path)
	if err != nil {
		return nil, err
	}
	actionIDs := make([]string, 0, len(manifest.Actions))
	for id := range manifest.Actions {
		actionIDs = append(actionIDs, id)
	}
	sort.Strings(actionIDs)
	actions := make([]contracts.LessonExerciseActionsElem, 0, len(actionIDs))
	for _, id := range actionIDs {
		actions = append(actions, contracts.LessonExerciseActionsElem{Id: id, Label: manifest.Actions[id].Label})
	}
	checks := make([]contracts.LessonExerciseChecksElem, 0, len(manifest.Checks))
	for _, check := range manifest.Checks {
		checks = append(checks, contracts.LessonExerciseChecksElem{Id: check.ID, Title: check.Title, Required: check.Required})
	}
	return &contracts.LessonExercise{Id: manifest.ID, Title: manifest.Title, Editable: manifest.Workspace.Editable, Actions: actions, Checks: checks}, nil
}

func readExerciseManifest(path string) (*exerciseManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read exercise manifest: %w", err)
	}
	var manifest exerciseManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("parse exercise manifest: %w", err)
	}
	return &manifest, nil
}
