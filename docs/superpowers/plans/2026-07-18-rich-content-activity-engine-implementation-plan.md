# Rich Lesson Content and Multi-Domain Activity Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Course Schema 1.2.0 with active-chapter navigation steps, a canonical Go rich-document parser, and a subject-neutral Activity Engine supporting ten activity kinds across lessons and assessments.

**Architecture:** Keep the existing unified learning workspace and hierarchical progression shell. Add a schema-driven content layer (`LessonDocument`) and a generic activity domain (`ActivityDefinition`, `ActivityAttempt`, evaluator registry, activity-set progress) behind the Go daemon, then expose public answer-key-free views to React through generated contracts. Preserve Course Schema 1.0/1.1 through adapters for legacy lesson Markdown, `exercise.json`, and chapter assessments.

**Tech Stack:** Go `1.26.5`, SQLite via `modernc.org/sqlite`, Node.js `>=22.13.0`, pnpm `11.13.0`, TypeScript `6.0.3`, React `19.2.7`, TanStack Query `5.101.2`, Vitest `4.1.10`, Playwright `1.61.1`, JSON Schema draft 2020-12, `go-jsonschema`, KaTeX.

## Global Constraints

- Course Schema `1.0`, `1.1.0`, and `1.2.0` remain loadable; new authoring capabilities require `1.2.0`.
- The Go runtime is the canonical production Markdown parser; React renders typed document nodes and does not reinterpret source Markdown.
- Raw HTML, MDX, arbitrary React components, arbitrary iframes, author JavaScript, and remote media are prohibited.
- Non-coding activities are declarative data and cannot declare executables, shell arguments, network requests, workspace paths, or runner capabilities.
- Only `kind: "coding"` may cross the trusted local-runner boundary.
- Correct answers and evaluator-sensitive configuration never appear in initial learner payloads unless reveal policy permits them.
- Practice and assessment use one activity engine and differ only by attempt, feedback, scoring, and reveal policies.
- Long-form writing v1 completes by valid submission and is not falsely auto-graded.
- All activity renderers must support keyboard-only operation and status semantics that do not rely on color.
- Authored TypeScript imports use package exports or `#src/*` aliases; no new `../` or `./` imports are introduced in authored TS/TSX.
- Every production behavior change begins with a failing automated test and ends with a focused commit.
- Generated Go and TypeScript contracts remain reproducible through `pnpm contracts:generate` and clean under `pnpm contracts:check`.

---

## Target File Map

```text
schemas/v1/course.schema.json                     Course Schema 1.2 manifest and chapter references
schemas/v1/lesson-document.schema.json            Rich document inline/block union
schemas/v1/activity.schema.json                   Internal author activity definition
schemas/v1/activity-public.schema.json            Answer-key-free learner view
schemas/v1/activity-attempt.schema.json           Answers, attempts, feedback, progress
schemas/v1/api.schema.json                        Activity and activity-set API payloads
packages/contracts/src/index.ts                   Shared authored/domain TypeScript types
packages/protocol/src/index.ts                    Browser-safe API types
packages/course-schema/src/index.ts               Schema-version dispatch and canonical validation
packages/course-validator/src/index.ts            Course-package path and semantic diagnostics
internal/course/markdown.go                       Canonical Go Markdown parser entry point
internal/course/markdown_inline.go                Inline parser and URL safety
internal/course/markdown_blocks.go                Core Markdown block parser
internal/course/markdown_directives.go            Pedagogical directives and activity embeds
internal/course/activity_source.go                Activity-set and activity manifest loading
internal/course/activity_validation.go            Cross-file semantic validation
internal/activity/model.go                        Activity domain, answers, attempts, policies
internal/activity/public_view.go                   Answer-key stripping and reveal policy
internal/activity/evaluator.go                     Evaluator registry contract
internal/activity/evaluator_*.go                   Ten activity evaluators
internal/activity/service.go                       Draft/submit/evaluate/idempotency lifecycle
internal/activity/set_progress.go                  Activity-set scoring and completion
internal/storage/migrations/004_activity_engine.sql SQLite activity persistence
internal/storage/activity_repository.go           Attempt repository
internal/server/activity_handlers.go               Activity/attempt HTTP endpoints
internal/server/router.go                          Route registration
internal/progression/*                             Activity-set requirement integration
packages/web-client/src/client.ts                  Activity API client
apps/web/src/features/activity-engine/*            Activity host, state, renderers, feedback
apps/web/src/features/lesson-content/LessonContent.tsx Rich document rendering
apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx Layout selection and embeds
examples/multi-domain-foundations/*                Cross-domain Course Schema 1.2 example
```

---

# Phase 1 — Navigation and Course Schema 1.2 Foundations

### Task 1: Restrict top navigation steps to the active chapter

**Files:**

