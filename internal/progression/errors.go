package progression

import "fmt"

type NavigationTarget struct{ Type, ID string }

type UnknownItemError struct{ ItemID string }

func (e *UnknownItemError) Error() string {
	return fmt.Sprintf("unknown progression item %q", e.ItemID)
}

type ItemLockedError struct {
	ItemID      string
	CurrentItem NavigationTarget
	Blocking    []RequirementView
}

func (e *ItemLockedError) Error() string { return "item locked" }
