package progression

import "context"

// ActivitySetProgressProvider supplies Course Schema 1.2 activity completion
// without coupling progression evaluation to the activity persistence package.
type ActivitySetProgressProvider interface {
	Progress(context.Context, ActivitySetKey) (ActivitySetProgress, error)
}
