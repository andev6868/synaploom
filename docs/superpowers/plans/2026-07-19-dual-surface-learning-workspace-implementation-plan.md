# Dual-Surface Learning Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coding-only split layout with a backend-persisted, activity-neutral Dual-Surface Learning Workspace shared by lessons and assessments.

**Architecture:** Add canonical activity presentation metadata and an owner-scoped workspace presentation service backed by SQLite optimistic revisions. A React workspace controller coordinates Activity Engine save-before-switch semantics with the presentation API, while reusable theory, practice, rail, tray, summary, and responsive shell components ensure only one editable activity renderer is mounted. Existing activity evaluators and attempt persistence remain authoritative for answers and feedback.

**Tech Stack:** React 19, TypeScript 6, TanStack Query 5, Radix Dialog, react-resizable-panels, Vitest/Testing Library, Playwright, Go 1.26.5, `net/http`, SQLite through `modernc.org/sqlite`, generated JSON Schema contracts.

## Global Constraints

- Node.js must remain `>=22.13.0`; pnpm must remain `11.13.0`; Go must remain `1.26` with toolchain `go1.26.5`.
- Backend state is authoritative; do not add `localStorage`, IndexedDB, or browser-memory persistence as a second source of truth.
- Version 1 does not synchronize presentation changes proactively across tabs or devices.
- Version 1 supports one focused activity only; do not add multiple panes, detachable windows, cross-lesson pinning, collaborative editing, or user-defined pane presets.
- Do not allow authored forced-open behavior to override an existing learner collapse preference.
- Persist presentation state by `profile_id + course_id + owner_kind + owner_id`; use profile ID `local` until authentication introduces explicit profiles.
- API owner kinds remain plural: `lessons | assessments`. Activity Engine internal owner kinds remain singular: `lesson | assessment`.
- Clamp Theory Pane ratio to `[0.32, 0.68]`; use `0.45` as the new split default.
- Persist only after discrete actions: focus, collapse, expand/split, return inline, and completed divider drag.
- A focused activity must have exactly one editable renderer. Its Theory Pane representation is a read-only summary even when Practice Pane is collapsed.
- Save the dirty activity before any transition that would unmount or replace its editable renderer. A failed save blocks that transition.
- Closing/collapsing Practice Pane preserves `focusedActivityId`; returning an activity inline clears `focusedActivityId`.
- Learner-persisted state outranks authored presentation metadata; authored metadata outranks system defaults.
- Do not include answers, source code, essay text, prompts, evaluator feedback bodies, tokens, or keys in structured workspace events.
- Keep the legacy `/api/v1/preferences/pane-ratio` compatibility stub during this delivery; the new frontend must not call it.
- Do not change activity evaluation, scoring, reveal policy, progression requirements, canonical lesson URLs, or canonical assessment URLs.

---

## File Structure Map

### Contract and authoring boundary

- `schemas/v1/activity.schema.json`: optional authored `presentation` metadata and validation shape.
- `schemas/v1/activity-public.schema.json`: normalized presentation metadata exposed to the learner UI.
- `schemas/v1/workspace-presentation.schema.json`: API state, update request, activity status summary, and pane mode contracts.
- `generated/typescript/index.ts`, `generated/go/contracts/generated.go`, `internal/contracts/schemas.go`: generated outputs only.
- `packages/contracts/src/index.ts`: stable TypeScript aliases for activity presentation types.
- `packages/protocol/src/index.ts`: stable API aliases and error-detail typing.

### Backend state and orchestration

- `internal/storage/migrations/005_workspace_presentation.sql`: owner-scoped persistence table and indexes.
- `internal/storage/workspace_presentation_repository.go`: SQLite optimistic create/read/update implementation.
- `internal/workspacepresentation/model.go`: domain identities, commands, state, errors, and constants.
- `internal/workspacepresentation/service.go`: default resolution, focus validation, normalization, conflict handling, and event emission.
- `internal/server/workspace_presentation_handlers.go`: GET/PUT HTTP boundary.
- `internal/app/application.go`: service construction and router wiring.

### Activity Engine integration

- `internal/activity/presentation.go`: canonical system presentation defaults and normalized public policy.
- `internal/activity/status.go`: owner activity status summaries for Activity Tray.
- `apps/web/src/features/activity-engine/types.ts`: save lifecycle handle shared with workspace controller.
- `apps/web/src/features/activity-engine/useActivityAttempt.ts`: rejecting save path for transition safety.
- `apps/web/src/features/practice-runner/PracticePanel.tsx`: coding dirty-state and imperative save lifecycle.

### Frontend workspace feature

- `apps/web/src/features/learning-workspace/workspace-model.ts`: pure flattening, lookup, next-activity, and status helpers.
- `apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts`: presentation query/mutations and save-before-switch transaction.
- `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`: collapsed/split/expanded and responsive surface mapping.
- `apps/web/src/features/learning-workspace/PracticePane.tsx`: focused activity host, header, feedback region, and action bar.
- `apps/web/src/features/learning-workspace/ActivityTray.tsx`: authored ordering and status navigation.
- `apps/web/src/features/learning-workspace/WorkspacePaneRail.tsx`: collapsed entry point.
- `apps/web/src/features/learning-workspace/InlineActivitySlot.tsx`: editable inline activity, launch card, or focused summary.
- `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`: shared lesson/assessment composition root.

---

### Task 1: Add Generated Presentation Contracts

**Files:**

- Create: `schemas/v1/workspace-presentation.schema.json`
- Modify: `schemas/v1/activity.schema.json`
- Modify: `schemas/v1/activity-public.schema.json`
- Modify: `scripts/contracts/generate-typescript.mjs`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/index.test.ts`
- Regenerate: `generated/typescript/index.ts`
- Regenerate: `generated/go/contracts/generated.go`
- Regenerate: `internal/contracts/schemas.go`

**Interfaces:**

- Produces:

```ts
export type ActivitySurface = 'inline' | 'practice' | 'auto';
export type ActivityPreferredWidth = 'compact' | 'standard' | 'wide';

export interface ActivityPresentation {
  readonly defaultSurface: ActivitySurface;
  readonly allowInline: boolean;
  readonly allowPractice: boolean;
  readonly preferredWidth: ActivityPreferredWidth;
  readonly supportsFullscreen: boolean;
}

export type PracticePaneMode = 'collapsed' | 'split' | 'expanded';

export interface WorkspacePresentationState {
  readonly courseId: string;
  readonly ownerKind: 'lessons' | 'assessments';
  readonly ownerId: string;
  readonly focusedActivityId: string | null;
  readonly paneMode: PracticePaneMode;
  readonly splitRatio: number;
  readonly userCollapsed: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface UpdateWorkspacePresentationPayload {
  readonly focusedActivityId: string | null;
  readonly paneMode: PracticePaneMode;
  readonly splitRatio: number;
  readonly userCollapsed: boolean;
  readonly revision: number;
}

export type ActivityWorkspaceStatus =
  | 'AVAILABLE'
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'PASSED'
  | 'FAILED';

export interface ActivityStatusPayload {
  readonly activityId: string;
  readonly status: ActivityWorkspaceStatus;
  readonly attemptNumber: number;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly passed: boolean | null;
}
```

- `ActivityDefinition.presentation` is optional for backward-compatible course authoring.
- `ActivityPublicView.presentation` is required because the Go public-view layer normalizes omitted metadata.
- Extend `ApiErrorPayload.details` with an optional `currentWorkspacePresentation` member and keep unknown detail keys representable:

```ts
export interface ApiErrorDetails {
  readonly currentWorkspacePresentation?: WorkspacePresentationState;
  readonly [key: string]: unknown;
}

export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly details?: ApiErrorDetails;
  readonly currentLessonId?: string;
  readonly blockingRequirements?: readonly RequirementView[];
  readonly currentTarget?: NavigationTarget;
}
```

- [ ] **Step 1: Write failing TypeScript contract tests**

Add assertions that compile and inspect the new shapes:

```ts
import type {
  ActivityDefinition,
  ActivityPresentation,
  ActivityPublicView,
} from '@synaploom/contracts';
import type {
  ActivityStatusPayload,
  ApiErrorDetails,
  UpdateWorkspacePresentationPayload,
  WorkspacePresentationState,
} from '@synaploom/protocol';

it('exposes authored and normalized activity presentation contracts', () => {
  const presentation: ActivityPresentation = {
    defaultSurface: 'practice',
    allowInline: true,
    allowPractice: true,
    preferredWidth: 'wide',
    supportsFullscreen: true,
  };
  const authored = { presentation } as ActivityDefinition;
  const publicView = { presentation } as ActivityPublicView;
  expect(authored.presentation).toEqual(presentation);
  expect(publicView.presentation.defaultSurface).toBe('practice');
});

