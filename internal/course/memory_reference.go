package course

import (
	"context"
	"encoding/json"
	"fmt"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

// MemoryReference is an immutable reference implementation used by preview and conformance tests.
type MemoryReference struct {
	course  contracts.CoursePayload
	lessons map[string]contracts.LessonPayload
}

func NewMemoryReference(courseJSON []byte, lessonJSON map[string][]byte) (*MemoryReference, error) {
	var course contracts.CoursePayload
	if err := json.Unmarshal(courseJSON, &course); err != nil {
		return nil, fmt.Errorf("decode course: %w", err)
	}
	lessons := make(map[string]contracts.LessonPayload, len(lessonJSON))
	for id, data := range lessonJSON {
		var lesson contracts.LessonPayload
		if err := json.Unmarshal(data, &lesson); err != nil {
			return nil, fmt.Errorf("decode lesson %s: %w", id, err)
		}
		lessons[id] = lesson
	}
	return &MemoryReference{course: course, lessons: lessons}, nil
}

func (m *MemoryReference) Course(context.Context) (contracts.CoursePayload, error) {
	return m.course, nil
}
func (m *MemoryReference) Lesson(_ context.Context, id string) (contracts.LessonPayload, error) {
	lesson, ok := m.lessons[id]
	if !ok {
		return contracts.LessonPayload{}, ErrLessonNotFound
	}
	return lesson, nil
}
