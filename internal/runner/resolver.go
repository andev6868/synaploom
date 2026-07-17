package runner

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	ErrActionNotFound = errors.New("runner action not found")
	ErrInvalidAction  = errors.New("invalid runner action")
)

var windowsAbsolutePath = regexp.MustCompile(`^[A-Za-z]:[\\/]`)

type Resolver struct{ actions map[string]Action }

func NewResolver(actions map[string]Action) *Resolver {
	copied := make(map[string]Action, len(actions))
	for id, action := range actions {
		copied[id] = cloneAction(action)
	}
	return &Resolver{actions: copied}
}

func (r *Resolver) Resolve(actionID string) (Request, error) {
	action, ok := r.actions[actionID]
	if !ok {
		return Request{}, ErrActionNotFound
	}
	if err := validateAction(action); err != nil {
		return Request{}, err
	}
	return Request{
		ExecutionID: newExecutionID(), Program: action.Program,
		Args: append([]string(nil), action.Args...), WorkingDir: action.WorkingDir,
		Environment: append([]string(nil), action.Environment...), Timeout: action.Timeout,
		MaxOutputByte: action.MaxOutputByte,
	}, nil
}

func cloneAction(action Action) Action {
	action.Args = append([]string(nil), action.Args...)
	action.Environment = append([]string(nil), action.Environment...)
	return action
}

func validateAction(action Action) error {
	if strings.TrimSpace(action.Program) == "" || action.Timeout < 0 || action.MaxOutputByte < 0 {
		return ErrInvalidAction
	}
	workingDir := action.WorkingDir
	if workingDir == "" {
		return nil
	}
	if (filepath.IsAbs(workingDir) || windowsAbsolutePath.MatchString(workingDir)) && !action.TrustedWorkingDir {
		return ErrInvalidAction
	}
	for _, part := range strings.FieldsFunc(filepath.ToSlash(workingDir), func(r rune) bool { return r == '/' }) {
		if part == ".." {
			return ErrInvalidAction
		}
	}
	return nil
}

func newExecutionID() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(value[:])
}
