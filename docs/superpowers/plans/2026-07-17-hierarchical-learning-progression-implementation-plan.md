# Hierarchical Learning Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current linear lesson-only progression with an authoritative Go progression engine for courses, chapters, lessons, lesson practices, chapter assessments, review navigation, and backend-authored next actions.

**Architecture:** Normalize Course Schema 1.0/1.1 into a runtime course graph, evaluate completion through a single requirement engine, persist best/latest practice outcomes separately, and expose learner navigation through typed HTTP responses. React renders server-authored state in `syn-lesson-progress` and a requirement-aware lesson footer; it never reimplements unlock or completion rules.

**Tech Stack:** Go 1.26.5, SQLite via `modernc.org/sqlite`, JSON Schema/generated Go contracts, React 19, TypeScript 5, TanStack Query, Vitest, Playwright, pnpm 11.

## Global Constraints

- V1 progression policy is strict sequential progression for required lessons and required chapters.
- Optional lessons, practices, assessments, and chapters never block required progression.
- Completion is derived from satisfied requirements; navigation CTAs do not manually mark chapters or courses complete.
- `bestResult` is authoritative for requirement satisfaction; `latestResult` is informational and may regress without revoking completion.
- Opening a completed lesson is a read/navigation operation and must not mutate persisted progression.
- `currentLessonId` and `viewedLessonId` are separate concepts.
- Workspace reset never rolls back lesson, chapter, or course completion.
- React must render backend-authored `nextAction`; it must not duplicate requirement evaluation.
- Existing Course Schema 1.0 courses remain valid through implicit single-chapter normalization.
- Existing short lesson URLs remain supported as compatibility redirects during migration.
- All state-changing operations must remain loopback-authenticated and return typed API errors.

---

## File Structure

### New Go domain files

- `internal/progression/model.go` — runtime graph, progress states, requirement views, navigation, and next-action types.
- `internal/progression/normalize.go` — Course Schema 1.0/1.1 normalization into the runtime graph.
- `internal/progression/evaluator.go` — pure completion, unlock, and next-action evaluation.
- `internal/progression/errors.go` — typed domain errors with blocking requirements.
- `internal/progression/store.go` — persistence interface used by the evaluator/service.
- `internal/progression/navigation.go` — review-mode and return-target construction.

### New storage files

- `internal/storage/migrations/003_hierarchical_progress.sql` — chapter, practice-attempt, and assessment progress tables plus migration metadata.
- `internal/storage/hierarchical_progress_repository.go` — transactional implementation of `progression.Store`.

### New server files

- `internal/server/navigation_handlers.go` — course navigation and canonical learner-view endpoints.
- `internal/server/chapter_assessment_handlers.go` — chapter assessment read/action endpoints.
- `internal/server/progression_errors.go` — typed domain-to-HTTP error mapping.

### New React files

- `apps/web/src/features/learning-progress/types.ts` — browser-facing navigation and next-action types.
- `apps/web/src/features/learning-progress/SynLessonProgress.tsx` — hierarchical course/chapter/lesson/assessment navigator.
- `apps/web/src/features/learning-progress/SynLessonProgress.test.tsx` — interaction and accessibility tests.
- `apps/web/src/features/lesson-progress/LessonRequirementFooter.tsx` — single requirement-aware CTA/footer.
- `apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx` — CTA mapping tests.
- `apps/web/src/features/review-mode/ReviewBanner.tsx` — review context and return-to-current action.

### Existing files to modify

- `packages/course-schema/schemas/course-v1.schema.json` — add backward-compatible chapter and assessment structures under schema version 1.1.
- `packages/course-schema/src/index.ts` — export generated/validated chapter types.
- `packages/protocol/src/index.ts` — navigation, requirement, review, and next-action API contracts.
- `internal/course/service.go` — expose course definition and practice metadata needed by normalization.
- `internal/course/filesystem_service.go` — delegate progression decisions to the new service and stop using in-memory linear state as authority.
- `internal/progression/service.go` — orchestrate transactional mutations through evaluator + store.
- `internal/storage/progress_repository.go` — retain compatibility reads while delegating new writes to hierarchical repository.
- `internal/server/router.go` — register navigation, canonical URLs, assessment, and compatibility routes.
- `internal/server/course_handlers.go` — return lesson view context and deprecate manual completion semantics.
- `apps/web/src/shared/api/client.ts` — typed navigation and assessment API methods.
- `apps/web/src/app/router/lesson-route.ts` — canonical chapter-aware URL parsing and compatibility support.
- `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx` — load navigation + viewed lesson independently.
- `apps/web/src/features/lesson-content/LessonPanel.tsx` — replace old completion buttons with footer/review banner.
- `apps/web/src/application.css` — navigator, review, footer, locked-reason, and responsive styles.
- `examples/frontend-performance-foundations/course.json` — migrate example to explicit chapters and chapter assessment.
- `docs/course-authoring/course-format-v1.md` — document schema 1.1 and migration rules.
- `docs/architecture/go-core.md` — document requirement engine and navigation boundaries.

---

### Task 1: Add Course Schema 1.1 Chapters and Assessments

**Files:**
- Modify: `packages/course-schema/schemas/course-v1.schema.json`
- Modify: `packages/course-schema/src/index.ts`
- Modify: `packages/course-schema/src/index.test.ts`
- Modify: `internal/contracts/validator_test.go`
- Create: `tests/fixtures/valid-chapter-course/course.json`
- Create: `tests/fixtures/invalid-chapter-course/course.json`

**Interfaces:**
- Consumes: existing Course Schema 1.0 `lessons` array and exercise schema.
- Produces: validated `chapters[]`, `ChapterLessonReference`, `ChapterAssessmentDefinition`, `CompletionRule`, while preserving schema 1.0 input.

- [ ] **Step 1: Add failing TypeScript schema tests**

