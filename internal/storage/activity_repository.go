package storage

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const (
	ActivityAttemptStatusDraft     = "DRAFT"
	ActivityAttemptStatusSubmitted = "SUBMITTED"
	ActivityAttemptStatusEvaluated = "EVALUATED"
)

var (
	ErrActivityRevisionConflict = errors.New("activity attempt revision conflict")
	ErrActivityAttemptImmutable = errors.New("activity attempt is immutable")
	ErrActivityAttemptNotFound  = errors.New("activity attempt not found")
)

type AttemptIdentity struct {
	CourseID      string
	CourseVersion string
	OwnerKind     string
	OwnerID       string
	ActivityID    string
}

type OwnerIdentity struct {
	CourseID      string
	CourseVersion string
	OwnerKind     string
	OwnerID       string
}

type ActivityAttemptRecord struct {
	ID             string
	CourseID       string
	CourseVersion  string
	OwnerKind      string
	OwnerID        string
	ActivityID     string
	AttemptNumber  int
	Status         string
	AnswerJSON     []byte
	FeedbackJSON   []byte
	Score          *float64
	MaxScore       *float64
	Passed         *bool
	Seed           int64
	Revision       int64
	IdempotencyKey *string
	StartedAt      string
	UpdatedAt      string
	SubmittedAt    *string
	EvaluatedAt    *string
}

type DraftWrite struct {
	Identity         AttemptIdentity
	AnswerJSON       []byte
	ExpectedRevision int64
	Seed             int64
	At               time.Time
}

type SubmissionWrite struct {
	Identity       AttemptIdentity
	AnswerJSON     []byte
	IdempotencyKey string
	Seed           int64
	At             time.Time
}

type EvaluationWrite struct {
	AttemptID    string
	FeedbackJSON []byte
	Score        *float64
	MaxScore     *float64
	Passed       *bool
	At           time.Time
}

type ActivityRepository interface {
	CurrentDraft(context.Context, AttemptIdentity) (*ActivityAttemptRecord, error)
	SaveDraft(context.Context, DraftWrite) (ActivityAttemptRecord, error)
	CreateSubmission(context.Context, SubmissionWrite) (ActivityAttemptRecord, bool, error)
	UpdateEvaluation(context.Context, EvaluationWrite) (ActivityAttemptRecord, error)
	ListOwnerAttempts(context.Context, OwnerIdentity) ([]ActivityAttemptRecord, error)
}

type SQLiteActivityRepository struct {
	db *sql.DB
}

func NewActivityRepository(db *sql.DB) *SQLiteActivityRepository {
	return &SQLiteActivityRepository{db: db}
}

func (r *SQLiteActivityRepository) CurrentDraft(ctx context.Context, identity AttemptIdentity) (*ActivityAttemptRecord, error) {
	row := r.db.QueryRowContext(ctx, selectActivityAttempt+`
		WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=? AND activity_id=?
		AND attempt_number=0 AND status='DRAFT'`, identity.CourseID, identity.CourseVersion, identity.OwnerKind, identity.OwnerID, identity.ActivityID)
	record, err := scanActivityAttempt(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("activity repository current draft: %w", err)
	}
	return &record, nil
}

func (r *SQLiteActivityRepository) SaveDraft(ctx context.Context, write DraftWrite) (ActivityAttemptRecord, error) {
	if err := validateAttemptIdentity(write.Identity); err != nil {
		return ActivityAttemptRecord{}, err
	}
	answer, err := canonicalJSON(write.AnswerJSON)
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: answer: %w", err)
	}
	at := normalizedTime(write.At)
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: begin: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, selectActivityAttempt+`
		WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=? AND activity_id=?
		AND attempt_number=0 AND status='DRAFT'`, write.Identity.CourseID, write.Identity.CourseVersion, write.Identity.OwnerKind, write.Identity.OwnerID, write.Identity.ActivityID)
	current, scanErr := scanActivityAttempt(row)
	switch {
	case errors.Is(scanErr, sql.ErrNoRows):
		if write.ExpectedRevision != 0 {
			return ActivityAttemptRecord{}, ErrActivityRevisionConflict
		}
		current = ActivityAttemptRecord{
			ID:            newActivityAttemptID(),
			CourseID:      write.Identity.CourseID,
			CourseVersion: write.Identity.CourseVersion,
			OwnerKind:     write.Identity.OwnerKind,
			OwnerID:       write.Identity.OwnerID,
			ActivityID:    write.Identity.ActivityID,
			AttemptNumber: 0,
			Status:        ActivityAttemptStatusDraft,
			AnswerJSON:    answer,
			FeedbackJSON:  []byte(`{}`),
			Seed:          write.Seed,
			Revision:      1,
			StartedAt:     at,
			UpdatedAt:     at,
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO activity_attempts(
			id,course_id,course_version,owner_kind,owner_id,activity_id,attempt_number,status,
			answer_json,feedback_json,seed,revision,started_at,updated_at
		) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, current.ID, current.CourseID, current.CourseVersion, current.OwnerKind, current.OwnerID, current.ActivityID, current.AttemptNumber, current.Status, string(current.AnswerJSON), string(current.FeedbackJSON), current.Seed, current.Revision, current.StartedAt, current.UpdatedAt); err != nil {
			return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: insert: %w", err)
		}
	case scanErr != nil:
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: select: %w", scanErr)
	default:
		if current.Revision != write.ExpectedRevision {
			return ActivityAttemptRecord{}, ErrActivityRevisionConflict
		}
		result, err := tx.ExecContext(ctx, `UPDATE activity_attempts
			SET answer_json=?,seed=?,revision=revision+1,updated_at=?
			WHERE id=? AND status='DRAFT' AND revision=?`, string(answer), write.Seed, at, current.ID, write.ExpectedRevision)
		if err != nil {
			return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: update: %w", err)
		}
		changed, err := result.RowsAffected()
		if err != nil {
			return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: rows affected: %w", err)
		}
		if changed != 1 {
			return ActivityAttemptRecord{}, ErrActivityRevisionConflict
		}
		current.AnswerJSON = answer
		current.Seed = write.Seed
		current.Revision++
		current.UpdatedAt = at
	}
	if err := tx.Commit(); err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository save draft: commit: %w", err)
	}
	return current, nil
}