it('exposes owner-scoped workspace presentation protocol', () => {
  const update: UpdateWorkspacePresentationPayload = {
    focusedActivityId: 'event-loop-lab',
    paneMode: 'split',
    splitRatio: 0.45,
    userCollapsed: false,
    revision: 2,
  };
  const state: WorkspacePresentationState = {
    courseId: 'frontend-performance-foundations',
    ownerKind: 'lessons',
    ownerId: 'event-loop',
    updatedAt: '2026-07-19T00:00:00Z',
    ...update,
  };
  const status: ActivityStatusPayload = {
    activityId: 'event-loop-lab',
    status: 'DRAFT',
    attemptNumber: 1,
    score: null,
    maxScore: null,
    passed: null,
  };
  const errorDetails: ApiErrorDetails = {
    currentWorkspacePresentation: state,
    diagnostic: 'stale revision',
  };
  expect(state.revision).toBe(2);
  expect(status.status).toBe('DRAFT');
  expect(errorDetails.currentWorkspacePresentation?.ownerId).toBe('event-loop');
});
```

- [ ] **Step 2: Run contract tests and confirm RED**

Run:

```bash
pnpm exec vitest run packages/contracts/src/index.test.ts packages/protocol/src/index.test.ts
```

Expected: TypeScript compilation fails because the presentation and workspace protocol types do not exist.

- [ ] **Step 3: Add presentation definitions to activity schemas**

Add this `$defs` entry to `activity.schema.json` and reference it from the activity definition:

```json
"activityPresentation": {
  "title": "ActivityPresentation",
  "type": "object",
  "required": [
    "defaultSurface",
    "allowInline",
    "allowPractice",
    "preferredWidth",
    "supportsFullscreen"
  ],
  "properties": {
    "defaultSurface": { "enum": ["inline", "practice", "auto"] },
    "allowInline": { "type": "boolean" },
    "allowPractice": { "type": "boolean" },
    "preferredWidth": { "enum": ["compact", "standard", "wide"] },
    "supportsFullscreen": { "type": "boolean" }
  },
  "additionalProperties": false
}
```

Add to the authored activity properties:

```json
"presentation": {
  "$ref": "#/$defs/activityPresentation"
}
```

Add `presentation` as a required property of `activity-public.schema.json` and reference the authored definition:

```json
"presentation": {
  "$ref": "activity.schema.json#/$defs/activityPresentation"
}
```

- [ ] **Step 4: Create the workspace presentation schema**

Create a Draft 2020-12 schema whose named definitions are exactly:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.synaploom.dev/v1/workspace-presentation.schema.json",
  "title": "WorkspacePresentationContracts",
  "type": "object",
  "$defs": {
    "practicePaneMode": {
      "title": "PracticePaneMode",
      "enum": ["collapsed", "split", "expanded"]
    },
    "workspacePresentationState": {
      "title": "WorkspacePresentationState",
      "type": "object",
      "required": [
        "courseId",
        "ownerKind",
        "ownerId",
        "focusedActivityId",
        "paneMode",
        "splitRatio",
        "userCollapsed",
        "revision",
        "updatedAt"
      ],
      "properties": {
        "courseId": { "type": "string", "minLength": 1 },
        "ownerKind": { "enum": ["lessons", "assessments"] },
        "ownerId": { "type": "string", "minLength": 1 },
        "focusedActivityId": { "type": ["string", "null"] },
        "paneMode": { "$ref": "#/$defs/practicePaneMode" },
        "splitRatio": { "type": "number", "minimum": 0.32, "maximum": 0.68 },
        "userCollapsed": { "type": "boolean" },
        "revision": { "type": "integer", "minimum": 0 },
        "updatedAt": { "type": "string", "minLength": 1 }
      },
      "additionalProperties": false
    },
    "updateWorkspacePresentationPayload": {
      "title": "UpdateWorkspacePresentationPayload",
      "type": "object",
      "required": [
        "focusedActivityId",
        "paneMode",
        "splitRatio",
        "userCollapsed",
        "revision"
      ],
      "properties": {
        "focusedActivityId": { "type": ["string", "null"] },
        "paneMode": { "$ref": "#/$defs/practicePaneMode" },
        "splitRatio": { "type": "number" },
        "userCollapsed": { "type": "boolean" },
        "revision": { "type": "integer", "minimum": 0 }
      },
      "additionalProperties": false
    },
    "activityWorkspaceStatus": {
      "title": "ActivityWorkspaceStatus",
      "enum": ["AVAILABLE", "DRAFT", "IN_PROGRESS", "PASSED", "FAILED"]
    },
    "activityStatusPayload": {
      "title": "ActivityStatusPayload",
      "type": "object",
      "required": [
        "activityId",
        "status",
        "attemptNumber",
        "score",
        "maxScore",
        "passed"
      ],
      "properties": {
        "activityId": { "type": "string", "minLength": 1 },
        "status": { "$ref": "#/$defs/activityWorkspaceStatus" },
        "attemptNumber": { "type": "integer", "minimum": 0 },
        "score": { "type": ["number", "null"] },
        "maxScore": { "type": ["number", "null"] },
        "passed": { "type": ["boolean", "null"] }
      },
      "additionalProperties": false
    }
  }
}
```

- [ ] **Step 5: Namespace generated TypeScript and export stable aliases**

Add `workspace-presentation.schema.json` to the namespace map as `WorkspacePresentationSchema`, then export stable aliases from `generated/typescript/index.ts` through the generator:

```ts
export type PracticePaneMode = WorkspacePresentationSchema.PracticePaneMode;
export type WorkspacePresentationState =
  WorkspacePresentationSchema.WorkspacePresentationState;
export type UpdateWorkspacePresentationPayload =
  WorkspacePresentationSchema.UpdateWorkspacePresentationPayload;
export type ActivityWorkspaceStatus =
  WorkspacePresentationSchema.ActivityWorkspaceStatus;
export type ActivityStatusPayload = WorkspacePresentationSchema.ActivityStatusPayload;
```

Re-export `ActivityPresentation` from `packages/contracts/src/index.ts` and workspace aliases from `packages/protocol/src/index.ts`.

- [ ] **Step 6: Regenerate and verify generated contracts**

Run:

```bash
pnpm contracts:generate
pnpm contracts:check
pnpm exec vitest run packages/contracts/src/index.test.ts packages/protocol/src/index.test.ts
```

Expected: generated checks pass and both test files pass.

- [ ] **Step 7: Commit**

```bash
git add schemas/v1 scripts/contracts generated packages/contracts packages/protocol internal/contracts
git commit -m "feat: add workspace presentation contracts"
```

---

### Task 2: Normalize Activity Presentation and Expose Activity Statuses

**Files:**

- Create: `internal/activity/presentation.go`
- Create: `internal/activity/presentation_test.go`
- Create: `internal/activity/status.go`
- Create: `internal/activity/status_test.go`
- Modify: `internal/activity/model.go`
- Modify: `internal/activity/public_view.go`
- Modify: `internal/activity/public_view_test.go`
- Modify: `internal/activity/service.go`
- Modify: `internal/activity/service_test.go`
- Modify: `internal/course/activity_validation.go`
- Modify: `internal/course/activity_validation_test.go`
- Modify: `packages/course-validator/src/index.ts`
- Modify: `packages/course-validator/src/index.test.ts`

**Interfaces:**

- Produces:

```go
type ActivityPresentation struct {
    DefaultSurface     string `json:"defaultSurface"`
    AllowInline        bool   `json:"allowInline"`
    AllowPractice      bool   `json:"allowPractice"`
    PreferredWidth     string `json:"preferredWidth"`
    SupportsFullscreen bool   `json:"supportsFullscreen"`
}

func ResolvePresentation(definition ActivityDefinition) ActivityPresentation

type ActivityStatus struct {
    ActivityID    string  `json:"activityId"`
    Status        string  `json:"status"`
    AttemptNumber int     `json:"attemptNumber"`
    Score         *float64 `json:"score"`
    MaxScore      *float64 `json:"maxScore"`
    Passed        *bool   `json:"passed"`
}
```

- Extends `activity.Service` with:

```go
ActivityStatuses(context.Context, OwnerIdentity) ([]ActivityStatus, error)
```

- [ ] **Step 1: Write failing presentation policy tests**

Use table-driven tests with these expectations:

```go
cases := []struct {
    kind activity.ActivityKind
    config map[string]any
    surface string
    width string
}{
    {activity.ActivityKindTrueFalse, map[string]any{}, "inline", "compact"},
    {activity.ActivityKindSingleChoice, map[string]any{"options": []any{1, 2}}, "inline", "compact"},
    {activity.ActivityKindSingleChoice, map[string]any{"options": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
    {activity.ActivityKindShortAnswer, map[string]any{}, "inline", "compact"},
    {activity.ActivityKindFillBlanks, map[string]any{}, "inline", "compact"},
    {activity.ActivityKindNumeric, map[string]any{}, "inline", "compact"},
    {activity.ActivityKindMultipleChoice, map[string]any{"options": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
    {activity.ActivityKindOrdering, map[string]any{"items": []any{1, 2, 3, 4, 5, 6, 7}}, "practice", "standard"},
    {activity.ActivityKindMatching, map[string]any{"left": []any{1, 2, 3, 4, 5, 6}}, "practice", "standard"},
    {activity.ActivityKindWriting, map[string]any{}, "practice", "wide"},
    {activity.ActivityKindCoding, map[string]any{}, "practice", "wide"},
}
```

Also verify an authored non-`auto` policy wins and is copied to the public view.

- [ ] **Step 2: Run Go activity tests and confirm RED**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity -run 'Presentation|PublicView' -count=1
```

Expected: fail because `ActivityPresentation` and `ResolvePresentation` do not exist.

- [ ] **Step 3: Implement deterministic system defaults**

Use these exact thresholds:

```go
func ResolvePresentation(definition ActivityDefinition) ActivityPresentation {
    if definition.Presentation != nil && definition.Presentation.DefaultSurface != "auto" {
        return *definition.Presentation
    }

    resolved := ActivityPresentation{
        DefaultSurface: "inline",
        AllowInline: true,
        AllowPractice: true,
        PreferredWidth: "compact",
        SupportsFullscreen: false,
    }
    switch definition.Kind {
    case ActivityKindWriting, ActivityKindCoding:
        resolved.DefaultSurface = "practice"
        resolved.PreferredWidth = "wide"
        resolved.SupportsFullscreen = true
    case ActivityKindSingleChoice, ActivityKindMultipleChoice:
        if collectionLength(definition.Config, "options") > 6 {
            resolved.DefaultSurface = "practice"
            resolved.PreferredWidth = "standard"
        }
    case ActivityKindOrdering:
        if collectionLength(definition.Config, "items") > 6 {
            resolved.DefaultSurface = "practice"
            resolved.PreferredWidth = "standard"
        }
    case ActivityKindMatching:
        if collectionLength(definition.Config, "left") > 5 || collectionLength(definition.Config, "right") > 5 {
            resolved.DefaultSurface = "practice"
            resolved.PreferredWidth = "standard"
        }
    }

    if definition.Presentation == nil {
        return resolved
    }

    authored := *definition.Presentation
    authored.DefaultSurface = resolved.DefaultSurface
    if authored.DefaultSurface == "practice" && !authored.AllowPractice {
        authored.DefaultSurface = "inline"
    }
    if authored.DefaultSurface == "inline" && !authored.AllowInline {
        authored.DefaultSurface = "practice"
    }
    return authored
}
```

Add `Presentation *ActivityPresentation` to `ActivityDefinition` and required `Presentation ActivityPresentation` to `PublicActivityView`. Parse authored metadata in `DefinitionFromMap` and emit normalized metadata in `publicView`.

- [ ] **Step 4: Add impossible-policy validation in Go and TypeScript**

Both validators must emit `ACTIVITY_PRESENTATION_INVALID` for these cases:

```text
allowInline=false and allowPractice=false
defaultSurface=inline and allowInline=false
defaultSurface=practice and allowPractice=false
supportsFullscreen=true and allowPractice=false
```

Add explicit fixtures in both test suites rather than relying only on JSON Schema validation.

- [ ] **Step 5: Write failing activity status tests**

Create repository doubles with owner attempts and assert:

```go
want := []activity.ActivityStatus{
    {ActivityID: "fresh", Status: "AVAILABLE", AttemptNumber: 0},
    {ActivityID: "draft", Status: "DRAFT", AttemptNumber: 1},
    {ActivityID: "passed", Status: "PASSED", AttemptNumber: 1, Passed: boolPtr(true)},
    {ActivityID: "failed", Status: "FAILED", AttemptNumber: 2, Passed: boolPtr(false)},
}
```

The service must return statuses in authored set order, deduplicate activities referenced by only one valid set, and select the highest submitted attempt number as the latest result.

- [ ] **Step 6: Implement `ActivityStatuses`**

Flatten `PublicActivitySets`, load `ListOwnerAttempts`, index draft and latest submitted/evaluated record per activity, and map state with this order:

```go
switch {
case draft != nil:
    status.Status = "DRAFT"
case latest == nil:
    status.Status = "AVAILABLE"
case latest.Status == storage.ActivityAttemptStatusSubmitted:
    status.Status = "IN_PROGRESS"
case latest.Passed != nil && *latest.Passed:
    status.Status = "PASSED"
default:
    status.Status = "FAILED"
}
```

- [ ] **Step 7: Run focused suites and generated validation**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/activity ./internal/course -count=1
pnpm exec vitest run packages/course-validator/src/index.test.ts
pnpm contracts:check
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add internal/activity internal/course packages/course-validator
git commit -m "feat: resolve activity presentation policies"
```