```ts
it('accepts a schema 1.1 course with required and optional chapter items', () => {
  const result = validateCourse({
    schemaVersion: '1.1.0',
    id: 'runtime-course',
    title: 'Runtime Course',
    version: '1.0.0',
    chapters: [
      {
        id: 'runtime',
        title: 'Runtime',
        required: true,
        lessons: [
          { id: 'call-stack', required: true },
          { id: 'deep-dive', required: false },
        ],
        assessments: [
          {
            id: 'runtime-capstone',
            title: 'Runtime Capstone',
            required: true,
            path: 'assessments/runtime-capstone',
            requiresLessons: ['call-stack'],
            completion: { type: 'all-required-checks' },
          },
        ],
      },
    ],
  });
  expect(result.ok).toBe(true);
});

it('rejects an assessment prerequisite that references a lesson outside its chapter', () => {
  const result = validateCourse(invalidCrossChapterPrerequisiteFixture);
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
pnpm vitest run packages/course-schema/src/index.test.ts
```

Expected: FAIL because `chapters` and chapter assessment fields are not recognized.

- [ ] **Step 3: Extend JSON Schema without breaking 1.0**

Add a `oneOf` course structure:

```json
{
  "oneOf": [
    { "required": ["lessons"], "not": { "required": ["chapters"] } },
    { "required": ["chapters"], "not": { "required": ["lessons"] } }
  ]
}
```

Define exact reusable structures:

```json
{
  "$defs": {
    "chapterLessonReference": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "required"],
      "properties": {
        "id": { "$ref": "#/$defs/id" },
        "required": { "type": "boolean" }
      }
    },
    "completionRule": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type"],
          "properties": { "type": { "const": "all-required-checks" } }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["type", "threshold"],
          "properties": {
            "type": { "const": "minimum-score" },
            "threshold": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      ]
    }
  }
}
```

- [ ] **Step 4: Add semantic validation for IDs and prerequisites**

In `packages/course-schema/src/index.ts`, validate after JSON Schema parsing:

```ts
for (const chapter of course.chapters ?? []) {
  const lessonIds = new Set(chapter.lessons.map((lesson) => lesson.id));
  for (const assessment of chapter.assessments) {
    for (const prerequisite of assessment.requiresLessons) {
      if (!lessonIds.has(prerequisite)) {
        issues.push({
          path: `chapters.${chapter.id}.assessments.${assessment.id}.requiresLessons`,
          message: `Lesson ${prerequisite} is not declared in chapter ${chapter.id}.`,
        });
      }
    }
  }
}
```

- [ ] **Step 5: Regenerate contracts and run cross-language validation**

Run:

```bash
pnpm contracts:generate
pnpm contracts:check
pnpm vitest run packages/course-schema/src/index.test.ts tests/conformance/contracts/conformance.test.ts
GOTOOLCHAIN=go1.26.5 go test ./internal/contracts
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/course-schema internal/contracts tests/fixtures/valid-chapter-course tests/fixtures/invalid-chapter-course generated
git commit -m "feat: add hierarchical course schema"
```

---

### Task 2: Normalize Linear and Hierarchical Courses into a Runtime Graph

**Files:**
- Create: `internal/progression/model.go`
- Create: `internal/progression/normalize.go`
- Create: `internal/progression/normalize_test.go`
- Modify: `internal/course/lesson_source.go`

**Interfaces:**
- Consumes: generated `contracts.CourseManifest` and lesson exercise metadata.
- Produces:

```go
func NormalizeCourse(manifest contracts.CourseManifest, lessons []LessonDefinition) (CourseGraph, error)
```

- [ ] **Step 1: Write failing normalization tests**

```go
func TestNormalizeLinearCourseCreatesImplicitChapter(t *testing.T) {
    graph, err := NormalizeCourse(linearManifest(), []LessonDefinition{
        {ID: "main-thread", Position: 1, Required: true},
        {ID: "event-loop", Position: 2, Required: true},
    })
    require.NoError(t, err)
    require.Len(t, graph.Chapters, 1)
    assert.Equal(t, "default", graph.Chapters[0].ID)
    assert.Equal(t, []string{"main-thread", "event-loop"}, graph.Chapters[0].RequiredLessonIDs())
}

func TestNormalizeHierarchicalCoursePreservesOptionalItems(t *testing.T) {
    graph, err := NormalizeCourse(chapterManifest(), lessonDefinitions())
    require.NoError(t, err)
    assert.False(t, graph.Chapters[0].Lessons[2].Required)
    assert.False(t, graph.Chapters[0].Assessments[1].Required)
}
```

- [ ] **Step 2: Run RED test**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run Normalize -count=1
```

Expected: FAIL because `CourseGraph` and `NormalizeCourse` do not exist.

- [ ] **Step 3: Define focused runtime graph types**

```go
type CourseGraph struct {
    ID          string
    Version     string
    Chapters    []Chapter
    LessonIndex map[string]LessonRef
}

type Chapter struct {
    ID          string
    Title       string
    Position    int
    Required    bool
    Lessons     []LessonRef
    Assessments []Assessment
}

type LessonRef struct {
    ID        string
    ChapterID string
    Position  int
    Required  bool
    ReadingRequired bool
    Practices []Practice
}

type Practice struct {
    ID       string
    Title    string
    Required bool
    Rule     CompletionRule
}
```

- [ ] **Step 4: Implement schema 1.0 implicit-chapter normalization**

Use `default` as the internal chapter ID only for schema 1.0. Preserve original lesson positions and treat every schema 1.0 lesson as required.

- [ ] **Step 5: Implement schema 1.1 normalization and validation**

Return `ErrInvalidCourseGraph` for duplicate chapter IDs, duplicate lesson membership, unknown lesson IDs, duplicate assessment IDs, and invalid threshold values.

- [ ] **Step 6: Run package tests and fuzz malformed ordering**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run 'Normalize|CourseGraph' -count=20
```

Expected: PASS twenty consecutive runs.

- [ ] **Step 7: Commit**

```bash
git add internal/progression/model.go internal/progression/normalize.go internal/progression/normalize_test.go internal/course/lesson_source.go
git commit -m "feat: normalize hierarchical course graph"
```

