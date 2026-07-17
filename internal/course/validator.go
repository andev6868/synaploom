package course

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

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
	return walkSafe(sourcePath)
}
