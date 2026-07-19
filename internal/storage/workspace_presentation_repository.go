package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var ErrWorkspacePresentationRevisionConflict = errors.New("workspace presentation revision conflict")

type WorkspacePresentationKey struct {
	ProfileID string
	CourseID  string
	OwnerKind string
	OwnerID   string
}

type WorkspacePresentationRecord struct {
	Key               WorkspacePresentationKey
	FocusedActivityID *string
	PaneMode          string
	SplitRatio        float64
	UserCollapsed     bool
	Revision          int64
	UpdatedAt         string
}

type WorkspacePresentationWrite struct {
	Key               WorkspacePresentationKey
	FocusedActivityID *string
	PaneMode          string
	SplitRatio        float64
	UserCollapsed     bool
	ExpectedRevision  int64
	At                time.Time
}

type WorkspacePresentationRepository interface {
	Get(context.Context, WorkspacePresentationKey) (*WorkspacePresentationRecord, error)
	Put(context.Context, WorkspacePresentationWrite) (WorkspacePresentationRecord, error)
}

type SQLiteWorkspacePresentationRepository struct{ db *sql.DB }

func NewWorkspacePresentationRepository(db *sql.DB) *SQLiteWorkspacePresentationRepository {
	return &SQLiteWorkspacePresentationRepository{db: db}
}

const selectWorkspacePresentation = `SELECT profile_id, course_id, owner_kind, owner_id,
	focused_activity_id, pane_mode, split_ratio, user_collapsed, revision, updated_at
	FROM workspace_presentation_states
	WHERE profile_id=? AND course_id=? AND owner_kind=? AND owner_id=?`

func (r *SQLiteWorkspacePresentationRepository) Get(ctx context.Context, key WorkspacePresentationKey) (*WorkspacePresentationRecord, error) {
	if err := validateWorkspacePresentationKey(key); err != nil {
		return nil, err
	}
	record, err := scanWorkspacePresentation(r.db.QueryRowContext(ctx, selectWorkspacePresentation, key.ProfileID, key.CourseID, key.OwnerKind, key.OwnerID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("workspace presentation get: %w", err)
	}
	return &record, nil
}

func (r *SQLiteWorkspacePresentationRepository) Put(ctx context.Context, write WorkspacePresentationWrite) (WorkspacePresentationRecord, error) {
	if err := validateWorkspacePresentationWrite(write); err != nil {
		return WorkspacePresentationRecord{}, err
	}
	if write.At.IsZero() {
		write.At = time.Now()
	}
	updatedAt := write.At.UTC().Format(time.RFC3339Nano)
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation begin: %w", err)
	}
	defer tx.Rollback()
	current, err := scanWorkspacePresentation(tx.QueryRowContext(ctx, selectWorkspacePresentation, write.Key.ProfileID, write.Key.CourseID, write.Key.OwnerKind, write.Key.OwnerID))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		if write.ExpectedRevision != 0 {
			return WorkspacePresentationRecord{}, ErrWorkspacePresentationRevisionConflict
		}
		collapsed := 0
		if write.UserCollapsed {
			collapsed = 1
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO workspace_presentation_states(
			profile_id, course_id, owner_kind, owner_id, focused_activity_id, pane_mode,
			split_ratio, user_collapsed, revision, updated_at) VALUES(?,?,?,?,?,?,?,?,1,?)`,
			write.Key.ProfileID, write.Key.CourseID, write.Key.OwnerKind, write.Key.OwnerID,
			write.FocusedActivityID, write.PaneMode, write.SplitRatio, collapsed, updatedAt)
		if err != nil {
			return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation insert: %w", err)
		}
	case err != nil:
		return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation read current: %w", err)
	default:
		if current.Revision != write.ExpectedRevision {
			return WorkspacePresentationRecord{}, ErrWorkspacePresentationRevisionConflict
		}
		collapsed := 0
		if write.UserCollapsed {
			collapsed = 1
		}
		result, err := tx.ExecContext(ctx, `UPDATE workspace_presentation_states SET
			focused_activity_id=?, pane_mode=?, split_ratio=?, user_collapsed=?,
			revision=revision+1, updated_at=?
			WHERE profile_id=? AND course_id=? AND owner_kind=? AND owner_id=? AND revision=?`,
			write.FocusedActivityID, write.PaneMode, write.SplitRatio, collapsed, updatedAt,
			write.Key.ProfileID, write.Key.CourseID, write.Key.OwnerKind, write.Key.OwnerID, write.ExpectedRevision)
		if err != nil {
			return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation update: %w", err)
		}
		rows, err := result.RowsAffected()
		if err != nil {
			return WorkspacePresentationRecord{}, err
		}
		if rows != 1 {
			return WorkspacePresentationRecord{}, ErrWorkspacePresentationRevisionConflict
		}
	}
	record, err := scanWorkspacePresentation(tx.QueryRowContext(ctx, selectWorkspacePresentation, write.Key.ProfileID, write.Key.CourseID, write.Key.OwnerKind, write.Key.OwnerID))
	if err != nil {
		return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation read result: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return WorkspacePresentationRecord{}, fmt.Errorf("workspace presentation commit: %w", err)
	}
	return record, nil
}

func validateWorkspacePresentationKey(key WorkspacePresentationKey) error {
	if key.ProfileID == "" || key.CourseID == "" || key.OwnerID == "" {
		return errors.New("workspace presentation key fields are required")
	}
	if key.OwnerKind != "lessons" && key.OwnerKind != "assessments" {
		return errors.New("workspace presentation owner kind is invalid")
	}
	return nil
}

func validateWorkspacePresentationWrite(write WorkspacePresentationWrite) error {
	if err := validateWorkspacePresentationKey(write.Key); err != nil {
		return err
	}
	if write.PaneMode != "collapsed" && write.PaneMode != "split" && write.PaneMode != "expanded" {
		return errors.New("workspace presentation pane mode is invalid")
	}
	if write.ExpectedRevision < 0 {
		return errors.New("workspace presentation expected revision is invalid")
	}
	return nil
}

func scanWorkspacePresentation(row rowScanner) (WorkspacePresentationRecord, error) {
	var record WorkspacePresentationRecord
	var focus sql.NullString
	var collapsed int
	err := row.Scan(&record.Key.ProfileID, &record.Key.CourseID, &record.Key.OwnerKind, &record.Key.OwnerID,
		&focus, &record.PaneMode, &record.SplitRatio, &collapsed, &record.Revision, &record.UpdatedAt)
	if err != nil {
		return WorkspacePresentationRecord{}, err
	}
	if focus.Valid {
		value := focus.String
		record.FocusedActivityID = &value
	}
	record.UserCollapsed = collapsed == 1
	return record, nil
}