---

### Task 3: Persist Workspace Presentation State in SQLite

**Files:**

- Create: `internal/storage/migrations/005_workspace_presentation.sql`
- Create: `internal/storage/workspace_presentation_repository.go`
- Create: `internal/storage/workspace_presentation_repository_test.go`
- Modify: `internal/storage/migrate_test.go`

**Interfaces:**

```go
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
```

- [ ] **Step 1: Write failing migration and repository tests**

Tests must verify:

```go
record, err := repository.Put(ctx, storage.WorkspacePresentationWrite{
    Key: storage.WorkspacePresentationKey{
        ProfileID: "local", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a",
    },
    PaneMode: "collapsed", SplitRatio: 0.45, ExpectedRevision: 0, At: fixedTime,
})
require.NoError(t, err)
require.Equal(t, int64(1), record.Revision)
```

Then update with expected revision `1`, assert revision `2`, attempt another update with expected revision `1`, and assert `ErrWorkspacePresentationRevisionConflict`.

Open the same database path again and verify the row survives restart. Insert rows for another owner and another profile and verify isolation.

- [ ] **Step 2: Run storage tests and confirm RED**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/storage -run 'WorkspacePresentation|Migration' -count=1
```

Expected: fail because migration `005` and repository types do not exist.

- [ ] **Step 3: Add the migration**

Use this exact SQL:

```sql
CREATE TABLE workspace_presentation_states (
  profile_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('lessons', 'assessments')),
  owner_id TEXT NOT NULL,
  focused_activity_id TEXT,
  pane_mode TEXT NOT NULL CHECK (pane_mode IN ('collapsed', 'split', 'expanded')),
  split_ratio REAL NOT NULL,
  user_collapsed INTEGER NOT NULL CHECK (user_collapsed IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, course_id, owner_kind, owner_id)
);

CREATE INDEX workspace_presentation_states_course_owner
ON workspace_presentation_states(course_id, owner_kind, owner_id);
```

- [ ] **Step 4: Implement atomic insert/update semantics**

`Put` must:

1. Validate non-empty key fields and allowed owner/pane values.
2. Start a transaction.
3. Read the current row.
4. Insert only when no row exists and `ExpectedRevision == 0`.
5. Update with `WHERE revision = ?` and `revision = revision + 1` when a row exists.
6. Return `ErrWorkspacePresentationRevisionConflict` when the expected revision does not match.
7. Normalize timestamps to UTC RFC3339Nano.

Use SQL parameters for every value and scan booleans as integers.

- [ ] **Step 5: Run storage suite and migration checksum checks**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/storage -count=1
```

Expected: all storage tests pass, including backup and migration checksum tests.

- [ ] **Step 6: Commit**

```bash
git add internal/storage
git commit -m "feat: persist workspace presentation state"
```

---

### Task 4: Add Workspace Presentation Domain Service

**Files:**

- Create: `internal/workspacepresentation/model.go`
- Create: `internal/workspacepresentation/service.go`
- Create: `internal/workspacepresentation/service_test.go`

**Interfaces:**

```go
const LocalProfileID = "local"
const DefaultSplitRatio = 0.45
const MinSplitRatio = 0.32
const MaxSplitRatio = 0.68

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

type ConflictError struct {
    Current State
}

type Service interface {
    Get(context.Context, string, Owner) (State, error)
    Update(context.Context, UpdateCommand) (State, error)
}

type ServiceImpl struct {
    repository            storage.WorkspacePresentationRepository
    activities            activity.Service
    courseVersionResolver CourseVersionResolver
    events                EventSink
}
```

`NewService(...)` returns `Service`. Keep the implementation on `ServiceImpl` so the HTTP layer depends on the narrow interface rather than a concrete type.

- [ ] **Step 1: Write failing default-resolution tests**

Provide an `activity.Service` double returning activities in authored order. Verify:

```go
state, err := service.Get(ctx, "local", workspacepresentation.Owner{
    CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a",
})
require.NoError(t, err)
require.Equal(t, "coding-lab", *state.FocusedActivityID)
require.Equal(t, "split", state.PaneMode)
require.Equal(t, 0.45, state.SplitRatio)
require.False(t, state.UserCollapsed)
require.Equal(t, int64(0), state.Revision)
```

For a reading-only owner or an owner whose activities resolve inline, assert null focus and collapsed mode.

- [ ] **Step 2: Write failing normalization and conflict tests**

Cover:

- ratio `0.1` becomes `0.32`;
- ratio `0.9` becomes `0.68`;
- opening an activity forces `userCollapsed=false`;
- collapsed mode with valid focus may preserve `userCollapsed=true`;
- null focus forces `paneMode=collapsed` and `userCollapsed=false`;
- unknown focused activity is rejected on update;
- an owned activity with normalized `allowPractice=false` is rejected on update;
- `paneMode=expanded` is rejected when the focused activity has `supportsFullscreen=false`;
- stale revision returns `ConflictError` containing the current row;
- persisted invalid focus is cleared and stored as collapsed with one revision increment;
- persisted learner collapse is returned instead of the authored coding default.

- [ ] **Step 3: Run domain tests and confirm RED**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/workspacepresentation -count=1
```

Expected: package does not exist.

- [ ] **Step 4: Implement owner conversion and activity lookup**

Convert API owners before calling Activity Engine:

```go
func activityOwner(owner Owner, courseVersion string) (activity.OwnerIdentity, error) {
    kind := activity.OwnerKindLesson
    if owner.OwnerKind == "assessments" {
        kind = activity.OwnerKindAssessment
    } else if owner.OwnerKind != "lessons" {
        return activity.OwnerIdentity{}, ErrOwnerInvalid
    }
    return activity.OwnerIdentity{
        CourseID: owner.CourseID,
        CourseVersion: courseVersion,
        Kind: kind,
        ID: owner.OwnerID,
    }, nil
}
```

The service constructor must receive a course-version resolver because Activity Engine identities include version while workspace presentation rows intentionally do not:

```go
type CourseVersionResolver interface {
    CourseVersion(context.Context, string) (string, error)
}
```

In application wiring, the current filesystem graph supplies the known course version.

- [ ] **Step 5: Implement default state and persisted normalization**

Flatten `PublicActivitySets` in authored order. Select the first **required** activity whose normalized `presentation.defaultSurface` is `practice` and whose `allowPractice` is true; when no required candidate exists, select the first optional candidate with the same policy. This preserves the migration rule that an existing coding lesson initially focuses its first required coding activity while still supporting authored practice defaults for other kinds.

For invalid stored focus, write a corrected row with:

```go
FocusedActivityID: nil,
PaneMode: "collapsed",
SplitRatio: clampRatio(record.SplitRatio),
UserCollapsed: false,
ExpectedRevision: record.Revision,
```

Emit `workspace.presentation.invalid_focus_recovered` without answer data.

- [ ] **Step 6: Implement update and conflict mapping**

Before repository write:

```go
if command.FocusedActivityID == nil {
    command.PaneMode = "collapsed"
    command.UserCollapsed = false
}
if command.PaneMode != "collapsed" {
    command.UserCollapsed = false
}
command.SplitRatio = clampRatio(command.SplitRatio)
```

Validate focused activity ownership through `PublicActivity` and reject focus when normalized `presentation.allowPractice` is false. Map this to domain error `ErrActivityPracticeSurfaceNotAllowed`. When `paneMode` is `expanded`, require `presentation.supportsFullscreen=true` and otherwise return `ErrActivityFullscreenNotSupported`. On repository conflict, re-read the current state and return `ConflictError{Current: current}`.

- [ ] **Step 7: Add a narrow event sink**

Accept this interface:

```go
type EventSink interface {
    Write(event string, fields map[string]any)
}
```

Emit only IDs, pane mode, ratio, revision, transition type, and error code. Never pass fields named `answer`, `content`, `source`, `prompt`, or `feedback`.

- [ ] **Step 8: Run service tests**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/workspacepresentation -count=1
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add internal/workspacepresentation
git commit -m "feat: orchestrate workspace presentation state"
```

---

### Task 5: Expose Owner-Scoped Presentation and Status APIs

**Files:**

