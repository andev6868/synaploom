package contracts

import "encoding/json"

// MarshalJSON preserves schema-permitted fields not modeled explicitly by the generator.
func (b LessonBlock) MarshalJSON() ([]byte, error) {
	value := map[string]any{"type": b.Type}
	if extra, ok := b.AdditionalProperties.(map[string]any); ok {
		for key, field := range extra {
			if key != "type" {
				value[key] = field
			}
		}
	}
	return json.Marshal(value)
}

// UnmarshalJSON preserves schema-permitted fields not modeled explicitly by the generator.
func (b *LessonBlock) UnmarshalJSON(data []byte) error {
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	typeValue, _ := value["type"].(string)
	delete(value, "type")
	b.Type = typeValue
	b.AdditionalProperties = value
	return nil
}