---

### Task 3: Implement the Pure Requirement Evaluator

**Files:**
- Create: `internal/progression/evaluator.go`
- Create: `internal/progression/evaluator_test.go`
- Create: `internal/progression/errors.go`

**Interfaces:**
- Consumes: `CourseGraph`, immutable `ProgressSnapshot`, and an optional viewed item.
- Produces:

```go
func Evaluate(graph CourseGraph, snapshot ProgressSnapshot) Evaluation
func EvaluateLesson(graph CourseGraph, snapshot ProgressSnapshot, lessonID string) (LessonEvaluation, error)
```

- [ ] **Step 1: Write table-driven RED tests for all completion shapes**

```go
func TestEvaluateLessonCompletion(t *testing.T) {
    tests := []struct {
        name string
        lesson LessonRef
        progress LessonProgress
        complete bool
    }{
        {"reading only", readingOnlyLesson(), progressWithReading(), true},
        {"required practice missing", mixedLesson(), progressWithReading(), false},
        {"required practice passed", mixedLesson(), progressWithBestPass(), true},
        {"optional practice failed", optionalPracticeLesson(), progressWithLatestFailure(), true},
        {"practice only", practiceOnlyLesson(), progressWithBestPass(), true},
    }
    // Execute EvaluateLesson and assert complete for every row.
}
```

Also add tests for:

```go
func TestLaterFailedAttemptDoesNotRevokeBestPass(t *testing.T)
func TestChapterEntersAssessmentRequired(t *testing.T)
func TestChapterWithoutRequiredAssessmentCompletesAutomatically(t *testing.T)
func TestOptionalLessonDoesNotBlockChapter(t *testing.T)
func TestNextRequiredChapterUnlocksOnlyAfterCurrentCompletes(t *testing.T)
```

- [ ] **Step 2: Run RED test**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run 'Evaluate|Completion|Unlock' -count=1
```

Expected: FAIL because evaluator functions do not exist.

- [ ] **Step 3: Define persistent-neutral progress snapshots**

```go
type ProgressSnapshot struct {
    Course     CourseProgress
    Chapters   map[string]ChapterProgress
    Lessons    map[string]LessonProgress
    Practices  map[PracticeKey]PracticeProgress
    Assessments map[AssessmentKey]PracticeProgress
}

type AttemptResult struct {
    Passed      bool
    Score       *float64
    CompletedAt time.Time
    Summary     string
}
```

- [ ] **Step 4: Implement completion as pure predicates**

```go
func practiceSatisfied(progress PracticeProgress) bool {
    return progress.BestResult != nil && progress.BestResult.Passed
}

func lessonSatisfied(lesson LessonRef, snapshot ProgressSnapshot) bool {
    progress := snapshot.Lessons[lesson.ID]
    if lesson.ReadingRequired && !progress.ReadingCompleted {
        return false
    }
    for _, practice := range lesson.Practices {
        if practice.Required && !practiceSatisfied(snapshot.Practices[PracticeKey{LessonID: lesson.ID, PracticeID: practice.ID}]) {
            return false
        }
    }
    return true
}
```

- [ ] **Step 5: Implement status derivation and unlock transitions**

Ensure:

```text
required lesson complete → next required lesson AVAILABLE
all required lessons complete + pending required assessment → ASSESSMENT_REQUIRED
all required chapter requirements complete → chapter COMPLETED
required chapter complete → next required chapter AVAILABLE
```

Optional lessons become `AVAILABLE` when their chapter becomes available.

- [ ] **Step 6: Implement typed blocking errors**

```go
type ItemLockedError struct {
    ItemID       string
    CurrentItem  NavigationTarget
    Blocking     []RequirementView
}

func (e *ItemLockedError) Error() string { return "item locked" }
```

- [ ] **Step 7: Verify evaluator determinism**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run 'Evaluate|Completion|Unlock|BestResult' -count=50
```

Expected: PASS fifty consecutive runs.

- [ ] **Step 8: Commit**

```bash
git add internal/progression/evaluator.go internal/progression/evaluator_test.go internal/progression/errors.go internal/progression/model.go
git commit -m "feat: evaluate hierarchical requirements"
```

---

### Task 4: Add Hierarchical Progress Persistence and Migration

**Files:**
- Create: `internal/storage/migrations/003_hierarchical_progress.sql`
- Create: `internal/progression/store.go`
- Create: `internal/storage/hierarchical_progress_repository.go`
- Create: `internal/storage/hierarchical_progress_repository_test.go`
- Modify: `internal/storage/migrate_test.go`

**Interfaces:**
- Consumes: `CourseGraph`, evaluator snapshots, mutation transaction callbacks.
- Produces:

```go
type Store interface {
    Initialize(ctx context.Context, tx *sql.Tx, graph CourseGraph) error
    Snapshot(ctx context.Context, q Querier, courseID, version string) (ProgressSnapshot, error)
    AcknowledgeReading(ctx context.Context, tx *sql.Tx, key LessonKey, at time.Time) error
    RecordPracticeAttempt(ctx context.Context, tx *sql.Tx, key PracticeKey, result AttemptResult) error
    RecordAssessmentAttempt(ctx context.Context, tx *sql.Tx, key AssessmentKey, result AttemptResult) error
    ApplyEvaluation(ctx context.Context, tx *sql.Tx, evaluation Evaluation) error
}
```

- [ ] **Step 1: Write migration RED tests**

Assert the migration creates:

```text
chapter_progress
lesson_practice_progress
lesson_practice_attempts
chapter_assessment_progress
chapter_assessment_attempts
```

and preserves existing `lesson_progress` rows from schema 1.0.