- Create: `internal/server/workspace_presentation_handlers.go`
- Create: `internal/server/workspace_presentation_handlers_test.go`
- Modify: `internal/server/activity_handlers.go`
- Modify: `internal/server/activity_handlers_test.go`
- Modify: `internal/server/router.go`
- Modify: `internal/app/application.go`
- Modify: `apps/web/src/shared/api/client.ts`
- Modify: `apps/web/src/shared/api/client.test.tsx`
- Modify: `apps/web/src/features/activity-engine/useActivityAttempt.test.tsx`
- Modify: `apps/web/src/features/practice-runner/PracticePanel.test.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`

**Interfaces:**

- Routes:

```text
GET /api/v1/courses/:courseId/:ownerKind/:ownerId/workspace-presentation
PUT /api/v1/courses/:courseId/:ownerKind/:ownerId/workspace-presentation
GET /api/v1/courses/:courseId/:ownerKind/:ownerId/activity-statuses
```

- Extends `SynaploomApiClient`:

```ts
getWorkspacePresentation(owner: ActivityOwner): Promise<WorkspacePresentationState>;
updateWorkspacePresentation(
  owner: ActivityOwner,
  payload: UpdateWorkspacePresentationPayload,
): Promise<WorkspacePresentationState>;
getActivityStatuses(owner: ActivityOwner): Promise<readonly ActivityStatusPayload[]>;
```

- Extends `SynaploomApiError` with:

```ts
readonly currentWorkspacePresentation: WorkspacePresentationState | undefined;
```

- [ ] **Step 1: Write failing Go handler tests**

Verify:

- GET returns normalized state with HTTP 200;
- PUT rejects unknown fields because the decoder uses `DisallowUnknownFields`;
- PUT returns normalized state and incremented revision;
- stale PUT returns HTTP 409, code `WORKSPACE_PRESENTATION_CONFLICT`, and details containing `currentWorkspacePresentation`;
- unsupported owner kind returns HTTP 400, code `WORKSPACE_PRESENTATION_OWNER_INVALID`;
- focus on an activity that disallows Practice Pane returns HTTP 400, code `WORKSPACE_PRESENTATION_ACTIVITY_NOT_ALLOWED`;
- expanded mode on an activity without fullscreen support returns HTTP 400, code `WORKSPACE_PRESENTATION_FULLSCREEN_NOT_SUPPORTED`;
- activity status route returns authored-order status rows.

Use the same session-protected router test pattern as `activity_handlers_test.go`.

- [ ] **Step 2: Run server tests and confirm RED**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server -run 'WorkspacePresentation|ActivityStatuses' -count=1
```

Expected: routes and handlers are missing.

- [ ] **Step 3: Add router option and handlers**

Extend router options:

```go
type routerOptions struct {
    workspacePresentation workspacepresentation.Service
}

func WithWorkspacePresentation(service workspacepresentation.Service) RouterOption {
    return func(options *routerOptions) {
        options.workspacePresentation = service
    }
}
```

Register GET/PUT routes only when the service is configured. Use profile `workspacepresentation.LocalProfileID` in both handlers. Map `ErrActivityPracticeSurfaceNotAllowed` to HTTP 400 with code `WORKSPACE_PRESENTATION_ACTIVITY_NOT_ALLOWED`, and map `ErrActivityFullscreenNotSupported` to HTTP 400 with code `WORKSPACE_PRESENTATION_FULLSCREEN_NOT_SUPPORTED`.

On conflict:

```go
writeError(
    w,
    http.StatusConflict,
    "WORKSPACE_PRESENTATION_CONFLICT",
    "Workspace presentation changed. Retry with the current revision.",
    requestID(r),
    map[string]any{"currentWorkspacePresentation": conflict.Current},
)
```

- [ ] **Step 4: Wire storage, service, catalog, and logger**

In `configureRouter`, construct:

```go
workspaceRepository := storage.NewWorkspacePresentationRepository(database.SQL)
workspaceEvents := logging.New(os.Stderr, 1000)
workspaceService := workspacepresentation.NewService(
    workspaceRepository,
    activities,
    staticCourseVersionResolver{courseID: graph.ID, version: graph.Version},
    workspaceEvents,
)
options = append(options, server.WithWorkspacePresentation(workspaceService))
```

Keep the legacy pane-ratio routes unchanged.

- [ ] **Step 5: Add activity status handler**

Extend `activityHandlers` with:

```go
func (h activityHandlers) statuses(w http.ResponseWriter, r *http.Request) {
    owner, ok := h.owner(w, r)
    if !ok {
        return
    }
    statuses, err := h.activity.ActivityStatuses(r.Context(), owner)
    if err != nil {
        h.writeError(w, r, err)
        return
    }
    writeJSON(w, statuses)
}
```

Register it before the catch-all route.

- [ ] **Step 6: Write failing API client tests**

Assert exact paths and bodies:

```ts
expect(fetchMock).toHaveBeenCalledWith(
  '/api/v1/courses/course/lessons/lesson-a/workspace-presentation',
  expect.objectContaining({ credentials: 'same-origin' }),
);

expect(JSON.parse(String(updateRequest?.body))).toEqual({
  focusedActivityId: 'quiz-a',
  paneMode: 'split',
  splitRatio: 0.45,
  userCollapsed: false,
  revision: 3,
});
```

Return a 409 fixture and assert `error.currentWorkspacePresentation?.revision === 4`.

- [ ] **Step 7: Implement client methods and error detail parsing**

Parse API error details defensively:

```ts
const currentWorkspacePresentation =
  isWorkspacePresentationState(value.details?.currentWorkspacePresentation)
    ? value.details.currentWorkspacePresentation
    : undefined;
```

Do not cast arbitrary details directly into a trusted state object.

Remove `getPaneRatio` and `setPaneRatio` from new test doubles only after `LearningWorkspacePage` no longer calls them in Task 10. Keep the interface methods during this task for compatibility.

- [ ] **Step 8: Run focused server/client tests**

Run:

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/server ./internal/app -count=1
pnpm exec vitest run --project dom apps/web/src/shared/api/client.test.tsx
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add internal/server internal/app apps/web/src
git commit -m "feat: expose workspace presentation API"
```

---

### Task 6: Add a Save Lifecycle Bridge to Every Editable Activity

**Files:**

- Modify: `apps/web/src/features/activity-engine/types.ts`
- Modify: `apps/web/src/features/activity-engine/useActivityAttempt.ts`
- Modify: `apps/web/src/features/activity-engine/useActivityAttempt.test.tsx`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.tsx`
- Modify: `apps/web/src/features/activity-engine/ActivityHost.test.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/ActivityActions.tsx`
- Modify: `apps/web/src/features/practice-runner/PracticePanel.tsx`
- Modify: `apps/web/src/features/practice-runner/PracticePanel.test.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/CodingActivity.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx`

**Interfaces:**

```ts
export interface ActivityPersistenceHandle {
  isDirty(): boolean;
  saveIfDirty(): Promise<void>;
}

export interface ActivityHostProps {
  readonly owner: ActivityOwner;
  readonly activity: ActivityPublicView;
  readonly policy: ActivitySetPolicy;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly onPersistenceHandleChange?: (
    activityId: string,
    handle: ActivityPersistenceHandle | null,
  ) => void;
}

export interface PracticePanelHandle {
  isDirty(): boolean;
  saveIfDirty(): Promise<void>;
}
```

- [ ] **Step 1: Write failing attempt-hook tests for detectable save failure**

Set a dirty answer, make `saveActivityDraft` reject, and assert:

```ts
await expect(result.current.saveIfDirty()).rejects.toThrow('draft unavailable');
expect(result.current.isDirty()).toBe(true);
```

For a clean attempt:

```ts
await expect(result.current.saveIfDirty()).resolves.toBeUndefined();
expect(saveActivityDraft).not.toHaveBeenCalled();
```

- [ ] **Step 2: Refactor `useActivityAttempt`**

Keep the existing user-facing mutation error state, but let transition callers observe failure:

```ts
const saveDraft = useCallback(async (): Promise<void> => {
  if (!answer || saveMutation.isPending) return;
  await saveMutation.mutateAsync(answer);
}, [answer, saveMutation]);

const saveIfDirty = useCallback(async (): Promise<void> => {
  if (!isDirty) return;
  if (!answer) throw new Error('Không có bản nháp hợp lệ để lưu.');
  await saveMutation.mutateAsync(answer);
}, [answer, isDirty, saveMutation]);
```

Return `isDirty`, `saveDraft`, and `saveIfDirty` from the controller. Change explicit save buttons to consume rejections without creating unhandled promises:

```tsx
onClick={() => {
  void onSaveDraft().catch(() => undefined);
}}
```

- [ ] **Step 3: Register non-coding activity handles**

Inside `AttemptActivityHost`, memoize and register:

```ts
const persistenceHandle = useMemo<ActivityPersistenceHandle>(
  () => ({
    isDirty: () => controller.isDirty,
    saveIfDirty: controller.saveIfDirty,
  }),
  [controller.isDirty, controller.saveIfDirty],
);

useEffect(() => {
  onPersistenceHandleChange?.(activity.id, persistenceHandle);
  return () => onPersistenceHandleChange?.(activity.id, null);
}, [activity.id, onPersistenceHandleChange, persistenceHandle]);
```

- [ ] **Step 4: Write failing coding dirty-state tests**

Render `PracticePanel` with a ref, edit the textarea, and assert:

```ts
expect(ref.current?.isDirty()).toBe(true);
await ref.current?.saveIfDirty();
expect(writeActivityFile).toHaveBeenCalledWith(target, 'index.js', 'changed source');
expect(ref.current?.isDirty()).toBe(false);
```

Make `writeActivityFile` reject and assert `saveIfDirty` rejects while dirty state remains true.

- [ ] **Step 5: Convert `PracticePanel` to `forwardRef` and track saved content**

Track the last authoritative file content:

```ts
const [savedContent, setSavedContent] = useState('');
const dirty = selectedFile !== null && content !== savedContent;

const saveCurrentFile = useCallback(async (): Promise<void> => {
  if (!selectedFile || !dirty) return;
  if (workspaceTarget && api.writeActivityFile) {
    await api.writeActivityFile(workspaceTarget, selectedFile, content);
  } else {
    await api.writeFile(lesson.id, selectedFile, content);
  }
  setSavedContent(content);
}, [api, content, dirty, lesson.id, selectedFile, workspaceTarget]);

