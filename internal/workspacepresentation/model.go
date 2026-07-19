package workspacepresentation

import (
	"context"
	"errors"
	"fmt"
	"time"
)

const LocalProfileID = "local"
const DefaultSplitRatio = 0.45
const MinSplitRatio = 0.32
const MaxSplitRatio = 0.68

var (
	ErrOwnerInvalid                      = errors.New("workspace presentation owner invalid")
	ErrActivityInvalid                   = errors.New("workspace presentation activity invalid")
	ErrActivityPracticeSurfaceNotAllowed = errors.New("workspace presentation activity practice surface not allowed")
	ErrActivityFullscreenNotSupported    = errors.New("workspace presentation activity fullscreen not supported")
	ErrPaneModeInvalid                   = errors.New("workspace presentation pane mode invalid")
)

type Owner struct {
	CourseID  string
	OwnerKind string
	OwnerID   string
}

type State struct {
	CourseID          string  `json:"courseId"`
	OwnerKind         string  `json:"ownerKind"`
	OwnerID           string  `json:"ownerId"`
	FocusedActivityID *string `json:"focusedActivityId"`
	PaneMode          string  `json:"paneMode"`
	SplitRatio        float64 `json:"splitRatio"`
	UserCollapsed     bool    `json:"userCollapsed"`
	Revision          int64   `json:"revision"`
	UpdatedAt         string  `json:"updatedAt"`
}

func (s State) Owner() Owner {
	return Owner{CourseID: s.CourseID, OwnerKind: s.OwnerKind, OwnerID: s.OwnerID}
}

type UpdateCommand struct {
	Owner             Owner
	ProfileID         string
	FocusedActivityID *string
	PaneMode          string
	SplitRatio        float64
	UserCollapsed     bool
	Revision          int64
	At                time.Time
}

type ConflictError struct{ Current State }

func (e ConflictError) Error() string {
	return fmt.Sprintf("workspace presentation revision conflict; current revision %d", e.Current.Revision)
}

type Service interface {
	Get(context.Context, string, Owner) (State, error)
	Update(context.Context, UpdateCommand) (State, error)
}