- Modify: `apps/web/src/features/learning-progress/LearningTopNavigation.tsx:25-100`
- Modify: `apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Consumes: `CourseNavigationPayload.chapters`, `viewedItemId`.
- Produces: `activeChapterItems(navigation, viewedItemId): readonly FlatLearningItem[]`; previous/next continue using the course-wide flattened sequence.

- [ ] **Step 1: Add a failing chapter-local step test**

Add this test to `LearningTopNavigation.test.tsx`:

```tsx
it('renders step markers only for the viewed chapter while previous and next stay course-wide', () => {
  render(
    <LearningTopNavigation
      navigation={navigationWithTwoChapters}
      viewedItemId="event-loop"
      onOpenLesson={vi.fn()}
      onOpenAssessment={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('1/3 mục trong chương đã hoàn thành')).toBeInTheDocument();
  expect(screen.getAllByTestId('chapter-step')).toHaveLength(3);
  expect(screen.queryByTitle('Rendering Fundamentals')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mục học tiếp theo' })).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx
```

Expected: FAIL because the component currently renders every course item and labels progress course-wide.

- [ ] **Step 3: Split course sequence from active-chapter steps**

Replace the single `items` derivation with:

```ts
const courseItems = useMemo(() => flattenNavigation(navigation), [navigation]);
const viewedIndex = Math.max(
  0,
  courseItems.findIndex((entry) => entry.item.id === viewedItemId),
);
const viewed = courseItems[viewedIndex];
const chapter = navigation.chapters.find((entry) => entry.id === viewed?.chapterId);
const chapterItems = useMemo(
  () => courseItems.filter((entry) => entry.chapterId === chapter?.id),
  [chapter?.id, courseItems],
);
const previous = courseItems[viewedIndex - 1];
const next = courseItems[viewedIndex + 1];
const chapterCompleted = chapterItems.filter((entry) => entry.item.status === 'COMPLETED').length;
```

Render `chapterItems` inside `.syn-learning-top-nav__steps`, add `data-testid="chapter-step"`, and label the group:

```tsx
aria-label={`${chapterCompleted}/${chapterItems.length} mục trong chương đã hoàn thành`}
```

Keep chapter/item selectors and curriculum popover backed by `courseItems`.

- [ ] **Step 4: Verify GREEN and accessibility semantics**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx
pnpm typecheck
```

Expected: PASS; active chapter markers are local while cross-chapter previous/next remains available.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-progress/LearningTopNavigation.tsx \
  apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx \
  apps/web/src/application.css
git commit -m "fix: scope learning steps to active chapter"
```

### Task 2: Add Course Schema 1.2 and activity contract schemas

**Files:**

- Create: `schemas/v1/activity.schema.json`
- Create: `schemas/v1/activity-public.schema.json`
- Create: `schemas/v1/activity-attempt.schema.json`
- Modify: `schemas/v1/course.schema.json`
- Modify: `schemas/v1/lesson-document.schema.json`
- Modify: `schemas/v1/api.schema.json`
- Modify: `packages/course-schema/src/index.ts`
- Modify: `packages/course-schema/src/index.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**

- Produces: `ActivityKind`, `ActivitySetPolicy`, `ActivityDefinition`, `ActivityPublicView`, `ActivityAnswer`, `ActivityAttempt`, `ActivityFeedback`, `ActivitySetProgress`, `SUPPORTED_SCHEMA_VERSIONS` containing `1.2.0`.

- [ ] **Step 1: Add failing schema-version and union tests**

Add tests asserting:

```ts
expect(SUPPORTED_SCHEMA_VERSIONS).toContain('1.2.0');
expect(validateCanonical('course', course12Fixture)).toEqual({ valid: true });
expect(validateCanonical('activity', singleChoiceFixture)).toEqual({ valid: true });
expect(validateCanonical('activity', nonCodingActivityWithRuntimeFields)).toEqual({
  valid: false,
  path: '$.config',
});
```

Add fixtures in `schemas/fixtures/activity/` for every kind and one capability-escape fixture.

- [ ] **Step 2: Run contract/schema tests and confirm RED**

```bash
pnpm exec vitest run --project node packages/course-schema/src/index.test.ts
```

Expected: FAIL because schema version `1.2.0` and activity schema dispatch do not exist.

- [ ] **Step 3: Define the schema discriminators**

Create `activity.schema.json` with this root shape:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://synaploom.dev/schemas/v1/activity.schema.json",
  "title": "ActivityDefinition",
  "type": "object",
  "required": [
    "schemaVersion",
    "id",
    "kind",
    "title",
    "prompt",
    "config",
    "evaluation",
    "completion"
  ],
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "id": { "$ref": "course.schema.json#/$defs/id" },
    "kind": {
      "enum": [
        "single-choice",
        "multiple-choice",
        "true-false",
        "short-answer",
        "fill-blanks",
        "ordering",
        "matching",
        "numeric",
        "writing",
        "coding"
      ]
    },
    "title": { "type": "string", "minLength": 1 },
    "prompt": { "$ref": "lesson-document.schema.json#/$defs/fragment" },
    "config": { "type": "object" },
    "evaluation": { "$ref": "#/$defs/evaluationPolicy" },
    "completion": { "$ref": "#/$defs/completionPolicy" }
  },
  "allOf": [
    {
      "if": { "properties": { "kind": { "const": "coding" } } },
      "then": { "properties": { "config": { "$ref": "exercise.schema.json" } } },
      "else": {
        "properties": {
          "config": {
            "not": {
              "anyOf": [
                { "required": ["runtime"] },
                { "required": ["workspace"] },
                { "required": ["actions"] }
              ]
            }
          }
        }
      }
    }
  ],
  "additionalProperties": false
}
```

Extend Course Schema `1.2.0` lesson front matter/activity-set references and assessment activity-set paths. Add author/internal and learner/public shapes so answer keys can be removed from public payloads.

- [ ] **Step 4: Add TypeScript domain contracts and version dispatch**

In `packages/contracts/src/index.ts`, add discriminated unions using exact names from the spec:

```ts
export type ActivityKind =
  | 'single-choice'
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-blanks'
  | 'ordering'
  | 'matching'
  | 'numeric'
  | 'writing'
  | 'coding';

export interface ActivitySetPolicy {
  readonly purpose: 'practice' | 'assessment';
  readonly maxAttempts: number | null;
  readonly feedbackMode: 'immediate' | 'after-submit' | 'after-final-attempt';
  readonly revealAnswers: 'never' | 'after-submit' | 'after-final-attempt';
  readonly scoring: 'none' | 'points';
  readonly passingScore: number | null;
}
```

Update `SUPPORTED_SCHEMA_VERSIONS` to:

```ts
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1.0', '1.2.0'] as const;
```

Dispatch `schemaVersion === '1.2.0'` to a dedicated `validateActivityCourse` function.

- [ ] **Step 5: Regenerate contracts and verify clean generation**

```bash
pnpm contracts:generate
pnpm contracts:check
pnpm exec vitest run --project node packages/course-schema/src/index.test.ts packages/contracts/src/index.test.ts
```

Expected: generated Go and TypeScript contracts include all new shapes; answer-key fields exist only in internal definitions.

- [ ] **Step 6: Commit**

```bash
git add schemas packages/contracts packages/course-schema generated scripts/contracts
git commit -m "feat: add course schema 1.2 activity contracts"
```

### Task 3: Load and validate activity sets from course packages

**Files:**

- Create: `internal/course/activity_source.go`
- Create: `internal/course/activity_source_test.go`
- Create: `internal/course/activity_validation.go`
- Create: `internal/course/activity_validation_test.go`
- Modify: `internal/course/lesson_source.go`
- Modify: `internal/course/importer.go`
- Modify: `packages/course-validator/src/index.ts`
- Modify: `packages/course-validator/src/index.test.ts`

**Interfaces:**

- Produces Go types `ActivitySetSource`, `ActivitySource`, and functions:

```go
func LoadActivitySets(ctx context.Context, ownerRoot string, refs []string) ([]ActivitySetSource, error)
func ValidateActivitySet(set ActivitySetSource, activities map[string]ActivitySource) []ValidationIssue
```

- [ ] **Step 1: Add failing cross-file validation tests**

Create fixtures covering:

- missing activity file;
- duplicate activity ID;
- activity path escaping the lesson root;
- duplicate `:::activity` embed;
- assessment with `scoring: points` containing a submission-only writing activity.

Assert diagnostic codes exactly:

```go
want := []string{
    "ACTIVITY_REFERENCE_NOT_FOUND",
    "ACTIVITY_ID_DUPLICATE",
    "DOCUMENT_ASSET_OUTSIDE_COURSE",
    "ACTIVITY_EMBED_DUPLICATE",
    "ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY",
}
```

- [ ] **Step 2: Run Go and TypeScript validators and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course -run Activity -count=1
pnpm exec vitest run --project node packages/course-validator/src/index.test.ts
```

Expected: FAIL because the loaders and diagnostics are absent.

- [ ] **Step 3: Implement safe owner-relative loading**

Use the existing safe-path helpers and reject path escapes before file reads:

```go
func resolveOwnerPath(ownerRoot, ref string) (string, error) {
    clean := filepath.Clean(ref)
    if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
        return "", fmt.Errorf("DOCUMENT_ASSET_OUTSIDE_COURSE: %s", ref)
    }
    resolved := filepath.Join(ownerRoot, clean)
    relative, err := filepath.Rel(ownerRoot, resolved)
    if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
        return "", fmt.Errorf("DOCUMENT_ASSET_OUTSIDE_COURSE: %s", ref)
    }
    return resolved, nil
}
```

Load activity-set JSON, then each referenced activity JSON, preserving source paths for diagnostics.

- [ ] **Step 4: Integrate 1.2 lesson front matter and legacy adapters**

For `1.2.0`, load `activitySets`. For `1.0/1.1`, normalize `exercise` into one synthetic set and one `coding` activity without mutating source files.

Expose normalized activities on the loaded lesson/course model while retaining `exercise` compatibility fields for one window.

- [ ] **Step 5: Verify focused loading and compatibility**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course -count=1
pnpm exec vitest run --project node packages/course-validator/src/index.test.ts
pnpm contracts:check
```

Expected: all new diagnostics are source-path-specific; existing example course remains valid.

- [ ] **Step 6: Commit**

```bash
git add internal/course packages/course-validator
git commit -m "feat: load and validate activity manifests"
```

---

# Phase 2 — Canonical Rich Lesson Documents

### Task 4: Expand the typed lesson document contract

**Files:**

- Modify: `schemas/v1/lesson-document.schema.json`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `generated/go/contracts/*`
- Create: `schemas/fixtures/lesson-document/rich-document.json`
- Modify: `tests/conformance/contracts/conformance.test.ts`

**Interfaces:**

- Produces: `LessonDocument`, `LessonDocumentFragment`, `InlineNode`, and rich `LessonBlock` discriminated unions.

- [ ] **Step 1: Add a failing rich-document round-trip fixture**

The fixture must include every v1 inline and block kind, one local figure, one transcript-backed audio block, one transcript-backed video block, and one activity embed.

Assert Go and TypeScript runners round-trip the fixture without field loss and without executable markup.

- [ ] **Step 2: Run conformance and confirm RED**

```bash
pnpm test:contracts
```

Expected: FAIL because existing `LessonBlock` supports only heading, paragraph, flat list, code, callout, image, and assignment.

- [ ] **Step 3: Define nested inline and block unions**

Replace `InlineContent` with nested `InlineNode` variants and define blocks from the approved spec. Use structured children rather than learner-facing strings for list items, table cells, callouts, definitions, proofs, details, tabs, objectives, summaries, media captions, and activity embeds.

The activity embed contract is:

```ts
export interface ActivityEmbedBlock {
  readonly type: 'activity';
  readonly activityId: string;
}
```

Media sources remain safe relative paths and carry required accessibility metadata.

- [ ] **Step 4: Regenerate and verify answer-key separation remains intact**

```bash
pnpm contracts:generate
pnpm contracts:check
pnpm test:contracts
```

Expected: PASS; lesson documents round-trip in Go and TypeScript with no `html`, `script`, or `iframe` fields.

- [ ] **Step 5: Commit**

```bash
git add schemas/v1/lesson-document.schema.json schemas/fixtures/lesson-document \
  packages/contracts packages/protocol generated/go/contracts tests/conformance
git commit -m "feat: define rich lesson document contracts"
```

### Task 5: Replace the Go Markdown subset parser with a canonical parser pipeline

**Files:**

- Modify: `go.mod`
- Modify: `go.sum`
- Replace: `internal/course/markdown.go`
- Create: `internal/course/markdown_inline.go`
- Create: `internal/course/markdown_blocks.go`
- Create: `internal/course/markdown_directives.go`
- Create: `internal/course/markdown_assets.go`
- Expand: `internal/course/markdown_test.go`
- Create: `internal/course/testdata/markdown/*.md`
- Create: `internal/course/testdata/markdown/*.golden.json`

**Interfaces:**

- Produces:

```go
type MarkdownParseOptions struct {
    CourseRoot string
    LessonRoot string
    Strict     bool
}

func ParseLessonDocument(source string, options MarkdownParseOptions) (contracts.LessonDocument, []ValidationIssue)
```

- [ ] **Step 1: Add golden tests for standard Markdown**

Create table-driven tests for emphasis, strong, strikethrough, inline code, links, blockquotes, nested lists, task lists, code fences, tables, thematic breaks, and footnotes.

- [ ] **Step 2: Run parser tests and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course -run Markdown -count=1
```

Expected: FAIL because the current line parser cannot represent nested structures.

- [ ] **Step 3: Introduce a CommonMark-compatible AST parser**

Add `github.com/yuin/goldmark` with table, strikethrough, task-list, and footnote extensions. Walk the AST into generated contract nodes; never render HTML.

Use an inline visitor that rejects unsafe schemes and preserves external-link metadata:

```go
func safeLinkDestination(raw string) (string, bool) {
    if strings.HasPrefix(raw, "#") { return raw, true }
    parsed, err := url.Parse(raw)
    if err != nil { return "", false }
    if parsed.IsAbs() { return raw, parsed.Scheme == "https" || parsed.Scheme == "http" || parsed.Scheme == "mailto" }
    return raw, !strings.Contains(filepath.Clean(raw), "..")
}
```

- [ ] **Step 4: Add directive parsing and duplicate activity detection**

Pre-scan fenced directives and convert allowlisted directives to typed nodes. Unknown directives add `DOCUMENT_DIRECTIVE_UNKNOWN`; duplicate activity IDs add `ACTIVITY_EMBED_DUPLICATE`.

Supported directive names are exactly:

```text
note hint warning important misconception details tabs objectives definition theorem proof worked-example summary vocabulary compare walkthrough activity figure audio video attachment
```

- [ ] **Step 5: Add math tokenization and safe fallback**

Parse `$...$` and `$$...$$` into math nodes while preserving source. Validate balanced delimiters and reject empty source with `MATH_SOURCE_INVALID`. KaTeX rendering remains a browser responsibility.

- [ ] **Step 6: Add media path and transcript validation**

Resolve every media path inside `CourseRoot`; require `alt` for figures and transcript/caption metadata for audio/video. Reject remote media in strict mode.

- [ ] **Step 7: Verify stable golden output**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course -run Markdown -count=1
pnpm contracts:check
```

Expected: PASS and golden JSON remains stable across repeated runs.

- [ ] **Step 8: Commit**

```bash
git add go.mod go.sum internal/course/markdown* internal/course/testdata/markdown
git commit -m "feat: parse canonical rich lesson documents"
```

### Task 6: Convert the frontend lesson renderer into a pure typed renderer

**Files:**

- Modify: `packages/lesson-renderer/src/index.ts`
- Modify: `packages/lesson-renderer/src/index.test.ts`
- Create: `apps/web/src/features/lesson-content/LessonDocumentRenderer.tsx`
- Create: `apps/web/src/features/lesson-content/LessonDocumentRenderer.test.tsx`
- Create: `apps/web/src/features/lesson-content/MathContent.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonContent.tsx`
- Modify: `apps/web/src/application.css`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `LessonDocument` from the daemon.
- Produces: `LessonDocumentRenderer({ document, renderActivity }): ReactNode`; `packages/lesson-renderer` exports only type guards and pure helpers, not production Markdown parsing.

- [ ] **Step 1: Add failing renderer tests for rich semantics**

Test real `<table>`, `<caption>`, nested lists, `<details>`, tabs keyboard selection, KaTeX source fallback, media transcript disclosure, external-link safety, and activity embed callback.

- [ ] **Step 2: Run DOM tests and confirm RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/lesson-content/LessonDocumentRenderer.test.tsx
```

Expected: FAIL because the component does not exist and current rendering supports only the legacy block subset.

- [ ] **Step 3: Implement exhaustive typed rendering**

Use a `switch (block.type)` with an exhaustive `never` guard. Do not use `dangerouslySetInnerHTML` for authored content. For KaTeX, render platform-generated KaTeX markup from trusted TeX source through a dedicated component with strict options and a source fallback on parse errors.

- [ ] **Step 4: Remove production Markdown parsing from `packages/lesson-renderer`**

Replace `parseLessonMarkdown` production exports with:

```ts
export function isLessonDocument(value: unknown): value is LessonDocument;
export function externalLinkProps(href: string): { target?: '_blank'; rel?: string };
```

Keep any preview-only parser behind an explicit `preview` entry point and conformance fixtures; the web app must not import it.

- [ ] **Step 5: Verify rendering and package boundaries**

```bash
pnpm exec vitest run --project dom apps/web/src/features/lesson-content/LessonDocumentRenderer.test.tsx
pnpm exec vitest run --project node packages/lesson-renderer/src/index.test.ts
pnpm lint
pnpm typecheck
```

Expected: PASS; no authored HTML execution and no duplicate semantic parser in the production web path.

- [ ] **Step 6: Commit**

```bash
git add packages/lesson-renderer apps/web/src/features/lesson-content \
  apps/web/src/application.css apps/web/package.json pnpm-lock.yaml
git commit -m "feat: render typed rich lesson documents"
```

---

# Phase 3 — Activity Attempt Persistence and APIs

### Task 7: Add SQLite activity attempt persistence

**Files:**

- Create: `internal/storage/migrations/004_activity_engine.sql`
- Create: `internal/storage/activity_repository.go`
- Create: `internal/storage/activity_repository_test.go`
- Modify: `internal/storage/migrate_test.go`

**Interfaces:**

- Produces:

```go
type ActivityAttemptRecord struct {
    ID string
    CourseID string
    CourseVersion string
    OwnerKind string
    OwnerID string
    ActivityID string
    AttemptNumber int
    Status string
    AnswerJSON []byte
    FeedbackJSON []byte
    Score *float64
    MaxScore *float64
    Passed *bool
    Seed int64
    Revision int64
    IdempotencyKey *string
    StartedAt string
    UpdatedAt string
    SubmittedAt *string
    EvaluatedAt *string
}

type ActivityRepository interface {
    CurrentDraft(context.Context, AttemptIdentity) (*ActivityAttemptRecord, error)
    SaveDraft(context.Context, DraftWrite) (ActivityAttemptRecord, error)
    CreateSubmission(context.Context, SubmissionWrite) (ActivityAttemptRecord, bool, error)
    UpdateEvaluation(context.Context, EvaluationWrite) (ActivityAttemptRecord, error)
    ListOwnerAttempts(context.Context, OwnerIdentity) ([]ActivityAttemptRecord, error)
}
```

- [ ] **Step 1: Add failing migration and repository tests**

Cover restart persistence, optimistic revision conflict, monotonic attempt numbers, idempotent duplicate submission, and submitted-attempt immutability.

- [ ] **Step 2: Run storage tests and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/storage -run Activity -count=1
```

Expected: FAIL because migration 004 and repository do not exist.

- [ ] **Step 3: Create the migration**

Create `activity_attempts` with indexed identity/status columns and canonical JSON payloads. Enforce:

```sql
UNIQUE(course_id, course_version, owner_kind, owner_id, activity_id, attempt_number),
UNIQUE(course_id, course_version, owner_kind, owner_id, activity_id, idempotency_key)
```

Use a partial uniqueness condition for non-null idempotency keys if supported by SQLite.

- [ ] **Step 4: Implement transactional draft and submission methods**

Use compare-and-swap revision updates for drafts and a transaction that allocates `MAX(attempt_number)+1` for submissions. A duplicate idempotency key returns the existing row with `created=false`.

- [ ] **Step 5: Verify migrations and repository behavior**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/storage -count=1
```

Expected: PASS; migration backup/checksum behavior remains intact.

- [ ] **Step 6: Commit**

```bash
git add internal/storage/migrations/004_activity_engine.sql internal/storage/activity_repository* internal/storage/migrate_test.go
git commit -m "feat: persist activity attempts"
```

### Task 8: Implement the activity domain service and public views

**Files:**

- Create: `internal/activity/model.go`
- Create: `internal/activity/public_view.go`
- Create: `internal/activity/public_view_test.go`
- Create: `internal/activity/service.go`
- Create: `internal/activity/service_test.go`
- Create: `internal/activity/errors.go`

**Interfaces:**

- Produces:

```go
type Service interface {
    PublicActivity(context.Context, OwnerIdentity, string) (PublicActivityView, error)
    CurrentAttempt(context.Context, AttemptIdentity) (*ActivityAttempt, error)
    SaveDraft(context.Context, SaveDraftCommand) (ActivityAttempt, error)
    Submit(context.Context, SubmitCommand) (ActivityAttempt, error)
    SetProgress(context.Context, OwnerIdentity, string) (ActivitySetProgress, error)
}
```

- [ ] **Step 1: Add failing answer-key privacy tests**

Create internal definitions containing correct options, accepted answers, expected order, matching pairs, and expected numeric expressions. Assert `PublicActivity` JSON contains none of those fields before reveal policy permits them.

- [ ] **Step 2: Add failing lifecycle tests**

Cover `DRAFT -> SUBMITTED -> EVALUATED`, revision conflicts, max-attempt denial, duplicate idempotency keys, randomized seed persistence, and writing submission completion.

- [ ] **Step 3: Run tests and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -count=1
```

Expected: FAIL because the activity package is absent.

- [ ] **Step 4: Implement public-view redaction**

Build learner views from an explicit allowlist per kind. Never marshal internal `config` wholesale. Return revealed answers only from `ActivityFeedback.CorrectAnswer` after policy evaluation.

- [ ] **Step 5: Implement attempt lifecycle**

Validate answers against the public answer schema before persistence. Save drafts without progression impact. On submit, persist immutable submission, invoke the evaluator registry, persist evaluation, and return the evaluated attempt.

- [ ] **Step 6: Verify privacy and lifecycle**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -count=1
```

Expected: PASS; public payload tests prove answer keys are absent.

- [ ] **Step 7: Commit**

```bash
git add internal/activity
git commit -m "feat: add activity attempt service"
```

### Task 9: Expose canonical activity APIs and typed browser client methods

**Files:**

- Create: `internal/server/activity_handlers.go`
- Create: `internal/server/activity_handlers_test.go`
- Modify: `internal/server/router.go`
- Modify: `internal/app/application.go`
- Modify: `packages/protocol/src/index.ts`
- Modify: `apps/web/src/shared/api/client.ts`
- Modify: `apps/web/src/shared/api/client.test.tsx`

**Interfaces:**

- Canonical owner-qualified API:

```text
GET  /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}
GET  /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts/current
PUT  /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts/current/draft
POST /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activities/{activityId}/attempts
GET  /api/v1/courses/{courseId}/{ownerKind}/{ownerId}/activity-sets/{setId}/progress
```

`ownerKind` accepts only `lessons` or `assessments`.

- [ ] **Step 1: Add failing handler tests**

Test session protection, owner-kind validation, answer-key-free GET response, draft revision conflict `409`, idempotent POST, malformed answer `422`, and stable error codes.

- [ ] **Step 2: Run server tests and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server -run Activity -count=1
```

- [ ] **Step 3: Register handlers through a router option**

Add:

```go
type routerOptions struct {
    progression progression.HierarchicalService
    activities  activity.Service
}

func WithActivities(service activity.Service) RouterOption {
    return func(options *routerOptions) { options.activities = service }
}
```

Register the five canonical endpoints only when the service is present.

- [ ] **Step 4: Add protocol and web-client methods**

Extend `SynaploomApiClient` with:

```ts
getActivity(owner: ActivityOwner, activityId: string): Promise<ActivityPublicView>;
getCurrentActivityAttempt(owner: ActivityOwner, activityId: string): Promise<ActivityAttempt | null>;
saveActivityDraft(owner: ActivityOwner, activityId: string, draft: SaveDraftPayload): Promise<ActivityAttempt>;
submitActivityAttempt(owner: ActivityOwner, activityId: string, payload: SubmitAttemptPayload): Promise<ActivityAttempt>;
getActivitySetProgress(owner: ActivityOwner, setId: string): Promise<ActivitySetProgress>;
```

Build URLs through one `activityOwnerPath(owner)` helper.

- [ ] **Step 5: Verify handlers and client URL contracts**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server -run Activity -count=1
pnpm exec vitest run --project dom apps/web/src/shared/api/client.test.tsx
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add internal/server internal/app/application.go packages/protocol apps/web/src/shared/api
git commit -m "feat: expose activity attempt APIs"
```

---

# Phase 4 — Evaluators and Activity-Set Completion

### Task 10: Implement choice and text evaluators

**Files:**

- Create: `internal/activity/evaluator.go`
- Create: `internal/activity/evaluator_choice.go`
- Create: `internal/activity/evaluator_choice_test.go`
- Create: `internal/activity/evaluator_text.go`
- Create: `internal/activity/evaluator_text_test.go`

**Interfaces:**

- Produces evaluators for `single-choice`, `multiple-choice`, `true-false`, `short-answer`, and `fill-blanks`.

- [ ] **Step 1: Add table-driven evaluator tests**

Cover exact-set and partial-credit multiple choice, Unicode normalization, case sensitivity, whitespace collapse, punctuation removal, safe-regex acceptance/rejection, per-blank and all-or-nothing scoring, malformed answer shapes, and reveal policy behavior.

- [ ] **Step 2: Confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -run 'Choice|Text|Blank' -count=1
```

- [ ] **Step 3: Implement the registry**

```go
type Evaluator interface {
    Kind() ActivityKind
    Evaluate(context.Context, ActivityDefinition, ActivityAnswer) (EvaluationResult, error)
}

type Registry struct { evaluators map[ActivityKind]Evaluator }

func (r Registry) Evaluate(ctx context.Context, definition ActivityDefinition, answer ActivityAnswer) (EvaluationResult, error) {
    evaluator, ok := r.evaluators[definition.Kind]
    if !ok { return EvaluationResult{}, ErrEvaluatorUnavailable }
    return evaluator.Evaluate(ctx, definition, answer)
}
```

- [ ] **Step 4: Implement deterministic normalization and scoring**

Store normalized learner answers in evaluation details; do not reveal accepted answers until policy allows.

- [ ] **Step 5: Verify**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -count=1
```

- [ ] **Step 6: Commit**

```bash
git add internal/activity/evaluator*
git commit -m "feat: evaluate choice and text activities"
```

### Task 11: Implement ordering, matching, numeric, and writing evaluators

**Files:**

- Create: `internal/activity/evaluator_ordering.go`
- Create: `internal/activity/evaluator_ordering_test.go`
- Create: `internal/activity/evaluator_matching.go`
- Create: `internal/activity/evaluator_matching_test.go`
- Create: `internal/activity/evaluator_numeric.go`
- Create: `internal/activity/evaluator_numeric_test.go`
- Create: `internal/activity/evaluator_writing.go`
- Create: `internal/activity/evaluator_writing_test.go`
- Create: `internal/activity/expression.go`
- Create: `internal/activity/units.go`

**Interfaces:**

- Produces deterministic evaluators for the remaining non-coding v1 kinds.

- [ ] **Step 1: Add evaluator tests**

Cover exact and adjacent-position ordering scores, one-to-one matching validation, decimal/scientific notation, absolute and relative tolerance, allowlisted unit normalization, arithmetic expression equivalence, invalid expression rejection, writing min/max length, and writing `passed=null` submission completion.

- [ ] **Step 2: Confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -run 'Ordering|Matching|Numeric|Writing' -count=1
```

- [ ] **Step 3: Implement limited expression parsing**

Use an explicit grammar for numbers, parentheses, unary signs, `+ - * / ^`, and allowlisted constants. Do not execute Go, JavaScript, or shell expressions. Compare expressions by deterministic sample evaluation over a fixed safe domain when symbolic normalization is insufficient.

- [ ] **Step 4: Implement unit normalization**

Support a fixed registry with canonical scale factors for common length, mass, time, temperature-delta, and angle units. Reject unknown or dimensionally incompatible units.

- [ ] **Step 5: Verify all evaluators**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -count=1
```

- [ ] **Step 6: Commit**

```bash
git add internal/activity/evaluator_ordering* internal/activity/evaluator_matching* \
  internal/activity/evaluator_numeric* internal/activity/evaluator_writing* \
  internal/activity/expression.go internal/activity/units.go
git commit -m "feat: evaluate structured and open activities"
```

### Task 12: Aggregate activity-set progress and integrate progression requirements

**Files:**

- Create: `internal/activity/set_progress.go`
- Create: `internal/activity/set_progress_test.go`
- Modify: `internal/progression/model.go`
- Modify: `internal/progression/normalize.go`
- Modify: `internal/progression/evaluator.go`
- Modify: `internal/progression/hierarchical_service.go`
- Modify: `internal/progression/*_test.go`
- Modify: `internal/storage/hierarchical_progress_repository.go`

**Interfaces:**

- Produces `ActivitySetProgress` and progression requirement kind `activity-set`.

- [ ] **Step 1: Add failing aggregation tests**

Cover practice completion, scored assessment thresholds, max attempts, unscored writing in practice, strict rejection of scored assessments containing submission-only writing, optional activities, and legacy coding-check mapping.

- [ ] **Step 2: Confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/progression -run 'ActivitySet|Requirement' -count=1
```

- [ ] **Step 3: Implement set aggregation**

Calculate required completed count, total score, maximum score, pass state, and status from persisted evaluated attempts and set policy.

- [ ] **Step 4: Replace UI-local/coding-check assumptions in progression**

Normalize lesson and assessment requirements to activity-set completion. Preserve legacy `practice` requirements by adapting the legacy coding activity into a synthetic set.

- [ ] **Step 5: Verify progression and restart persistence**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/progression ./internal/storage ./tests/go-integration -count=1
```

- [ ] **Step 6: Commit**

```bash
git add internal/activity/set_progress* internal/progression internal/storage/hierarchical_progress_repository.go tests/go-integration
git commit -m "feat: drive progression from activity sets"
```

---

# Phase 5 — Web Activity Engine and Unified Workspace

### Task 13: Build shared activity state and `ActivityHost`

**Files:**

- Create: `apps/web/src/features/activity-engine/types.ts`
- Create: `apps/web/src/features/activity-engine/useActivityAttempt.ts`
- Create: `apps/web/src/features/activity-engine/useActivityAttempt.test.tsx`
- Create: `apps/web/src/features/activity-engine/ActivityHost.tsx`
- Create: `apps/web/src/features/activity-engine/ActivityHost.test.tsx`
- Create: `apps/web/src/features/activity-engine/ActivityFeedback.tsx`
- Modify: `apps/web/src/shared/api/client.ts`

**Interfaces:**

- Produces:

```ts
export interface ActivityHostProps {
  readonly owner: ActivityOwner;
  readonly activity: ActivityPublicView;
  readonly policy: ActivitySetPolicy;
  readonly onProgressChanged: () => Promise<void> | void;
}
```

- [ ] **Step 1: Add failing state-machine tests**

Test not-started, draft, ready, submitting, evaluated, retry, max-attempt, network-error answer retention, and focus transfer to feedback heading.

- [ ] **Step 2: Confirm RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine
```

- [ ] **Step 3: Implement TanStack Query state flow**

Use owner/activity query keys; optimistic draft state must not overwrite newer revisions. Submission sends an idempotency key generated once per user action and invalidates activity attempt, set progress, navigation, lesson/assessment, and course queries after success.

- [ ] **Step 4: Implement exhaustive renderer dispatch**

Dispatch all ten public kinds and fail closed with a localized unsupported-activity error if the browser receives an unknown kind.

- [ ] **Step 5: Verify state and accessibility**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/activity-engine apps/web/src/shared/api/client.ts
git commit -m "feat: add web activity host"
```

### Task 14: Implement the nine non-coding activity renderers

**Files:**

- Create: `apps/web/src/features/activity-engine/renderers/ChoiceActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/TrueFalseActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/ShortAnswerActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/FillBlanksActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/MatchingActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/NumericActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/WritingActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/*.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Each renderer receives typed public config, current answer, disabled state, `onChange`, and `onSubmit` through a common internal renderer contract.

- [ ] **Step 1: Add keyboard and answer-retention tests for every renderer**

Required cases:

- radio arrow navigation;
- checkbox exact selection;
- true/false labeled controls;
- labeled blanks and error associations;
- ordering move-up/move-down controls with live announcement;
- matching select-based non-drag workflow;
- numeric source input and unit selector;
- writing character count live region;
- answer remains visible after a simulated failed submit.

- [ ] **Step 2: Confirm RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine/renderers
```

- [ ] **Step 3: Implement native-control-first renderers**

Use radio, checkbox, button, input, textarea, and select semantics. Drag-and-drop may supplement ordering but cannot be the only interaction path.

- [ ] **Step 4: Add consistent status and feedback styling**

Use one activity surface, status badge vocabulary, action placement, focus ring, disabled state, and feedback summary across all renderers.

- [ ] **Step 5: Verify**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine/renderers
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/activity-engine/renderers apps/web/src/application.css
git commit -m "feat: render multi-domain learning activities"
```

### Task 15: Embed activities into rich lessons and select workspace layouts

**Files:**

- Modify: `apps/web/src/features/lesson-content/LessonDocumentRenderer.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonContent.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces layout modes `reading`, `inline-activity`, `focused-activity`, and `split-coding` derived from typed content/activity capabilities.

- [ ] **Step 1: Add failing layout tests**

Test:

- reading-only lesson uses full width;
- inline deterministic activity appears at its document embed;
- unembedded activities append in manifest order;
- duplicate embed is rejected before rendering;
- assessment uses focused activity layout;
- coding activity uses split coding layout.

- [ ] **Step 2: Confirm RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

- [ ] **Step 3: Add activity lookup and embed rendering**

Pass `renderActivity(activityId)` to `LessonDocumentRenderer`. Track embedded IDs and append remaining activities after the document in set order.

- [ ] **Step 4: Derive layout from content**

Use an explicit pure resolver:

```ts
export function resolveWorkspaceLayout(input: {
  readonly hasDocument: boolean;
  readonly embeddedKinds: readonly ActivityKind[];
  readonly focusedKind: ActivityKind | null;
}): 'reading' | 'inline-activity' | 'focused-activity' | 'split-coding' {
  if (input.focusedKind === 'coding') return 'split-coding';
  if (input.focusedKind !== null) return 'focused-activity';
  if (input.embeddedKinds.length > 0) return 'inline-activity';
  return 'reading';
}
```

- [ ] **Step 5: Verify unified lesson/assessment flows**

```bash
pnpm exec vitest run --project dom apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx
pnpm build:web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/lesson-content apps/web/src/features/workspace-layout \
  apps/web/src/features/chapter-assessment apps/web/src/application.css
git commit -m "feat: embed activities in unified learning workspace"
```

---

# Phase 6 — Coding Compatibility, Assessment Migration, and Release

### Task 16: Adapt the existing coding workspace into `kind: coding`

**Files:**

- Create: `internal/activity/coding_adapter.go`
- Create: `internal/activity/coding_adapter_test.go`
- Create: `apps/web/src/features/activity-engine/renderers/CodingActivity.tsx`
- Create: `apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx`
- Modify: `apps/web/src/features/practice-runner/PracticePanel.tsx`
- Modify: `internal/course/filesystem_service.go`
- Modify: `internal/server/execution_handlers.go`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**

- Produces a legacy exercise adapter and a coding activity facade that reuses current workspace, files, actions, SSE, checks, and completion behavior.

- [ ] **Step 1: Add compatibility tests**

Assert a legacy `exercise.json` becomes one public coding activity with the same editable files, action labels, check requirements, and completion semantics. Assert run/check still records the coding activity-set completion used by progression.

- [ ] **Step 2: Confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/course ./internal/server -run Coding -count=1
pnpm exec vitest run --project dom apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx
```

- [ ] **Step 3: Implement the adapter at the course boundary**

Normalize legacy exercise fields to an internal coding activity definition. Do not duplicate runner logic in the activity package; delegate through an interface implemented by the existing course/practice service.

- [ ] **Step 4: Wrap `PracticePanel` as the coding renderer**

`CodingActivity` maps activity public view and activity owner identity to existing workspace/run APIs through a compatibility facade. Preserve current editor, terminal, reset, save, run, and check UX.

- [ ] **Step 5: Verify legacy example behavior**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/course ./internal/server ./tests/go-integration -count=1
pnpm exec vitest run --project dom apps/web/src/features/practice-runner apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add internal/activity/coding_adapter* internal/course/filesystem_service.go \
  internal/server/execution_handlers.go packages/protocol \
  apps/web/src/features/activity-engine/renderers/CodingActivity* \
  apps/web/src/features/practice-runner/PracticePanel.tsx
git commit -m "feat: adapt coding workspace to activity engine"
```

### Task 17: Migrate chapter assessments to activity sets

**Files:**

- Create: `internal/course/assessment_adapter.go`
- Create: `internal/course/assessment_adapter_test.go`
- Modify: `internal/server/chapter_assessment_handlers.go`
- Modify: `internal/server/chapter_assessment_handlers_test.go`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx`
- Modify: `internal/progression/hierarchical_service.go`

**Interfaces:**

- Assessment payload becomes an ordered activity set plus policy and progress; legacy assessment action remains a compatibility adapter only.

- [ ] **Step 1: Add failing assessment-engine tests**

Cover delayed feedback, max attempts, points aggregation, passing threshold, failed retry, completed assessment navigation, and legacy one-coding-activity normalization.

- [ ] **Step 2: Confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course ./internal/server ./internal/progression -run Assessment -count=1
pnpm exec vitest run --project dom apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx
```

- [ ] **Step 3: Replace assessment check mutation with activity submissions**

Return the assessment set definition, public activities, attempt state, and aggregate progress. Keep the old `/actions/check` endpoint for one compatibility window by translating its payload to a legacy coding activity submission.

- [ ] **Step 4: Render assessment activities through `ActivityHost`**

Remove assessment-specific pass/fail form logic. Use the shared activity engine and show assessment-level score/progress plus the progression footer.

- [ ] **Step 5: Verify assessment continuity**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/course ./internal/server ./internal/progression ./tests/go-integration -count=1
pnpm exec vitest run --project dom apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add internal/course/assessment_adapter* internal/server/chapter_assessment_handlers* \
  internal/progression/hierarchical_service.go apps/web/src/features/chapter-assessment
git commit -m "feat: migrate assessments to activity sets"
```

### Task 18: Add a complete multi-domain Course Schema 1.2 example

**Files:**

- Create: `examples/multi-domain-foundations/course.json`
- Create: `examples/multi-domain-foundations/lessons/programming/*`
- Create: `examples/multi-domain-foundations/lessons/mathematics/*`
- Create: `examples/multi-domain-foundations/lessons/english/*`
- Create: `examples/multi-domain-foundations/lessons/literature/*`
- Create: `examples/multi-domain-foundations/lessons/science-history/*`
- Create: `examples/multi-domain-foundations/assessments/*`
- Create: `tests/e2e/multi-domain-runtime.spec.ts`

**Interfaces:**

- Demonstrates all ten kinds and all four workspace layouts in one valid Course Schema 1.2 package.

- [x] **Step 1: Write failing validation and browser acceptance tests**

The acceptance flow must complete:

- programming ordering plus coding;
- math numeric/expression;
- English fill blanks and matching;
- literature short answer and writing;
- science/history ordering and multiple choice;
- one scored assessment.

- [x] **Step 2: Confirm RED**

```bash
pnpm course:validate examples/multi-domain-foundations
pnpm playwright test tests/e2e/multi-domain-runtime.spec.ts --project=go-runtime
```

Expected: FAIL because the example does not exist.

- [x] **Step 3: Author the example package**

Use local images/media only, provide all required alt/transcript/caption metadata, include rich directives and activity embeds, and ensure every activity kind appears at least once.

- [x] **Step 4: Verify validation and browser flows**

```bash
pnpm course:validate examples/multi-domain-foundations
pnpm playwright test tests/e2e/multi-domain-runtime.spec.ts --project=go-runtime
```

- [x] **Step 5: Commit**

```bash
git add examples/multi-domain-foundations tests/e2e/multi-domain-runtime.spec.ts
git commit -m "feat: add multi-domain activity course"
```

### Task 19: Publish authoring, migration, security, and release documentation

**Files:**

- Create: `docs/authoring/rich-lesson-content.md`
- Create: `docs/authoring/activity-engine.md`
- Create: `docs/authoring/activity-kinds.md`
- Create: `docs/migrations/course-schema-1.2.md`
- Create: `docs/security/activity-engine-boundaries.md`
- Create: `docs/testing/activity-engine-manual-verification.md`
- Modify: `README.md`
- Modify: `internal/buildinfo/buildinfo.go`
- Modify: `.github/workflows/go-release.yml`
- Modify: `package.json`

**Interfaces:**

- Build metadata and `doctor --json` advertise Course Schema `1.2.0`; release workflow validates old examples and the new multi-domain example.

- [x] **Step 1: Add failing documentation/release contract tests**

Create a Node test asserting the six documents exist, no placeholder language remains, build metadata reports `1.2.0`, and CI runs schema, Go, DOM, browser, and multi-domain validation gates.

- [x] **Step 2: Confirm RED**

```bash
node --experimental-strip-types --test tests/activity-engine-docs.spec.ts
```

- [x] **Step 3: Write authoring and migration documentation**

Document exact JSON examples for every activity kind, directive syntax, attempt policies, reveal policies, answer-key security, accessibility expectations, legacy exercise migration, and unsupported v2 capabilities.

- [x] **Step 4: Update release gates and metadata**

Add scripts:

```json
{
  "validate:multi-domain": "pnpm course:validate examples/multi-domain-foundations",
  "test:activity-engine": "pnpm exec vitest run --project dom apps/web/src/features/activity-engine && bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/course ./internal/server ./internal/progression ./internal/storage"
}
```

Run them in `.github/workflows/go-release.yml` before native artifact builds.

- [x] **Step 5: Run final verification**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm contracts:check
pnpm test
pnpm go:test
pnpm go:vet
pnpm go:staticcheck
pnpm validate:example
pnpm validate:multi-domain
pnpm go:stage-web
pnpm playwright test --project=go-runtime
```

Expected: all gates pass; old Course Schema 1.0/1.1 examples and new 1.2 example are valid and runnable.

- [x] **Step 6: Commit**

```bash
git add docs README.md internal/buildinfo/buildinfo.go .github/workflows/go-release.yml package.json tests/activity-engine-docs.spec.ts
git commit -m "docs: publish activity engine authoring and release gates"
```

---

## Final Program Verification

After all tasks are complete, run these gates from a clean working tree:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm contracts:check
pnpm test
pnpm go:test
pnpm go:vet
pnpm go:staticcheck
bash scripts/go/with-internal-toolchain.sh test -race ./internal/activity/... ./internal/course/... ./internal/progression/... ./internal/server/... ./internal/storage/...
pnpm validate:example
pnpm validate:multi-domain
pnpm go:stage-web
pnpm playwright test --project=go-runtime
pnpm go:release
pnpm go:verify-release
pnpm go:write-release-evidence
```

Manual acceptance must confirm:

1. Top steps switch to the viewed chapter and never render items from other chapters.
2. Course-wide selectors, curriculum popover, previous, and next still cross chapter boundaries.
3. Rich document nodes render with safe links, local media, transcripts, tables, math, directives, and activity embeds.
4. Every deterministic activity is keyboard-completable.
5. Writing completes by submission without a fabricated score.
6. Correct answers remain absent until reveal policy permits them.
7. Drafts survive restart; submitted attempts are immutable and idempotent.
8. Coding exercises retain editor, terminal, files, run/check, and progression behavior.
9. Practice and assessment use the same `ActivityHost` with policy differences.
10. Existing 1.0/1.1 courses remain runnable and the 1.2 multi-domain example covers all ten kinds.