useImperativeHandle(ref, () => ({
  isDirty: () => dirty,
  saveIfDirty: saveCurrentFile,
}), [dirty, saveCurrentFile]);
```

When a file is loaded or reset, set both `content` and `savedContent` to the returned value. Before changing file tabs, call `saveCurrentFile`; retain the current tab when it fails.

- [ ] **Step 6: Forward coding handles through `CodingActivity` and `ActivityHost`**

Use a `PracticePanelHandle` ref and register an `ActivityPersistenceHandle` with the same `isDirty` and `saveIfDirty` methods. Ensure cleanup unregisters the handle.

- [ ] **Step 7: Run activity lifecycle tests**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/activity-engine/useActivityAttempt.test.tsx \
  apps/web/src/features/activity-engine/ActivityHost.test.tsx \
  apps/web/src/features/activity-engine/renderers/CodingActivity.test.tsx \
  apps/web/src/features/practice-runner/PracticePanel.test.tsx
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/activity-engine apps/web/src/features/practice-runner
git commit -m "feat: expose activity save lifecycle"
```

---

### Task 7: Implement the Learning Workspace Controller

**Files:**

- Create: `apps/web/src/features/learning-workspace/workspace-model.ts`
- Create: `apps/web/src/features/learning-workspace/workspace-model.test.ts`
- Create: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts`
- Create: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx`

**Interfaces:**

```ts
export interface ResolvedWorkspaceActivity {
  readonly setId: string;
  readonly required: boolean;
  readonly policy: ActivitySetPolicy;
  readonly activity: ActivityPublicView;
}

export type WorkspaceSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export type WorkspaceTransitionKind =
  | 'focus'
  | 'return-inline'
  | 'collapse'
  | 'expand'
  | 'restore-split'
  | 'resize'
  | 'next';

export interface WorkspaceTransitionIntent {
  readonly kind: WorkspaceTransitionKind;
  readonly payload: UpdateWorkspacePresentationPayload;
}

export interface LearningWorkspaceController {
  readonly state: WorkspacePresentationState;
  readonly saveStatus: WorkspaceSaveStatus;
  readonly error: Error | null;
  readonly conflictState: WorkspacePresentationState | null;
  readonly focusedActivity: ResolvedWorkspaceActivity | null;

  registerPersistenceHandle(
    activityId: string,
    handle: ActivityPersistenceHandle | null,
  ): void;
  focusActivity(activityId: string): Promise<void>;
  returnActivityInline(): Promise<void>;
  collapsePracticePane(): Promise<void>;
  expandPracticePane(): Promise<void>;
  restoreSplitPane(): Promise<void>;
  setSplitRatio(ratio: number): Promise<void>;
  selectNextActivity(): Promise<void>;
  retryLastSave(): Promise<void>;
}
```

- [ ] **Step 1: Write pure model tests**

Verify flattening preserves set/activity order and `nextActivity` skips no item automatically:

```ts
expect(flattenWorkspaceActivities(sets).map((item) => item.activity.id)).toEqual([
  'quiz-a',
  'coding-lab',
  'reflection',
]);
expect(findNextActivityId(activities, 'coding-lab')).toBe('reflection');
expect(findNextActivityId(activities, 'reflection')).toBeNull();
```

Also test lookup of activity status and focused activity.

- [ ] **Step 2: Write controller RED tests for successful transitions**

With initial collapsed state, register a dirty inline handle for `quiz-a`, call `focusActivity('quiz-a')`, and assert order:

```ts
expect(calls).toEqual(['save:quiz-a', 'update:quiz-a:split']);
expect(result.current.state.focusedActivityId).toBe('quiz-a');
expect(result.current.state.paneMode).toBe('split');
```

With `quiz-a` focused, register its Practice Pane handle, call `focusActivity('coding-lab')`, and assert the current focused activity is saved before the presentation update.

- [ ] **Step 3: Write controller RED tests for blocked transitions**

Make `saveIfDirty` reject and assert:

```ts
await expect(result.current.focusActivity('coding-lab')).rejects.toThrow('save failed');
expect(updateWorkspacePresentation).not.toHaveBeenCalled();
expect(result.current.state.focusedActivityId).toBe('quiz-a');
expect(result.current.saveStatus).toBe('error');
```

Also cover collapse and return-inline being blocked by save failure. Add policy guards: `focusActivity` rejects a target whose normalized `allowPractice` is false, `returnActivityInline` rejects the focused activity when `allowInline` is false, and `expandPracticePane` rejects when `supportsFullscreen` is false without calling either persistence API.

- [ ] **Step 4: Write controller RED tests for semantic differences**

Verify:

```ts
await result.current.collapsePracticePane();
expect(updatePayload).toMatchObject({
  focusedActivityId: 'quiz-a', paneMode: 'collapsed', userCollapsed: true,
});

await result.current.returnActivityInline();
expect(updatePayload).toMatchObject({
  focusedActivityId: null, paneMode: 'collapsed', userCollapsed: false,
});
```

Verify `selectNextActivity()` does nothing when there is no next activity and never runs automatically after evaluation.

- [ ] **Step 5: Write conflict recovery tests**

Return `SynaploomApiError` with code `WORKSPACE_PRESENTATION_CONFLICT` and current state revision `7`. Assert:

- mounted focus remains unchanged;
- `conflictState.revision === 7`;
- `saveStatus === 'conflict'`;
- `retryLastSave()` retries the same intended mutation using revision `7`;
- successful retry clears `conflictState`.

- [ ] **Step 6: Implement query keys and state updates**

Use one owner-qualified key:

```ts
export function workspacePresentationKey(owner: ActivityOwner): readonly unknown[] {
  return [
    'workspace-presentation',
    owner.courseId,
    owner.ownerKind,
    owner.ownerId,
  ];
}
```

The hook receives already-loaded `initialState`, activities, and API client through `useApi`. Store handles in `useRef(new Map<string, ActivityPersistenceHandle>())` so registration does not re-render the page.

- [ ] **Step 7: Implement the transition transaction**

Use one internal function:

```ts
async function transition(intent: WorkspaceTransitionIntent): Promise<void> {
  const next = intent.payload;
  const currentId = stateRef.current.focusedActivityId;
  const saveId = currentId ?? next.focusedActivityId;
  const handle = saveId ? handlesRef.current.get(saveId) : undefined;

  lastIntentRef.current = intent;
  setError(null);
  setSaveStatus('saving');

  try {
    if (handle?.isDirty()) await handle.saveIfDirty();
    const saved = await api.updateWorkspacePresentation(owner, next);
    queryClient.setQueryData(workspacePresentationKey(owner), saved);
    setConflictState(null);
    setSaveStatus('saved');
    lastIntentRef.current = null;
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Workspace transition failed.');
    setError(error);
    if (
      cause instanceof SynaploomApiError &&
      cause.code === 'WORKSPACE_PRESENTATION_CONFLICT' &&
      cause.currentWorkspacePresentation
    ) {
      setConflictState(cause.currentWorkspacePresentation);
      setSaveStatus('conflict');
    } else {
      setSaveStatus('error');
    }
    throw error;
  }
}
```

For opening an inline activity while no focus exists, `saveId` is the target activity so its draft is persisted before unmount. The UI event handler must consume the rejected promise after the controller records the retryable error; it must not leave an unhandled rejection.

- [ ] **Step 8: Implement conflict and retry semantics**

Retry the exact stored intent with only its revision replaced:

```ts
async function retryLastSave(): Promise<void> {
  const intent = lastIntentRef.current;
  if (!intent) return;
  const revision = conflictStateRef.current?.revision ?? stateRef.current.revision;
  await transition({
    ...intent,
    payload: { ...intent.payload, revision },
  });
}
```

Do not silently adopt conflict focus or pane mode before retry succeeds. Keep the currently mounted activity stable while showing the backend state in the conflict notice.

- [ ] **Step 9: Run controller suites**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/workspace-model.test.ts \
  apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/learning-workspace
git commit -m "feat: coordinate workspace activity transitions"
```

---

### Task 8: Build Practice Pane, Activity Tray, Rail, and Inline Slot

**Files:**

- Create: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Create: `apps/web/src/features/learning-workspace/PracticePaneHeader.test.tsx`
- Create: `apps/web/src/features/learning-workspace/ActivityTray.tsx`
- Create: `apps/web/src/features/learning-workspace/ActivityTray.test.tsx`
- Create: `apps/web/src/features/learning-workspace/WorkspacePaneRail.tsx`
- Create: `apps/web/src/features/learning-workspace/WorkspacePaneRail.test.tsx`
- Create: `apps/web/src/features/learning-workspace/InlineActivitySlot.tsx`
- Create: `apps/web/src/features/learning-workspace/InlineActivitySlot.test.tsx`
- Create: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Create: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

```ts
export interface InlineActivitySlotProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly owner: ActivityOwner;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onReturnInline: () => Promise<void>;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly onPersistenceHandleChange: ActivityHostProps['onPersistenceHandleChange'];
}
```

```ts
export interface PracticePaneProps {
  readonly owner: ActivityOwner;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly controller: LearningWorkspaceController;
  readonly onProgressChanged: () => Promise<void> | void;
}