func (r *SQLiteActivityRepository) CreateSubmission(ctx context.Context, write SubmissionWrite) (ActivityAttemptRecord, bool, error) {
	if err := validateAttemptIdentity(write.Identity); err != nil {
		return ActivityAttemptRecord{}, false, err
	}
	answer, err := canonicalJSON(write.AnswerJSON)
	if err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: answer: %w", err)
	}
	at := normalizedTime(write.At)
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: begin: %w", err)
	}
	defer tx.Rollback()

	if write.IdempotencyKey != "" {
		row := tx.QueryRowContext(ctx, selectActivityAttempt+`
			WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=? AND activity_id=? AND idempotency_key=?`, write.Identity.CourseID, write.Identity.CourseVersion, write.Identity.OwnerKind, write.Identity.OwnerID, write.Identity.ActivityID, write.IdempotencyKey)
		existing, scanErr := scanActivityAttempt(row)
		if scanErr == nil {
			if err := tx.Commit(); err != nil {
				return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: commit existing: %w", err)
			}
			return existing, false, nil
		}
		if !errors.Is(scanErr, sql.ErrNoRows) {
			return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: idempotency lookup: %w", scanErr)
		}
	}

	var attemptNumber int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(attempt_number),0)+1 FROM activity_attempts
		WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=? AND activity_id=?`, write.Identity.CourseID, write.Identity.CourseVersion, write.Identity.OwnerKind, write.Identity.OwnerID, write.Identity.ActivityID).Scan(&attemptNumber); err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: allocate attempt: %w", err)
	}
	record := ActivityAttemptRecord{
		ID:            newActivityAttemptID(),
		CourseID:      write.Identity.CourseID,
		CourseVersion: write.Identity.CourseVersion,
		OwnerKind:     write.Identity.OwnerKind,
		OwnerID:       write.Identity.OwnerID,
		ActivityID:    write.Identity.ActivityID,
		AttemptNumber: attemptNumber,
		Status:        ActivityAttemptStatusSubmitted,
		AnswerJSON:    answer,
		FeedbackJSON:  []byte(`{}`),
		Seed:          write.Seed,
		Revision:      1,
		StartedAt:     at,
		UpdatedAt:     at,
		SubmittedAt:   &at,
	}
	var idempotency any
	if write.IdempotencyKey != "" {
		record.IdempotencyKey = &write.IdempotencyKey
		idempotency = write.IdempotencyKey
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO activity_attempts(
		id,course_id,course_version,owner_kind,owner_id,activity_id,attempt_number,status,
		answer_json,feedback_json,seed,revision,idempotency_key,started_at,updated_at,submitted_at
	) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, record.ID, record.CourseID, record.CourseVersion, record.OwnerKind, record.OwnerID, record.ActivityID, record.AttemptNumber, record.Status, string(record.AnswerJSON), string(record.FeedbackJSON), record.Seed, record.Revision, idempotency, record.StartedAt, record.UpdatedAt, at); err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: insert: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM activity_attempts WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=? AND activity_id=? AND attempt_number=0 AND status='DRAFT'`, write.Identity.CourseID, write.Identity.CourseVersion, write.Identity.OwnerKind, write.Identity.OwnerID, write.Identity.ActivityID); err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: consume draft: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return ActivityAttemptRecord{}, false, fmt.Errorf("activity repository create submission: commit: %w", err)
	}
	return record, true, nil
}

