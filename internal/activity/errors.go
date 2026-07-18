package activity

import "errors"

var (
	ErrActivityNotFound     = errors.New("activity not found")
	ErrActivitySetNotFound  = errors.New("activity set not found")
	ErrMalformedAnswer      = errors.New("malformed activity answer")
	ErrRevisionConflict     = errors.New("activity attempt revision conflict")
	ErrMaxAttemptsReached   = errors.New("activity maximum attempts reached")
	ErrEvaluatorUnavailable = errors.New("activity evaluator unavailable")
)