- [ ] **Step 2: Run migration tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/storage -run 'Migration|Hierarchical' -count=1
```

Expected: FAIL because migration 003 and repository are absent.

- [ ] **Step 3: Create migration with explicit constraints**

Use primary keys that include course version:

```sql
CREATE TABLE chapter_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  required INTEGER NOT NULL CHECK(required IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('LOCKED','AVAILABLE','IN_PROGRESS','ASSESSMENT_REQUIRED','COMPLETED')),
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY(course_id, version, chapter_id)
);
```

Practice progress stores best/latest results independently. Attempts are append-only.

- [ ] **Step 4: Implement repository decoding with strict null/status validation**

Reject unknown enum strings and missing identifiers with wrapped errors such as:

```text
decode lesson practice progress: invalid status "BROKEN"
```

- [ ] **Step 5: Preserve best result monotonically**

Use a transaction that always updates `latest_*` but updates `best_*` only when the new result improves satisfaction/score:

```sql
best_passed = CASE WHEN best_passed = 1 OR excluded.latest_passed = 1 THEN 1 ELSE 0 END
```

- [ ] **Step 6: Test review regression invariants**

```go
func TestFailedReviewAttemptPreservesBestPassAndCompletion(t *testing.T)
func TestWorkspaceResetDoesNotTouchProgressTables(t *testing.T)
func TestSchema10MigrationCreatesImplicitChapterProgress(t *testing.T)
```

- [ ] **Step 7: Run storage suite repeatedly**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/storage -run 'Hierarchical|Migration|BestResult|Review' -count=20
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add internal/storage/migrations/003_hierarchical_progress.sql internal/storage/hierarchical_progress_repository.go internal/storage/hierarchical_progress_repository_test.go internal/storage/migrate_test.go internal/progression/store.go
git commit -m "feat: persist hierarchical progress"
```

---

### Task 5: Replace Linear Progression Mutations with Transactional Requirement Evaluation

**Files:**
- Modify: `internal/progression/service.go`
- Modify: `internal/progression/service_test.go`
- Modify: `internal/course/service.go`
- Modify: `internal/course/filesystem_service.go`
- Modify: `internal/course/filesystem_progress_test.go`

**Interfaces:**
- Consumes: `progression.Store`, `CourseGraph`, `Evaluate`.
- Produces:

```go
type Service interface {
    Navigation(ctx context.Context, viewed ItemRef) (LearningNavigation, error)
    LessonView(ctx context.Context, lessonID string) (LessonView, error)
    AcknowledgeReading(ctx context.Context, lessonID string) (MutationResult, error)
    RecordLessonPracticeResult(ctx context.Context, lessonID, practiceID string, result AttemptResult) (MutationResult, error)
    RecordChapterAssessmentResult(ctx context.Context, chapterID, assessmentID string, result AttemptResult) (MutationResult, error)
}
```

- [ ] **Step 1: Write RED transaction tests**

```go
func TestAcknowledgeReadingCompletesReadingOnlyLessonAndUnlocksNext(t *testing.T)
func TestAcknowledgeReadingDoesNotCompleteLessonWithRequiredPractice(t *testing.T)
func TestPassingFinalPracticeCompletesLessonAndUnlocksNext(t *testing.T)
func TestPassingChapterAssessmentCompletesChapterAndUnlocksNextChapter(t *testing.T)
func TestFailedReviewAttemptDoesNotMoveCurrentLessonBackward(t *testing.T)
```

- [ ] **Step 2: Run RED tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression ./internal/course -run 'Acknowledge|Practice|Assessment|Review' -count=1
```

Expected: FAIL because the current service performs direct linear state mutation.

- [ ] **Step 3: Implement one transaction boundary per mutation**

```go
func (s *ServiceImpl) mutate(ctx context.Context, fn func(*sql.Tx) error) (MutationResult, error) {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil { return MutationResult{}, err }
    defer tx.Rollback()
    if err := fn(tx); err != nil { return MutationResult{}, err }
    snapshot, err := s.store.Snapshot(ctx, tx, s.graph.ID, s.graph.Version)
    if err != nil { return MutationResult{}, err }
    evaluation := Evaluate(s.graph, snapshot)
    if err := s.store.ApplyEvaluation(ctx, tx, evaluation); err != nil { return MutationResult{}, err }
    if err := tx.Commit(); err != nil { return MutationResult{}, err }
    return MutationResult{Evaluation: evaluation}, nil
}
```

- [ ] **Step 4: Make `CompleteLesson` a deprecated requirement check**

The compatibility method must be idempotent when already complete and return `ErrRequirementUnsatisfied` when required work is missing. It must not directly set `COMPLETED`.

- [ ] **Step 5: Remove `FilesystemService.current` and in-memory status authority**

`FilesystemService` remains responsible for immutable content, workspace, and action resolution. Progress reads and mutations delegate to the persistent progression service.

- [ ] **Step 6: Test restart persistence**

Extend `tests/go-integration/restart_persistence_test.go` to complete reading/practice/chapter assessment, reopen the same database, and assert current chapter/lesson and best results remain intact.

- [ ] **Step 7: Run progression and restart suites**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression ./internal/course ./tests/go-integration -run 'Progress|Restart|Review|Assessment' -count=10
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add internal/progression internal/course tests/go-integration/restart_persistence_test.go
git commit -m "refactor: make requirements authoritative"
```

---

### Task 6: Build Navigation, Review Mode, and Backend-authored Next Actions

**Files:**
- Create: `internal/progression/navigation.go`
- Create: `internal/progression/navigation_test.go`
- Modify: `internal/progression/model.go`

**Interfaces:**
- Consumes: evaluated graph + `viewed ItemRef`.
- Produces:

```go
func BuildNavigation(graph CourseGraph, evaluation Evaluation, viewed ItemRef) (LearningNavigation, error)
func NextActionFor(graph CourseGraph, evaluation Evaluation, viewed ItemRef) NextAction
```

- [ ] **Step 1: Write RED tests for next-action priority**

Cover the exact priority order:

```text
reviewing completed item → RETURN_TO_CURRENT_LESSON
reading missing → ACKNOWLEDGE_READING
required practice not started → START_REQUIRED_PRACTICE
required practice failed → RETRY_REQUIRED_PRACTICE
next lesson available → CONTINUE_TO_LESSON
chapter assessment available → START_CHAPTER_ASSESSMENT
chapter assessment failed → RETRY_CHAPTER_ASSESSMENT
next chapter available → CONTINUE_TO_CHAPTER
course complete → VIEW_COURSE_SUMMARY
otherwise → NONE
```