func (r *SQLiteActivityRepository) UpdateEvaluation(ctx context.Context, write EvaluationWrite) (ActivityAttemptRecord, error) {
	feedback, err := canonicalJSON(write.FeedbackJSON)
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository update evaluation: feedback: %w", err)
	}
	at := normalizedTime(write.At)
	result, err := r.db.ExecContext(ctx, `UPDATE activity_attempts SET
		status='EVALUATED',feedback_json=?,score=?,max_score=?,passed=?,evaluated_at=?,updated_at=?,revision=revision+1
		WHERE id=? AND status='SUBMITTED'`, string(feedback), nullableFloat(write.Score), nullableFloat(write.MaxScore), nullableBool(write.Passed), at, at, write.AttemptID)
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository update evaluation: update: %w", err)
	}
	changed, err := result.RowsAffected()
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository update evaluation: rows affected: %w", err)
	}
	if changed != 1 {
		var status string
		err := r.db.QueryRowContext(ctx, `SELECT status FROM activity_attempts WHERE id=?`, write.AttemptID).Scan(&status)
		if errors.Is(err, sql.ErrNoRows) {
			return ActivityAttemptRecord{}, ErrActivityAttemptNotFound
		}
		if err != nil {
			return ActivityAttemptRecord{}, fmt.Errorf("activity repository update evaluation: status: %w", err)
		}
		return ActivityAttemptRecord{}, ErrActivityAttemptImmutable
	}
	row := r.db.QueryRowContext(ctx, selectActivityAttempt+` WHERE id=?`, write.AttemptID)
	record, err := scanActivityAttempt(row)
	if err != nil {
		return ActivityAttemptRecord{}, fmt.Errorf("activity repository update evaluation: read: %w", err)
	}
	return record, nil
}

func (r *SQLiteActivityRepository) ListOwnerAttempts(ctx context.Context, owner OwnerIdentity) ([]ActivityAttemptRecord, error) {
	rows, err := r.db.QueryContext(ctx, selectActivityAttempt+`
		WHERE course_id=? AND course_version=? AND owner_kind=? AND owner_id=?
		ORDER BY CASE WHEN attempt_number=0 THEN 1 ELSE 0 END, activity_id, attempt_number`, owner.CourseID, owner.CourseVersion, owner.OwnerKind, owner.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("activity repository list owner attempts: %w", err)
	}
	defer rows.Close()
	var records []ActivityAttemptRecord
	for rows.Next() {
		record, err := scanActivityAttempt(rows)
		if err != nil {
			return nil, fmt.Errorf("activity repository list owner attempts: scan: %w", err)
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("activity repository list owner attempts: rows: %w", err)
	}
	return records, nil
}

const selectActivityAttempt = `SELECT id,course_id,course_version,owner_kind,owner_id,activity_id,
	attempt_number,status,answer_json,feedback_json,score,max_score,passed,seed,revision,
	idempotency_key,started_at,updated_at,submitted_at,evaluated_at FROM activity_attempts`

type rowScanner interface {
	Scan(...any) error
}

func scanActivityAttempt(scanner rowScanner) (ActivityAttemptRecord, error) {
	var record ActivityAttemptRecord
	var answer, feedback string
	var score, maxScore sql.NullFloat64
	var passed sql.NullBool
	var idempotencyKey, submittedAt, evaluatedAt sql.NullString
	if err := scanner.Scan(&record.ID, &record.CourseID, &record.CourseVersion, &record.OwnerKind, &record.OwnerID, &record.ActivityID, &record.AttemptNumber, &record.Status, &answer, &feedback, &score, &maxScore, &passed, &record.Seed, &record.Revision, &idempotencyKey, &record.StartedAt, &record.UpdatedAt, &submittedAt, &evaluatedAt); err != nil {
		return ActivityAttemptRecord{}, err
	}
	record.AnswerJSON = []byte(answer)
	record.FeedbackJSON = []byte(feedback)
	if score.Valid {
		record.Score = &score.Float64
	}
	if maxScore.Valid {
		record.MaxScore = &maxScore.Float64
	}
	if passed.Valid {
		record.Passed = &passed.Bool
	}
	if idempotencyKey.Valid {
		record.IdempotencyKey = &idempotencyKey.String
	}
	if submittedAt.Valid {
		record.SubmittedAt = &submittedAt.String
	}
	if evaluatedAt.Valid {
		record.EvaluatedAt = &evaluatedAt.String
	}
	return record, nil
}

func validateAttemptIdentity(identity AttemptIdentity) error {
	if identity.CourseID == "" || identity.CourseVersion == "" || identity.OwnerID == "" || identity.ActivityID == "" {
		return errors.New("activity repository: incomplete attempt identity")
	}
	if identity.OwnerKind != "lesson" && identity.OwnerKind != "assessment" {
		return fmt.Errorf("activity repository: unsupported owner kind %q", identity.OwnerKind)
	}
	return nil
}

func canonicalJSON(value []byte) ([]byte, error) {
	if len(value) == 0 {
		value = []byte(`{}`)
	}
	if !json.Valid(value) {
		return nil, errors.New("invalid JSON")
	}
	var decoded any
	if err := json.Unmarshal(value, &decoded); err != nil {
		return nil, err
	}
	return json.Marshal(decoded)
}

func normalizedTime(value time.Time) string {
	if value.IsZero() {
		value = time.Now()
	}
	return value.UTC().Format(time.RFC3339Nano)
}

func newActivityAttemptID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		panic(fmt.Sprintf("activity repository: random id: %v", err))
	}
	return hex.EncodeToString(raw[:])
}

func nullableFloat(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableBool(value *bool) any {
	if value == nil {
		return nil
	}
	if *value {
		return 1
	}
	return 0
}