export interface WorkspacePaneRailProps {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivity: ResolvedWorkspaceActivity | null;
  readonly controller: LearningWorkspaceController;
}
```

- [ ] **Step 1: Write Activity Tray tests**

Assert authored ordering, required/optional labels, and text status independent of color:

```ts
expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
  expect.stringContaining('Kiểm tra nhanh'),
  expect.stringContaining('Coding lab'),
  expect.stringContaining('Bài viết phản tư'),
]);
expect(screen.getByText('Đã đạt')).toBeVisible();
expect(screen.getByText('Bản nháp')).toBeVisible();
expect(screen.getByText('Chưa bắt đầu')).toBeVisible();
```

Selecting a row calls `controller.focusActivity(id)` and does not mount `ActivityHost` inside the tray.

- [ ] **Step 2: Write rail tests**

With four activities and no focus, the rail exposes a disclosure containing the Activity Tray without changing backend presentation state:

```ts
await user.click(screen.getByRole('button', { name: 'Chọn hoạt động thực hành, 4 hoạt động' }));
expect(screen.getByRole('region', { name: 'Hoạt động trong bài' })).toBeVisible();
await user.click(screen.getByRole('button', { name: /Coding lab/ }));
expect(controller.focusActivity).toHaveBeenCalledWith('coding-lab');
```

With a collapsed focused activity, the primary action restores the same focus:

```ts
expect(screen.getByText('Thực hành · 4 hoạt động')).toBeVisible();
expect(screen.getByText('Coding lab đang tạm ẩn.')).toBeVisible();
await user.click(screen.getByRole('button', { name: 'Mở lại Coding lab' }));
expect(controller.restoreSplitPane).toHaveBeenCalledTimes(1);
```

Implement the no-focus disclosure with native `<details>`/`<summary>` or the existing accessible disclosure primitive; opening the tray is local UI state and must not call the presentation API. With zero activities, render nothing.

- [ ] **Step 3: Write inline slot tests**

Cover three states:

1. `allowInline=true`, `allowPractice=true`, and not focused: mounts one editable `ActivityHost` plus `Mở trong khu vực thực hành`.
2. `allowInline=true`, `allowPractice=false`, and not focused: mounts one editable `ActivityHost` without a Practice Pane action.
3. focused: does not mount editable host; split/expanded shows `Đi tới khu vực thực hành`, while collapsed shows `Mở lại khu vực thực hành`.
4. `allowInline=false`, `allowPractice=true`: shows a Practice Pane launch card only.

Use an injected `renderHost` test prop or module mock to count editable instances.

- [ ] **Step 4: Write Practice Pane tests**

Assert:

- focused heading is an `h2` with a stable `tabIndex={-1}` target;
- header shows ordinal `2/4`;
- collapse, expand, retry, and Activity Tray actions call controller methods;
- expand is shown only when `focusedActivity.activity.presentation.supportsFullscreen` is true;
- return-inline is shown only when `focusedActivity.activity.presentation.allowInline` is true;
- passed focused activity remains mounted and displays `Hoạt động tiếp theo`;
- clicking next explicitly calls `selectNextActivity`;
- no next activity displays `Tất cả hoạt động trong bài đã hoàn thành`;
- save error is rendered with `role="alert"` and a `Thử lưu lại` button.

- [ ] **Step 5: Implement status copy mapping**

Use a pure exhaustive mapping:

```ts
export function activityStatusLabel(status: ActivityWorkspaceStatus): string {
  switch (status) {
    case 'AVAILABLE': return 'Chưa bắt đầu';
    case 'DRAFT': return 'Bản nháp';
    case 'IN_PROGRESS': return 'Đang chấm';
    case 'PASSED': return 'Đã đạt';
    case 'FAILED': return 'Chưa đạt';
  }
}
```

- [ ] **Step 6: Implement focused summary without a duplicate editor**

The summary root must include:

```tsx
<section
  className="syn-inline-activity-summary"
  data-activity-id={item.activity.id}
  aria-labelledby={`inline-summary-${item.activity.id}`}
>
  <h3 id={`inline-summary-${item.activity.id}`}>{item.activity.title}</h3>
  <p>{activityStatusLabel(status?.status ?? 'AVAILABLE')}</p>
  <p>
    {paneMode === 'collapsed'
      ? `${item.activity.title} đang tạm ẩn.`
      : `${item.activity.title} đang mở trong khu vực thực hành.`}
  </p>
  <button
    type="button"
    onClick={() => {
      void onOpenPractice(item.activity.id).catch(() => undefined);
    }}
  >
    {paneMode === 'collapsed'
      ? 'Mở lại khu vực thực hành'
      : 'Đi tới khu vực thực hành'}
  </button>
</section>
```

Do not render `ActivityHost` in this branch.

- [ ] **Step 7: Implement Practice Pane composition**

`PracticePane` mounts exactly one `ActivityHost` for `controller.focusedActivity`, registers its persistence handle, and keeps activity actions separate from lesson progression. Use a collapsible Activity Tray in the pane header. Every button that invokes an async controller method must consume its rejection with `void action().catch(() => undefined)` because the controller already stores the visible retry state.

- [ ] **Step 8: Add component styles**

Define focused classes for:

```text
.syn-practice-pane
.syn-practice-pane__header
.syn-practice-pane__body
.syn-practice-pane__feedback
.syn-practice-pane__actions
.syn-activity-tray
.syn-workspace-pane-rail
.syn-inline-activity-launch
.syn-inline-activity-summary
```

Every status style must retain visible text. Add `prefers-reduced-motion: reduce` rules that remove pane and rail transitions.

- [ ] **Step 9: Run component tests**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-workspace
```

Expected: all component and controller tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/learning-workspace apps/web/src/application.css
git commit -m "feat: add dual-surface workspace components"
```

---

### Task 9: Implement Responsive Collapsed, Split, Expanded, and Mobile Shell Modes

**Files:**

- Create: `apps/web/src/features/learning-workspace/useWorkspaceViewport.ts`
- Create: `apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx`
- Create: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Create: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Modify: `packages/ui/src/primitives/dialog/dialog.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.tsx`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.test.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`

**Interfaces:**

```ts
export type WorkspaceViewport = 'wide' | 'compact' | 'mobile';

export interface LearningWorkspaceShellProps {
  readonly mode: PracticePaneMode;
  readonly splitRatio: number;
  readonly theory: ReactNode;
  readonly practice: ReactNode;
  readonly practiceRail: ReactNode;
  readonly theoryRail: ReactNode;
  readonly practiceTitle: string;
  readonly onSplitRatioCommit: (ratio: number) => Promise<void> | void;
  readonly onCloseMobilePractice: () => Promise<void> | void;
}
```

- [ ] **Step 1: Write viewport mapping tests**

Mock `matchMedia` and assert:

```ts
expect(renderHook(() => useWorkspaceViewport()).result.current).toBe('wide');
```

Use breakpoints:

```text
wide: min-width 1100px
compact: 720px through 1099px
mobile: max-width 719px
```

Verify listener cleanup.

- [ ] **Step 2: Write shell behavior tests**

Cover:

- wide + collapsed: theory and Practice Rail visible, practice editor absent;
- wide + split: both surfaces and separator visible;
- wide + expanded: practice and Theory Rail visible; Theory Pane content is not presented as a full pane, and its scroll position is restored when the learner returns;
- compact + split: segmented controls `Lý thuyết | Chia đôi | Thực hành` select one or split when constraints permit;
- mobile + split/expanded: controlled full-screen dialog is open;
- mobile close restores focus to the element that opened practice;
- divider callback emits a normalized decimal ratio only after `onLayoutChanged`.

- [ ] **Step 3: Extend the Dialog primitive to controlled mode**

Preserve existing callers while supporting:

```ts
export interface DialogProps {
  readonly trigger?: ReactElement;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly contentClassName?: string;
}
```

Use Radix Dialog for focus trapping and focus restoration. Render `Trigger` only when provided.

- [ ] **Step 4: Update percentage semantics in the UI WorkspaceShell**

Keep `react-resizable-panels` values in percentages but expose decimals to the app:

```ts
onLessonSizeChange?.(clampWorkspaceRatio(lessonSize) / 100);
```

Change `defaultLessonSize` to accept a decimal ratio and convert once:

```ts
const initialLessonSize = clampWorkspaceRatio(defaultLessonRatio * 100);
```

Rename the prop to `defaultLessonRatio` to prevent unit ambiguity and update tests.

- [ ] **Step 5: Implement the application shell**

Use `WorkspaceShell` only for wide split mode. Collapsed and expanded modes use explicit layout branches. Compact mode exposes a segmented surface selector without mutating persisted pane mode merely because the viewport changed. Mobile maps persisted split/expanded to a controlled full-screen Dialog while leaving backend state unchanged.

- [ ] **Step 6: Preserve Theory Pane scroll position**

The parent page owns the Theory Pane scroll container ref. Before a layout transition that removes the full Theory Pane from view, capture its scroll offset; after the Theory Pane is visible again, restore that offset in `useLayoutEffect`. Do not key the lesson document by pane mode.

Use these refs for wide, compact, and mobile transitions:

```ts
const theoryScrollTopRef = useRef(0);
const theoryScrollRef = useRef<HTMLElement | null>(null);
const openerRef = useRef<HTMLElement | null>(null);
```

A remount caused by switching between resizable and non-resizable layout branches is acceptable only when the saved theory scroll offset is restored before paint. Mobile Dialog close must additionally restore focus to `openerRef`.

- [ ] **Step 7: Add responsive and reduced-motion CSS**

Define minimum widths that match ratio constraints, compact segmented control behavior, full-screen mobile practice content, safe-area padding, and no animation under reduced motion.

- [ ] **Step 8: Run UI and shell tests**

Run:

```bash
pnpm exec vitest run --project dom \
  packages/ui/src/components/workspace-shell/workspace-shell.test.tsx \
  apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add packages/ui apps/web/src/features/learning-workspace apps/web/src/application.css
git commit -m "feat: add responsive dual-surface shell"
```

---

### Task 10: Integrate the Dual-Surface Workspace into Lessons

**Files:**

- Modify: `apps/web/src/features/lesson-content/LessonActivities.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonActivities.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Delete: `apps/web/src/features/workspace-layout/activity-layout.ts`
- Delete: `apps/web/src/features/workspace-layout/activity-layout.test.ts`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- `LessonActivities` now consumes workspace state instead of `excludedActivityIds`:

```ts
interface LessonActivitiesProps {
  readonly blocks: readonly LessonBlock[];
  readonly owner: ActivityOwner;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly controller: LearningWorkspaceController;
  readonly onProgressChanged: () => Promise<void> | void;
}
```

- [ ] **Step 1: Write failing lesson activity tests**

Verify:

- embedded inline activity remains at document position;
- focused embedded activity becomes a summary at the same position;
- remaining non-embedded activity uses `InlineActivitySlot` in authored order;
- focused coding activity is no longer excluded by kind; it is represented by a summary/launch slot;
- duplicate and missing embed validation remains fail-closed.

- [ ] **Step 2: Write failing page tests for first load and restoration**

Add test doubles for `getWorkspacePresentation` and `getActivityStatuses`. Assert:

```ts
expect(screen.getByText('Thực hành · 3 hoạt động')).toBeVisible();
expect(screen.queryByRole('separator', { name: 'Thay đổi kích thước hai vùng học' }))
  .not.toBeInTheDocument();