- [ ] **Step 2: Run RED tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run 'Navigation|NextAction|ReviewMode' -count=1
```

Expected: FAIL.

- [ ] **Step 3: Implement review mode without persistence mutation**

```go
viewMode := ViewModeLearning
if viewed.Kind == ItemLesson && evaluation.Lessons[viewed.ID].Status == StatusCompleted && viewed.ID != evaluation.Course.CurrentLessonID {
    viewMode = ViewModeReview
}
```

Return a `returnTarget` pointing at the current progression item.

- [ ] **Step 4: Add locked-item blocking requirements**

When a requested item is locked, return `ItemLockedError` containing the unsatisfied required requirements and the current target.

- [ ] **Step 5: Verify opening completed lessons is side-effect free**

Use a fake store that counts writes and assert `Navigation` and `LessonView` perform zero writes.

- [ ] **Step 6: Run deterministic navigation tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/progression -run 'Navigation|NextAction|Locked|Review' -count=50
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/progression/navigation.go internal/progression/navigation_test.go internal/progression/model.go
git commit -m "feat: add review-aware learning navigation"
```

---

### Task 7: Expose Navigation and Lesson View Context through Typed Protocols

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/index.test.ts`
- Modify: `packages/web-client/src/client.ts`
- Modify: `packages/web-client/src/index.ts`
- Modify: `internal/contracts/schemas.go`
- Regenerate: `generated/go/contracts/*`

**Interfaces:**
- Consumes: domain navigation types.
- Produces: `CourseNavigationPayload`, `LessonViewContext`, `RequirementView`, `NextActionPayload`, and assessment payloads in both TypeScript and Go.

- [ ] **Step 1: Write RED protocol parsing tests**

```ts
it('accepts a review lesson context with a return target', () => {
  expect(parseLessonViewContext({
    chapterId: 'runtime',
    status: 'COMPLETED',
    required: true,
    readingCompleted: true,
    requirements: [],
    viewMode: 'REVIEW',
    currentLessonId: 'rendering',
    returnTarget: { type: 'LESSON', chapterId: 'runtime', id: 'rendering', label: 'Quay lại bài đang học' },
    nextAction: { type: 'RETURN_TO_CURRENT_LESSON', chapterId: 'runtime', lessonId: 'rendering' },
  })).toMatchObject({ viewMode: 'REVIEW' });
});
```

- [ ] **Step 2: Run RED protocol tests**

```bash
pnpm vitest run packages/protocol/src/index.test.ts
```

Expected: FAIL because new payloads are absent.

- [ ] **Step 3: Define exhaustive discriminated unions**

Use literal `type` fields for every next action. Do not represent next actions as string plus untyped metadata.

- [ ] **Step 4: Regenerate Go contracts and run parity tests**

```bash
pnpm contracts:generate
pnpm contracts:check
pnpm vitest run packages/protocol/src/index.test.ts tests/conformance/contracts/conformance.test.ts
GOTOOLCHAIN=go1.26.5 go test ./internal/contracts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol packages/web-client internal/contracts generated tests/conformance/contracts
git commit -m "feat: add progression navigation protocol"
```

---

### Task 8: Add Navigation, Canonical Lesson, and Chapter Assessment HTTP APIs

**Files:**
- Create: `internal/server/navigation_handlers.go`
- Create: `internal/server/navigation_handlers_test.go`
- Create: `internal/server/chapter_assessment_handlers.go`
- Create: `internal/server/chapter_assessment_handlers_test.go`
- Create: `internal/server/progression_errors.go`
- Modify: `internal/server/router.go`
- Modify: `internal/server/course_handlers.go`
- Modify: `internal/server/course_handlers_test.go`

**Interfaces:**
- Consumes: `progression.Service` and protocol contracts.
- Produces:

```http
GET  /api/v1/courses/{courseId}/navigation
GET  /api/v1/courses/{courseId}/chapters/{chapterId}/lessons/{lessonId}
GET  /api/v1/chapters/{chapterId}/assessments/{assessmentId}
POST /api/v1/chapters/{chapterId}/assessments/{assessmentId}/actions/{actionId}
```

- [ ] **Step 1: Write RED router tests**

Assert:

```text
navigation returns current and viewed state
completed lesson GET returns REVIEW without changing currentLessonId
locked lesson returns 409 ITEM_LOCKED with blocking requirements
short lesson URL redirects to canonical chapter URL
chapter assessment route rejects unknown chapter/assessment IDs
```

- [ ] **Step 2: Run RED server tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/server -run 'Navigation|Canonical|Assessment|Review|Locked' -count=1
```

Expected: FAIL.

- [ ] **Step 3: Implement typed error mapping**

```go
case errors.As(err, &locked):
    writeError(w, http.StatusConflict, "ITEM_LOCKED", "Item is locked.", requestID(r), map[string]any{
        "blockingRequirements": locked.Blocking,
        "currentTarget": locked.CurrentItem,
    })
```

- [ ] **Step 4: Register exact canonical routes before SPA fallback**

Register API and canonical redirect handlers before `assets.Handler()` so no API or learner route falls through to static-file behavior.

- [ ] **Step 5: Deprecate manual complete endpoint safely**

`POST /api/v1/lessons/{lessonId}/complete` calls requirement evaluation. Return `409 REQUIREMENT_UNSATISFIED` with missing required requirements rather than completing manually.

- [ ] **Step 6: Run server race tests**

```bash
GOTOOLCHAIN=go1.26.5 go test -race ./internal/server -run 'Navigation|Canonical|Assessment|Review|Locked|Complete' -count=10
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/server
git commit -m "feat: expose hierarchical progression api"
```

---

### Task 9: Implement Browser API Client and Canonical Routing

**Files:**
- Modify: `apps/web/src/shared/api/client.ts`
- Modify: `apps/web/src/shared/api/client.test.tsx`
- Modify: `apps/web/src/app/router/lesson-route.ts`
- Create: `apps/web/src/app/router/lesson-route.test.ts`
- Modify: `apps/web/src/app/App.tsx`

**Interfaces:**
- Consumes: typed protocol payloads and canonical URLs.
- Produces:

```ts
getNavigation(courseId: string): Promise<CourseNavigationPayload>
getLessonView(courseId: string, chapterId: string, lessonId: string): Promise<LessonPayload>
getChapterAssessment(chapterId: string, assessmentId: string): Promise<ChapterAssessmentPayload>
navigateToLesson(courseId: string, chapterId: string, lessonId: string, replace?: boolean): void
```

- [ ] **Step 1: Write RED URL parser tests**

```ts
expect(parseLearningRoute('/courses/perf/chapters/runtime/lessons/event-loop')).toEqual({
  kind: 'lesson', courseId: 'perf', chapterId: 'runtime', lessonId: 'event-loop',
});
expect(parseLearningRoute('/courses/perf/chapters/runtime/assessments/capstone')).toEqual({
  kind: 'assessment', courseId: 'perf', chapterId: 'runtime', assessmentId: 'capstone',
});
```

- [ ] **Step 2: Run RED browser tests**

```bash
pnpm vitest run apps/web/src/app/router/lesson-route.test.ts apps/web/src/shared/api/client.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Replace lesson-only route parser with discriminated learning routes**

```ts
type LearningRoute =
  | { kind: 'lesson'; courseId: string; chapterId: string; lessonId: string }
  | { kind: 'assessment'; courseId: string; chapterId: string; assessmentId: string }
  | { kind: 'unknown' };
```

- [ ] **Step 4: Add API client methods with typed errors**

Preserve `ITEM_LOCKED` metadata in `SynaploomApiError`:

```ts
readonly blockingRequirements?: readonly RequirementView[];
readonly currentTarget?: NavigationTarget;
```

- [ ] **Step 5: Run browser unit tests**

```bash
pnpm vitest run apps/web/src/app/router/lesson-route.test.ts apps/web/src/shared/api/client.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app apps/web/src/shared/api packages/web-client
git commit -m "feat: add canonical learning routes"
```

---

### Task 10: Build `syn-lesson-progress` as a Hierarchical Navigator

**Files:**
- Create: `apps/web/src/features/learning-progress/types.ts`
- Create: `apps/web/src/features/learning-progress/SynLessonProgress.tsx`
- Create: `apps/web/src/features/learning-progress/SynLessonProgress.test.tsx`
- Modify: `apps/web/src/application.css`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `CourseNavigationPayload`, `viewedItemId`, callbacks for lesson/assessment navigation.
- Produces:

```ts
export interface SynLessonProgressProps {
  readonly navigation: CourseNavigationPayload;
  readonly viewedItemId: string;
  readonly onOpenLesson: (chapterId: string, lessonId: string) => void;
  readonly onOpenAssessment: (chapterId: string, assessmentId: string) => void;
  readonly onLockedItem: (requirements: readonly RequirementView[]) => void;
}
```

- [ ] **Step 1: Write RED component tests**

Test the required semantics:

```tsx
it('allows a completed lesson to be opened in review mode', async () => {
  render(<SynLessonProgress navigation={fixture} viewedItemId="event-loop" onOpenLesson={onOpenLesson} ... />);
  await user.click(screen.getByRole('button', { name: /Event Loop.*Đã hoàn thành.*Đang xem lại/i }));
  expect(onOpenLesson).toHaveBeenCalledWith('runtime', 'event-loop');
});

it('does not navigate locked lessons and exposes the blocking reason', async () => {
  await user.click(screen.getByRole('button', { name: /Long Tasks.*Bị khóa/i }));
  expect(onLockedItem).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ satisfied: false })]));
});
```

- [ ] **Step 2: Run RED component tests**

```bash
pnpm vitest run apps/web/src/features/learning-progress/SynLessonProgress.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement accessible state semantics**

Every item includes visible text and `aria-current`/`aria-disabled`; color is supplemental only:

```text
✓ Đã hoàn thành
● Bài đang học
◉ Đang xem lại
○ Có thể học
🔒 Bị khóa
```

- [ ] **Step 4: Render chapter assessments as first-class items**

Do not render chapter assessments as lessons. Use distinct labels such as `Thực hành chương · Bắt buộc`.

- [ ] **Step 5: Implement compact and expanded modes**

Compact mode shows required completed count and current item. Expanded mode shows chapter groups and every item.

- [ ] **Step 6: Run component and accessibility tests**

```bash
pnpm vitest run apps/web/src/features/learning-progress/SynLessonProgress.test.tsx
pnpm lint
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/learning-progress apps/web/src/application.css packages/ui/src/index.ts
git commit -m "feat: add hierarchical lesson navigator"
```

---

### Task 11: Replace Completion Buttons with a Requirement-aware Footer

**Files:**
- Create: `apps/web/src/features/lesson-progress/LessonRequirementFooter.tsx`
- Create: `apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx`
- Create: `apps/web/src/features/review-mode/ReviewBanner.tsx`
- Create: `apps/web/src/features/review-mode/ReviewBanner.test.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonPanel.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Consumes: `LessonViewContext`, `nextAction`, mutation callbacks, navigation callbacks.
- Produces: one primary CTA and optional secondary action; no manual chapter/course completion controls.

- [ ] **Step 1: Write RED footer mapping tests**

```tsx
it.each([
  ['ACKNOWLEDGE_READING', 'Hoàn thành bài học'],
  ['START_REQUIRED_PRACTICE', 'Đi đến bài thực hành'],
  ['RETRY_REQUIRED_PRACTICE', 'Thử lại bài thực hành'],
  ['CONTINUE_TO_LESSON', 'Tiếp tục bài tiếp theo'],
  ['START_CHAPTER_ASSESSMENT', 'Bắt đầu thực hành của chương'],
  ['CONTINUE_TO_CHAPTER', 'Tiếp tục chương tiếp theo'],
  ['RETURN_TO_CURRENT_LESSON', 'Quay lại bài đang học'],
  ['VIEW_COURSE_SUMMARY', 'Xem tổng kết khóa học'],
] as const)('maps %s to the primary CTA', (type, label) => {
  render(<LessonRequirementFooter context={contextWithAction(type)} />);
  expect(screen.getByRole('button', { name: label })).toBeVisible();
});
```

- [ ] **Step 2: Run RED tests**

```bash
pnpm vitest run apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx apps/web/src/features/review-mode/ReviewBanner.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Render requirement checklist**

Required and optional requirements are visibly distinct. Optional failed work never changes the primary CTA.

- [ ] **Step 4: Implement review banner**

Render:

```text
✓ Bài học đã hoàn thành · Đang xem lại
[Quay lại bài đang học: {title}]
```

Hide reading/complete mutations in review mode.

- [ ] **Step 5: Remove legacy dual-button completion bar**

Delete the UI paths that independently display “Hoàn thành phần đọc” and “Hoàn thành bài học”. Keep only the requirement-aware footer.

- [ ] **Step 6: Run Web tests**

```bash
pnpm vitest run --project dom
pnpm lint
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/lesson-progress apps/web/src/features/review-mode apps/web/src/features/lesson-content/LessonPanel.tsx apps/web/src/application.css
git commit -m "feat: add requirement-aware lesson footer"
```

---

### Task 12: Integrate Navigation, Review, and Assessment Views into the Workspace

**Files:**
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/features/practice/PracticePanel.tsx`
- Create: `apps/web/src/features/chapter-assessment/ChapterAssessmentPage.tsx`
- Create: `apps/web/src/features/chapter-assessment/ChapterAssessmentPage.test.tsx`

**Interfaces:**
- Consumes: browser API client, canonical route, `SynLessonProgress`, footer, and assessment APIs.
- Produces: independent loading of persisted current progression and URL-selected viewed item.

- [ ] **Step 1: Write RED integration tests**

```tsx
it('keeps the current lesson while reviewing a completed lesson', async () => {
  renderWorkspace({ routeLessonId: 'event-loop', currentLessonId: 'rendering', eventLoopStatus: 'COMPLETED' });
  expect(await screen.findByText('Đang xem lại')).toBeVisible();
  expect(screen.getByText('Rendering Pipeline')).toHaveAccessibleName(/Bài đang học/);
  expect(api.startLesson).not.toHaveBeenCalled();
});

it('navigates to the chapter assessment after the final required lesson', async () => {
  renderWorkspace({ nextAction: { type: 'START_CHAPTER_ASSESSMENT', chapterId: 'runtime', assessmentId: 'capstone' } });
  await user.click(screen.getByRole('button', { name: 'Bắt đầu thực hành của chương' }));
  expect(location.pathname).toBe('/courses/perf/chapters/runtime/assessments/capstone');
});
```

- [ ] **Step 2: Run RED tests**

```bash
pnpm vitest run apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx apps/web/src/features/chapter-assessment/ChapterAssessmentPage.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Load navigation and viewed content as separate queries**

Use query keys:

```ts
['course-navigation', courseId]
['lesson-view', courseId, chapterId, lessonId]
['chapter-assessment', courseId, chapterId, assessmentId]
```

A lesson GET must never call `startLesson` for a completed item.

- [ ] **Step 4: Invalidate only authoritative queries after mutations**

After reading/practice/assessment mutation, invalidate navigation and the viewed item. Do not derive local unlocks.

- [ ] **Step 5: Reuse practice workspace for chapter assessments**

Parameterize practice UI by `PracticeOwnerRef`:

```ts
type PracticeOwnerRef =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'chapter-assessment'; chapterId: string; assessmentId: string };
```

- [ ] **Step 6: Run DOM integration suite**

```bash
pnpm vitest run --project dom
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/workspace-layout apps/web/src/features/chapter-assessment apps/web/src/features/practice apps/web/src/app/App.tsx
git commit -m "feat: integrate review and chapter assessments"
```

---

### Task 13: Migrate the Example Course and Add a Real Chapter Assessment

**Files:**
- Modify: `examples/frontend-performance-foundations/course.json`
- Create: `examples/frontend-performance-foundations/assessments/runtime-capstone/assessment.json`
- Create: `examples/frontend-performance-foundations/assessments/runtime-capstone/starter/performance-report.md`
- Create: `examples/frontend-performance-foundations/assessments/runtime-capstone/checks/check-report.mjs`
- Modify: `internal/course/importer_test.go`
- Modify: `tests/e2e/go-runtime.spec.ts`

**Interfaces:**
- Consumes: Course Schema 1.1, chapter assessment workspace/action runtime.
- Produces: a real end-to-end fixture covering required lessons, optional work, chapter assessment, review, and chapter unlock.

- [ ] **Step 1: Add RED importer and E2E expectations**

Assert the example has:

```text
Chapter: javascript-runtime
Required lessons: main-thread, event-loop
Optional lesson: rendering-pipeline (or another explicit optional deep dive)
Required chapter assessment: runtime-capstone
```

- [ ] **Step 2: Run RED tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/course -run ExampleChapterCourse -count=1
pnpm playwright test --project=go-runtime --grep "chapter progression"
```

Expected: FAIL.

- [ ] **Step 3: Write explicit schema 1.1 manifest**

Use chapter-relative assessment path and explicit `requiresLessons`.

- [ ] **Step 4: Add deterministic assessment check**

The check reads `performance-report.md`, requires concrete diagnosis headings, and exits `0` only when all required sections exist. It must not use network access.

- [ ] **Step 5: Implement E2E progression scenario**

The browser test must:

```text
finish main-thread reading
pass event-loop required practice
observe chapter assessment unlock
pass runtime-capstone
observe chapter completed
open completed event-loop in review mode
assert current progression remains in the next chapter/item
```

- [ ] **Step 6: Run importer, Go runtime, and Playwright tests**

```bash
GOTOOLCHAIN=go1.26.5 go test ./internal/course ./internal/server ./internal/app
pnpm go:stage-web
pnpm playwright test --project=go-runtime --grep "chapter progression"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/frontend-performance-foundations internal/course/importer_test.go tests/e2e/go-runtime.spec.ts
git commit -m "feat: add chapter progression example"
```

---

### Task 14: Document Authoring, Architecture, and Migration Semantics

**Files:**
- Modify: `docs/course-authoring/course-format-v1.md`
- Modify: `docs/architecture/go-core.md`
- Create: `docs/architecture/decisions/0003-hierarchical-progression.md`
- Modify: `docs/user/getting-started.md`
- Modify: `README.md`
- Create: `tests/hierarchical-progression-docs.spec.ts`

**Interfaces:**
- Consumes: implemented schema, APIs, UX semantics.
- Produces: normative authoring and migration documentation plus executable documentation checks.

- [ ] **Step 1: Write RED documentation contract**

Assert documentation contains exact concepts:

```text
schemaVersion 1.1.0
required and optional lessons
chapter assessments
bestResult and latestResult
currentLessonId and viewedLessonId
review mode does not rollback progression
Course Schema 1.0 implicit chapter migration
```

- [ ] **Step 2: Run RED doc test**

```bash
pnpm vitest run tests/hierarchical-progression-docs.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Write authoring guide with complete examples**

Include one reading-only lesson, one mixed lesson with required/optional practices, and one chapter assessment.

- [ ] **Step 4: Write ADR decisions and rejected alternatives**

Record why V1 uses strict sequential progression instead of all-open chapters or a prerequisite DAG.

- [ ] **Step 5: Update user workflow**

Document review navigation, required labels, chapter assessment unlock, and the meaning of current versus viewed lesson.

- [ ] **Step 6: Run documentation and link checks**

```bash
pnpm vitest run tests/hierarchical-progression-docs.spec.ts
pnpm format:check
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs README.md tests/hierarchical-progression-docs.spec.ts
git commit -m "docs: document hierarchical progression"
```

---

### Task 15: Run Full Migration Acceptance and Release Gates

**Files:**
- Modify: `.github/workflows/go-release.yml`
- Modify: `.github/workflows/go-sqlite-matrix.yml`
- Modify: `scripts/verify-go-release.mjs`
- Create: `tests/go-integration/hierarchical_progression_test.go`
- Modify: `docs/releases/go-core-migration-verification.md`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: repeatable release evidence proving hierarchy, persistence, review invariants, browser UX, and cross-platform build compatibility.

- [ ] **Step 1: Add RED restart/review integration test**

The test must:

```text
initialize schema 1.0 course and verify implicit chapter
initialize schema 1.1 course
complete required lesson practice
fail a later review attempt
restart runtime
assert best pass, lesson completion, chapter state, current lesson, and review access persist
```

- [ ] **Step 2: Run targeted RED integration test**

```bash
GOTOOLCHAIN=go1.26.5 go test ./tests/go-integration -run HierarchicalProgression -count=1
```

Expected: FAIL until all migration behavior is connected.

- [ ] **Step 3: Add release verification assertions**

Verify every native artifact supports:

```text
synaploom course validate examples/frontend-performance-foundations
synaploom doctor --json
```

Host artifact additionally runs the chapter-progression HTTP smoke flow.

- [ ] **Step 4: Run complete TypeScript and Node gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm contracts:check
```

Expected: PASS.

- [ ] **Step 5: Run complete Go gates**

```bash
GOTOOLCHAIN=go1.26.5 go test ./...
GOTOOLCHAIN=go1.26.5 go test -race ./internal/... ./tests/go-integration/...
GOTOOLCHAIN=go1.26.5 go vet ./...
GOTOOLCHAIN=go1.26.5 go tool staticcheck ./...
```

Expected: PASS.

- [ ] **Step 6: Run browser acceptance**

```bash
pnpm go:stage-web
pnpm playwright test --project=go-runtime
```

Expected: PASS, including review navigation and chapter assessment progression.

- [ ] **Step 7: Build and verify six native targets**

```bash
pnpm go:release
pnpm go:verify-release
```

Expected: six artifacts, checksum inventory valid, host smoke PASS.

- [ ] **Step 8: Update verification evidence**

Record exact commit, schema version, test counts, artifact sizes, SHA-256 values, and migration fixture checksum in `docs/releases/go-core-migration-verification.md`.

- [ ] **Step 9: Commit**

```bash
git add .github scripts tests/go-integration/hierarchical_progression_test.go docs/releases/go-core-migration-verification.md
git commit -m "test: verify hierarchical progression release"
```

---

## Final Review Checklist

- [ ] Every Course Schema 1.0 fixture still validates and runs through an implicit chapter.
- [ ] Course Schema 1.1 rejects duplicate IDs, unknown lesson references, and invalid prerequisites.
- [ ] Required reading and required practices are the only lesson blockers.
- [ ] Optional practices and optional lessons never block next actions.
- [ ] Required chapter assessments block chapter completion and next chapter unlock.
- [ ] Chapters with no required assessment complete automatically after required lessons.
- [ ] Later failed attempts update `latestResult` but preserve passing `bestResult`.
- [ ] Workspace reset changes no progress rows.
- [ ] Completed lessons remain clickable and return `REVIEW` mode.
- [ ] Opening a completed lesson performs zero persistence writes.
- [ ] `currentLessonId` remains unchanged while `viewedLessonId` changes.
- [ ] React displays one primary CTA derived from backend `nextAction`.
- [ ] Locked items expose a human-readable blocking reason.
- [ ] Chapter assessments are visually and semantically distinct from lessons.
- [ ] Canonical chapter-aware deep links work after refresh.
- [ ] Compatibility short lesson URLs redirect to canonical URLs.
- [ ] Full TypeScript, Go, Playwright, Staticcheck, and six-target release gates pass.