```

For restored split state:

```ts
expect(screen.getByRole('heading', { name: 'Coding Lab', level: 2 })).toBeVisible();
expect(screen.getByRole('separator', { name: 'Thay đổi kích thước hai vùng học' })).toBeVisible();
expect(screen.getByText('Coding Lab đang mở trong khu vực thực hành.')).toBeVisible();
```

Count editable controls to prove the coding editor exists only once.

- [ ] **Step 3: Load owner state and statuses in `LearningWorkspacePage`**

For the lesson owner, add queries:

```ts
const presentationQuery = useQuery({
  queryKey: workspacePresentationKey(owner),
  queryFn: () => api.getWorkspacePresentation(owner),
  enabled: owner !== null,
});

const statusesQuery = useQuery({
  queryKey: activityStatusesKey(owner),
  queryFn: () => api.getActivityStatuses(owner),
  enabled: owner !== null,
});
```

Include both in loading and error surfaces. Invalidate statuses after activity progress changes.

- [ ] **Step 4: Replace coding-specific layout resolution**

Delete `resolveWorkspaceLayout`, `codingActivity`, `inlineKinds`, `excludedActivityIds`, and the `pane-ratio` query. Build the controller from presentation state and flattened activities.

Compose:

```tsx
<LearningWorkspaceShell
  mode={controller.state.paneMode}
  splitRatio={controller.state.splitRatio}
  theory={lessonPanel}
  practice={practicePane}
  practiceRail={practiceRail}
  theoryRail={theoryRail}
  practiceTitle={controller.focusedActivity?.activity.title ?? 'Khu vực thực hành'}
  onSplitRatioCommit={controller.setSplitRatio}
  onCloseMobilePractice={controller.collapsePracticePane}
/>
```

- [ ] **Step 5: Route progression practice actions to the focused activity**

Replace `.scrollIntoView()` on `.syn-practice-panel`. For `START_REQUIRED_PRACTICE` and `RETRY_REQUIRED_PRACTICE`, resolve `practiceId` to an activity ID and call `controller.focusActivity(practiceId)`. If the ID is an activity-set ID, focus its first required activity.

- [ ] **Step 6: Preserve lesson progression placement**

Keep `LessonRequirementFooter` only in Theory Pane. Do not render lesson progression buttons in `PracticePane`.

- [ ] **Step 7: Remove new frontend usage of legacy pane ratio methods**

Delete `paneQuery`, `api.getPaneRatio()`, and `api.setPaneRatio()` from `LearningWorkspacePage` and update page test doubles. Keep client interface methods until the compatibility endpoint is retired in a later release.

- [ ] **Step 8: Run lesson integration tests**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/lesson-content/LessonActivities.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/lesson-content apps/web/src/features/workspace-layout apps/web/src/application.css
git commit -m "feat: integrate dual-surface lesson workspace"
```

---

### Task 11: Integrate Assessments into the Same Controller and Shell

**Files:**

- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

`AssessmentWorkspaceContent` becomes Theory Pane content and no longer mounts all editable activities:

```ts
interface AssessmentWorkspaceContentProps {
  readonly chapterId: string;
  readonly assessment: ChapterAssessmentPayload;
  readonly navigation: CourseNavigationPayload;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly controller: LearningWorkspaceController;
  readonly onAction: (action: NextActionPayload) => void;
  readonly onProgressChanged: () => Promise<void>;
}
```

- [ ] **Step 1: Write failing assessment tests**

Verify:

- assessment route renders `LearningWorkspaceShell` rather than `.syn-assessment-workspace` as a separate page;
- activity configured for Practice Pane appears exactly once in the focused pane;
- Theory Pane retains assessment title, attempt policy, score/progress, and requirement footer;
- Activity Tray contains assessment activities in authored order;
- switching questions uses controller save-before-switch;
- no activity set still renders a fail-closed Theory Pane error and no rail.

- [ ] **Step 2: Hoist assessment data queries to the composition root**

`LearningWorkspacePage` must load assessment, activity sets, presentation, statuses, and navigation before creating the shared controller. `AssessmentWorkspaceContent` receives data and callback props rather than owning duplicate activity queries.

- [ ] **Step 3: Convert assessment activities to inline slots or summaries**

The Theory Pane can show assessment overview plus `InlineActivitySlot` entries. Activities whose normalized policy disallows inline render launch cards. A focused activity renders a summary, never a second form.

- [ ] **Step 4: Use the shared Practice Pane and rail**

Construct the same `PracticePane`, `WorkspacePaneRail`, and `LearningWorkspaceShell` used by lessons. Use owner `{ courseId, ownerKind: 'assessments', ownerId: assessmentId }`.

- [ ] **Step 5: Preserve assessment progression boundaries**

Keep `LessonRequirementFooter` in assessment Theory Pane with heading `Yêu cầu hoàn thành đánh giá`. Do not place chapter continuation actions beside activity submit/retry controls.

- [ ] **Step 6: Run assessment integration tests**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/chapter-assessment apps/web/src/features/workspace-layout apps/web/src/application.css
git commit -m "feat: unify assessment practice workspace"
```

---

### Task 12: Complete Focus Management, Error Recovery, and Structured Events

**Files:**

- Create: `apps/web/src/features/learning-workspace/workspace-events.ts`
- Create: `apps/web/src/features/learning-workspace/workspace-events.test.ts`
- Modify: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts`
- Modify: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/InlineActivitySlot.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `internal/workspacepresentation/service_test.go`

**Interfaces:**

```ts
export type WorkspaceEventName =
  | 'workspace.presentation.loaded'
  | 'workspace.activity.focused'
  | 'workspace.activity.switch_save_failed'
  | 'workspace.pane.collapsed'
  | 'workspace.pane.split'
  | 'workspace.pane.expanded'
  | 'workspace.presentation.conflict'
  | 'workspace.presentation.invalid_focus_recovered'
  | 'workspace.viewport.mapped';

export interface WorkspaceEvent {
  readonly name: WorkspaceEventName;
  readonly courseId: string;
  readonly ownerKind: 'lessons' | 'assessments';
  readonly ownerId: string;
  readonly activityId?: string;
  readonly paneMode?: PracticePaneMode;
  readonly revision?: number;
  readonly viewport?: WorkspaceViewport;
  readonly errorCode?: string;
}
```

- [ ] **Step 1: Write event redaction tests**

The emitter must reject or remove sensitive keys:

```ts
const event = sanitizeWorkspaceEvent({
  name: 'workspace.activity.focused',
  courseId: 'course',
  ownerKind: 'lessons',
  ownerId: 'lesson',
  activityId: 'quiz',
  answer: 'secret',
  content: 'source code',
} as never);
expect(event).not.toHaveProperty('answer');
expect(event).not.toHaveProperty('content');
```

Emit browser events through:

```ts
window.dispatchEvent(new CustomEvent('synaploom:workspace-event', { detail: event }));
```

This provides a structured integration point without adding an analytics dependency.

- [ ] **Step 2: Add keyboard focus transition tests**

Verify:

- opening activity focuses `h2[data-workspace-activity-heading]`;
- switching focuses the new heading after successful persistence;
- return inline focuses `h3[data-inline-activity-heading]`;
- failed save leaves focus inside the current activity;
- Activity Tray selection is keyboard operable;
- divider has `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` through the panel library;
- mobile Dialog traps focus and restores opener focus.

- [ ] **Step 3: Implement focus targets with refs, not global selectors**

Register element refs by activity ID:

```ts
registerPracticeHeading(activityId: string, element: HTMLElement | null): void;
registerInlineHeading(activityId: string, element: HTMLElement | null): void;
```

After successful transitions, schedule focus with `requestAnimationFrame`. Do not move focus before the new surface is mounted.

- [ ] **Step 4: Implement retryable load and persistence errors**

- Activity load failure keeps Practice Pane open with `Thử tải lại`.
- Presentation save failure keeps current UI mounted and blocks unmounting transitions.
- Conflict shows current-state notice and `Thử lưu lại`.
- Invalid restored focus displays one non-blocking notice in Theory Pane and remains collapsed.

- [ ] **Step 5: Emit structured backend and frontend events**

Backend service emits load/normalize/conflict/persist events. Frontend emits focus, pane action, save failure, and responsive mapping events. Tests must inspect event field names and prove no learner content is present.

- [ ] **Step 6: Run accessibility and event tests**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-workspace
bash scripts/go/with-internal-toolchain.sh test ./internal/workspacepresentation -count=1
pnpm lint
```

Expected: tests and JSX accessibility lint pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/learning-workspace internal/workspacepresentation
git commit -m "feat: harden workspace focus and recovery"
```

---

### Task 13: Update Example Courses, Authoring Docs, and Migration Guidance

**Files:**

- Modify: `examples/frontend-performance-foundations/course.json`
- Modify: activity JSON files under `examples/frontend-performance-foundations/`
- Modify: `examples/multi-domain-foundations/course.json`
- Modify: activity JSON files under `examples/multi-domain-foundations/`
- Modify: `docs/authoring/activity-engine.md`
- Modify: `docs/authoring/activity-kinds.md`
- Create: `docs/authoring/dual-surface-workspace.md`
- Create: `docs/migrations/workspace-presentation-v1.md`
- Create: `docs/testing/dual-surface-workspace-manual-verification.md`
- Modify: `docs/security/activity-engine-boundaries.md`
- Create: `tests/workspace-presentation-docs.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Adds documentation verification script:

```json
"test:workspace-presentation-docs": "node --experimental-strip-types --test tests/workspace-presentation-docs.spec.ts"
```

- [ ] **Step 1: Write failing documentation assertions**

Assert the new docs contain these exact concepts:

```text
Dual-Surface Learning Workspace
focusedActivityId
userCollapsed
save-before-switch
WORKSPACE_PRESENTATION_CONFLICT
allowInline
allowPractice
preferredWidth
supportsFullscreen
```

Verify manual testing includes refresh, runtime restart, lesson, assessment, mobile, keyboard, save failure, and conflict recovery.

- [ ] **Step 2: Run docs tests and confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/workspace-presentation-docs.spec.ts
```

Expected: fail because the new workspace documents do not exist.

- [ ] **Step 3: Add explicit presentation metadata to representative examples**

Use authored examples that exercise every policy branch:

```json
"presentation": {
  "defaultSurface": "practice",
  "allowInline": true,
  "allowPractice": true,
  "preferredWidth": "wide",
  "supportsFullscreen": true
}
```

- Coding and long writing use `practice/wide/fullscreen`.
- Compact true-false uses `inline/compact`.
- One multiple-choice uses `auto/standard`.
- Assessment activities use `practice` so the shared assessment shell is exercised deterministically.

Do not add metadata to every activity; retain omitted cases to test system defaults.

- [ ] **Step 4: Document authoring semantics**

Explain:

- authored vs normalized policy;
- learner preference precedence;
- one editable instance rule;
- how inline activity embeds become summaries;
- default thresholds for multiple-choice, ordering, and matching;
- fullscreen capability;
- assessment behavior.

- [ ] **Step 5: Document migration**

State:

- legacy pane ratio is not migrated because the endpoint was a constant stub;
- new split default is `0.45` Theory Pane width;
- existing coding lessons with no row derive an initial focused split state;
- existing inline attempts require no data migration;
- the compatibility endpoint remains but the current UI no longer calls it.

- [ ] **Step 6: Validate examples and docs**

Run:

```bash
pnpm validate:example
pnpm validate:multi-domain
pnpm test:activity-engine-docs
```

Expected: both course validators and docs tests pass.

- [ ] **Step 7: Commit**

```bash
git add examples docs tests/activity-engine-docs.spec.ts package.json
git commit -m "docs: document dual-surface workspace authoring"
```

---

### Task 14: Add Browser Acceptance for Persistence and Cross-Domain Activities

**Files:**

- Create: `tests/e2e/dual-surface-workspace-runtime.spec.ts`
- Modify: `tests/e2e/multi-domain-runtime.spec.ts`
- Modify: `playwright.config.ts`

**Acceptance flow:**

```text
open reading lesson with collapsed pane
→ complete an inline quiz
→ edit another inline activity without saving
→ open it in Practice Pane and confirm the draft survives
→ switch to coding activity after save
→ collapse pane while keeping focus
→ refresh and confirm collapsed/focused restoration
→ restore pane from rail
→ complete coding activity and inspect feedback
→ remain on coding activity until explicit “Hoạt động tiếp theo”
→ choose next activity
→ open assessment in the same shell
→ restart runtime
→ reopen owner and confirm backend restoration
```

- [ ] **Step 1: Add the failing Playwright test**

Use role-based selectors only. Key assertions:

```ts
await expect(page.getByRole('button', { name: /Mở khu vực thực hành/ })).toBeVisible();
await page.getByRole('button', { name: 'Mở trong khu vực thực hành' }).click();
await expect(page.getByRole('heading', { name: 'Hoàn thành lời chào', level: 2 })).toBeVisible();
await expect(
  page.getByText('Hoàn thành lời chào đang mở trong khu vực thực hành.'),
).toBeVisible();
expect(await page.getByRole('textbox', { name: '___, how are you?' }).count()).toBe(1);
```

After collapse and reload:

```ts
await expect(page.getByText('Hoàn thành lời chào đang tạm ẩn')).toBeVisible();
await expect(
  page.getByRole('heading', { name: 'Hoàn thành lời chào', level: 2 }),
).toHaveCount(0);
```

After successful activity evaluation:

```ts
await expect(page.getByRole('button', { name: 'Hoạt động tiếp theo' })).toBeVisible();
await expect(page.getByRole('heading', { name: currentTitle, level: 2 })).toBeVisible();
```

- [ ] **Step 2: Run the new test and confirm RED**

Run:

```bash
pnpm playwright test tests/e2e/dual-surface-workspace-runtime.spec.ts --project=go-runtime
```

Expected: fail before implementation or until staged web assets include the new workspace.

- [ ] **Step 3: Add runtime restart helper**

Refactor the test setup so the same temporary `SYNAPLOOM_HOME` and SQLite database are reused across process restart. Bootstrap a new session after restart, navigate back to the same canonical owner, and assert persisted mode, focus, and ratio.

- [ ] **Step 4: Update existing multi-domain selectors**

Existing e2e helper `activity(page, title)` assumes every activity is an inline fieldset. Replace it with helpers that can open the Practice Pane when policy requires it:

```ts
async function openActivity(page: Page, title: string): Promise<Locator> {
  const inline = page.locator('[data-activity-id]').filter({ hasText: title });
  const open = inline.getByRole('button', { name: 'Mở trong khu vực thực hành' });
  if (await open.isVisible()) await open.click();
  return page.locator('.syn-practice-pane').filter({ has: page.getByRole('heading', { name: title }) });
}
```

Keep compact inline activities inline to preserve coverage of both surfaces.

- [ ] **Step 5: Stage web assets and run browser gates**

Run:

```bash
pnpm go:stage-web
pnpm playwright test --project=go-runtime
```

Expected: generic runtime, multi-domain runtime, and dual-surface runtime tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e playwright.config.ts internal/webassets
git commit -m "test: verify dual-surface workspace runtime"
```

---

### Task 15: Run Full Verification and Record Delivery Evidence

**Files:**

- Create: `docs/releases/workspace-presentation-v1-verification.md`
- Modify only when a verification failure reveals a real defect: affected source/test files.

- [ ] **Step 1: Run formatting and static frontend gates**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:type-strip
pnpm contracts:check
```

Expected: every command exits `0`.

- [ ] **Step 2: Run complete frontend and documentation tests**

Run:

```bash
pnpm test
pnpm test:activity-engine-docs
pnpm test:workspace-presentation-docs
pnpm build
```

Expected: all Vitest/Node tests and production builds pass.

- [ ] **Step 3: Run complete Go gates**

Run:

```bash
pnpm go:fmt
pnpm go:test
pnpm go:vet
pnpm go:staticcheck
```

Expected: all commands exit `0` with no formatting drift, test failure, vet diagnostic, or staticcheck diagnostic.

- [ ] **Step 4: Run course and web inventory validation**

Run:

```bash
pnpm validate:example
pnpm validate:multi-domain
pnpm go:stage-web
pnpm go:verify-web-inventory
```

Expected: both course packages are valid and embedded asset inventory matches staged assets.

- [ ] **Step 5: Run browser acceptance**

Run:

```bash
pnpm playwright test --project=go-runtime
```

Expected: all Go runtime browser tests pass without console or page errors.

- [ ] **Step 6: Run native preview build smoke test**

Run:

```bash
pnpm go:build-preview
SMOKE_HOME="$(mktemp -d)"
SYNAPLOOM_HOME="$SMOKE_HOME" ./bin/synaploom-go-preview course import examples/multi-domain-foundations
SYNAPLOOM_HOME="$SMOKE_HOME" ./bin/synaploom-go-preview start multi-domain-foundations --port 0 \
  >"$SMOKE_HOME/runtime.log" 2>&1 &
SMOKE_PID=$!
for attempt in $(seq 1 100); do
  grep -Eq 'http://[^[:space:]]+/bootstrap\?token=[^[:space:]]+' "$SMOKE_HOME/runtime.log" && break
  sleep 0.1
done
grep -E 'http://[^[:space:]]+/bootstrap\?token=[^[:space:]]+' "$SMOKE_HOME/runtime.log"
kill -INT "$SMOKE_PID"
wait "$SMOKE_PID"
rm -rf "$SMOKE_HOME"
```

Expected: import prints `imported multi-domain-foundations@<version>`, the log contains one bootstrap URL, and `wait` exits `0` after SIGINT.

- [ ] **Step 7: Write verification evidence**

Record exact command, date, exit status, and relevant test counts in `docs/releases/workspace-presentation-v1-verification.md`. Include explicit evidence for:

- SQLite restart persistence;
- optimistic conflict handling;
- no duplicate editable activity instances;
- save-before-switch failure blocking;
- learner collapse precedence;
- lesson and assessment shared shell;
- wide, compact, and mobile behavior;
- keyboard focus restoration;
- browser runtime restart flow.

- [ ] **Step 8: Commit verification evidence**

```bash
git add docs/releases/workspace-presentation-v1-verification.md
git commit -m "docs: record workspace presentation verification"
```

---

## Spec Coverage Matrix

| Specification requirement | Implementation task |
| --- | --- |
| Activity presentation policy for ten kinds | Tasks 1–2 |
| Learner preference precedence | Tasks 4, 7, 10 |
| Backend owner-scoped persistence and revision | Tasks 3–5 |
| Invalid focus normalization | Tasks 4–5, 12 |
| Save-before-switch and save failure blocking | Tasks 6–7 |
| One editable activity instance | Tasks 8, 10–11, 14 |
| Collapsed Practice Rail | Tasks 8–10 |
| Split and expanded modes | Tasks 7, 9–10 |
| Activity Tray authored order and status | Tasks 2, 5, 8 |
| Explicit next activity after feedback | Tasks 7–8, 14 |
| Lesson progression remains in Theory Pane | Tasks 10–11 |
| Lesson and assessment shared workspace | Tasks 10–11 |
| Desktop, compact, and mobile mapping | Tasks 9, 12, 14 |
| Focus management and reduced motion | Tasks 8–9, 12 |
| Structured events without learner content | Tasks 4, 12 |
| Existing pane ratio migration | Tasks 10, 13 |
| Documentation, browser acceptance, release gates | Tasks 13–15 |

## Execution Notes

- Execute tasks in order because later tasks consume generated contracts, service APIs, and lifecycle interfaces defined earlier.
- Use a fresh worktree before implementation through `superpowers:using-git-worktrees`.
- Use test-driven-development for each task: RED, minimal GREEN, refactor, focused verification, commit.
- Do not batch Tasks 3–5 into one commit; persistence, domain orchestration, and HTTP boundary require independent review gates.
- Do not begin Task 10 until Tasks 6–9 pass together; page integration depends on both transition safety and presentational components.
