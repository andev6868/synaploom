# Unified Learning Workspace and Progression Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render lesson and chapter assessment items inside one stable learning workspace, remove redundant in-content navigation, and ensure the footer communicates only real forward progression actions.

**Architecture:** `LearningWorkspacePage` becomes the shared application-shell composition root for lesson and assessment routes. Item-specific query and mutation logic lives in focused lesson/assessment content components, while one pure progression-action resolver converts protocol actions and navigation data into learner-facing button/completion presentations. The Go progression engine stops emitting the non-functional course-summary action.

**Tech Stack:** React 19, TypeScript, TanStack Query, Vitest/Testing Library, Go 1.26.5, existing Synaploom protocol and UI packages.

## Global Constraints

- Keep canonical lesson and assessment URL formats unchanged.
- Do not remove `VIEW_COURSE_SUMMARY` from generated protocol contracts in this slice.
- Do not introduce a course-summary page.
- Do not add coding workspaces to assessments.
- Keep top learning navigation, AI assistant, and shared loading/error surfaces stable across lesson and assessment routes.
- Never expose raw IDs as learner-facing progression action labels.

---

### Task 1: Shared Progression Action Presentation

**Files:**
- Create: `apps/web/src/features/lesson-progress/progression-action.ts`
- Create: `apps/web/src/features/lesson-progress/progression-action.test.ts`
- Modify: `apps/web/src/features/lesson-progress/LessonRequirementFooter.tsx`
- Modify: `apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx`

**Interfaces:**
- Consumes: `NextActionPayload`, `CourseNavigationPayload` from `@synaploom/protocol`.
- Produces: `resolveProgressionAction(action, navigation): ProgressionActionPresentation`.
- Produces: `LessonRequirementFooter` accepting `navigation?: CourseNavigationPayload` and rendering either a real button, a course-complete status, or no action.

- [ ] **Step 1: Write failing resolver tests**

Cover:

```ts
expect(resolveProgressionAction(
  { type: 'RETURN_TO_CURRENT_LESSON', chapterId: 'runtime', lessonId: 'event-loop' },
  navigation,
)).toEqual({ kind: 'button', label: 'Tiếp tục bài Event Loop', action });

expect(resolveProgressionAction(
  { type: 'VIEW_COURSE_SUMMARY', courseId: 'perf' },
  navigation,
)).toEqual({ kind: 'complete', message: 'Bạn đã hoàn thành khóa học' });
```

Also verify missing target titles use `Tiếp tục bài học`, not the lesson ID.

- [ ] **Step 2: Run the resolver test and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/lesson-progress/progression-action.test.ts
```

Expected: fail because `resolveProgressionAction` does not exist.

- [ ] **Step 3: Implement the pure resolver**

Use a discriminated result:

```ts
export type ProgressionActionPresentation =
  | { readonly kind: 'button'; readonly label: string; readonly action: NextActionPayload }
  | { readonly kind: 'complete'; readonly message: string }
  | { readonly kind: 'none' };
```

Resolve lesson/chapter/assessment titles by searching navigation chapters. Map both `RETURN_TO_CURRENT_LESSON` and `CONTINUE_TO_LESSON` to forward language.

- [ ] **Step 4: Refactor the footer to use the resolver**

Replace local label maps and `window.location.hash` assumptions. Render:

```tsx
{presentation.kind === 'button' ? <button ...>{presentation.label}</button> : null}
{presentation.kind === 'complete' ? (
  <p className="syn-requirement-footer__complete" role="status">
    ✓ {presentation.message}
  </p>
) : null}
```

- [ ] **Step 5: Update footer DOM tests and run GREEN**

Verify:
- `RETURN_TO_CURRENT_LESSON` → `Tiếp tục bài Event Loop`.
- `CONTINUE_TO_LESSON` → same destination-specific language.
- `VIEW_COURSE_SUMMARY` → no button, completion status text.
- requirement labels remain learner-facing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/lesson-progress
git commit -m "fix: resolve progression actions from navigation"
```

---

### Task 2: Remove Redundant Lesson Navigation Elements

**Files:**
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Delete: `apps/web/src/features/review-mode/ReviewBanner.tsx`
- Delete: `apps/web/src/features/review-mode/ReviewBanner.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Consumes: existing lesson context and navigation payload.
- Produces: lesson body with one `<h1>`, status badge `Đang xem lại` for review mode, no breadcrumb/banner, and footer receiving navigation data.

- [ ] **Step 1: Add failing workspace DOM assertions**

For a review lesson, assert:

```ts
expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
expect(screen.queryByLabelText('Chế độ xem lại')).not.toBeInTheDocument();
expect(screen.getByText('Đang xem lại')).toBeVisible();
```

- [ ] **Step 2: Run the workspace test and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: fail because breadcrumb and review banner are still rendered.

- [ ] **Step 3: Remove components and obsolete styles**

Remove `ReviewBanner` import/render and breadcrumb markup. Set the status copy from `context.viewMode`:

```ts
const lessonStatusLabel =
  context?.viewMode === 'REVIEW'
    ? 'Đang xem lại'
    : lesson.status === 'COMPLETED'
      ? 'Hoàn thành'
      : 'Đang học';
```

Delete `.syn-breadcrumb` and `.syn-review-banner` rules.

- [ ] **Step 4: Pass navigation into the footer and run GREEN**

Use:

```tsx
<LessonRequirementFooter
  context={context}
  navigation={navigation}
  busy={busy}
  onAction={onNextAction}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/workspace-layout apps/web/src/features/review-mode apps/web/src/application.css
git commit -m "refactor: remove redundant lesson navigation chrome"
```

---

### Task 3: Unify Lesson and Assessment Routes in the Workspace Shell

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Create: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx`
- Create: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx`
- Delete: `apps/web/src/features/chapter-assessment/ChapterAssessmentPage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Produces:

```ts
export type LearningWorkspaceRoute =
  | { readonly kind: 'lesson'; readonly courseId?: string; readonly chapterId?: string; readonly lessonId: string | null }
  | { readonly kind: 'assessment'; readonly courseId: string; readonly chapterId: string; readonly assessmentId: string };
```

- `LearningWorkspacePage` accepts `route: LearningWorkspaceRoute`.
- `AssessmentWorkspaceContent` consumes `courseId`, `chapterId`, `assessmentId`, `navigation`, and shared navigation/action callbacks.

- [ ] **Step 1: Add failing App/workspace route tests**

Verify an assessment route renders `LearningWorkspacePage` semantics including:
- top navigation (`Điều hướng khóa học`),
- AI assistant,
- assessment `<h1>`,
- no standalone `.syn-assessment-page`.

- [ ] **Step 2: Run route/workspace tests and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

- [ ] **Step 3: Change App to pass a route descriptor**

Map parsed routes:

```tsx
return <LearningWorkspacePage route={{ kind: 'assessment', ...route }} />;
```

Legacy/current lesson routes become `kind: 'lesson'` descriptors.

- [ ] **Step 4: Extract assessment content**

Move query/mutation behavior from `ChapterAssessmentPage` into `AssessmentWorkspaceContent`. Render a full-width article with:
- status/title,
- learner-facing requirements,
- latest/best result when present,
- native check button,
- shared `LessonRequirementFooter` or shared action presentation using `navigation.nextAction` after completion.

After check success invalidate:

```ts
['chapter-assessment', courseId, chapterId, assessmentId]
['course-navigation', courseId]
['course']
```

- [ ] **Step 5: Make LearningWorkspacePage own common shell queries and navigation**

For both route kinds:
- load course and course navigation,
- render one `AppHeader` and `LearningTopNavigation`,
- render one `AssistantPanel`,
- use shared loading/error pages.

Lesson routes retain current lesson/practice behavior. Assessment routes render `AssessmentWorkspaceContent` inside a full-width workspace body.

- [ ] **Step 6: Remove standalone page and CSS**

Delete `ChapterAssessmentPage.tsx` and `.syn-assessment-page`. Add `.syn-assessment-workspace` styles matching reading lesson width/spacing/scroll ownership.

- [ ] **Step 7: Run focused DOM tests and typecheck**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app apps/web/src/features/chapter-assessment apps/web/src/features/workspace-layout apps/web/src/application.css
git commit -m "feat: render assessments in the learning workspace"
```

---

### Task 4: Correct Backend Terminal Progression Semantics

**Files:**
- Modify: `internal/progression/navigation.go`
- Modify: `internal/progression/navigation_test.go`
- Modify: any focused server test that expects `VIEW_COURSE_SUMMARY`.

**Interfaces:**
- `NextActionViewCourseSummary` remains declared for protocol compatibility.
- `NextActionFor` returns `NextActionNone` when course status is completed.

- [ ] **Step 1: Add a failing Go test**

```go
func TestCompletedCourseHasNoSyntheticSummaryAction(t *testing.T) {
    action := NextActionFor(graph, completedEvaluation, ItemRef{Kind: ItemLesson, ID: "final"})
    if action.Type != NextActionNone {
        t.Fatalf("got %s want %s", action.Type, NextActionNone)
    }
}
```

- [ ] **Step 2: Run the focused Go test and confirm RED**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/progression -run TestCompletedCourseHasNoSyntheticSummaryAction -count=1
```

Expected: current implementation returns `VIEW_COURSE_SUMMARY`.

- [ ] **Step 3: Return `NextActionNone` for completed course**

Replace the terminal branch with:

```go
if evaluation.CourseStatus == StatusCompleted {
    return NextAction{Type: NextActionNone}
}
```

- [ ] **Step 4: Run progression and server tests**

```bash
bash scripts/go/with-internal-toolchain.sh test ./internal/progression ./internal/server
```

- [ ] **Step 5: Commit**

```bash
git add internal/progression internal/server
git commit -m "fix: stop emitting synthetic course summary actions"
```

---

### Task 5: Integrated Verification and Documentation

**Files:**
- Create: `docs/testing/unified-learning-workspace-manual-verification.md`
- Modify: `docs/superpowers/plans/2026-07-18-unified-learning-workspace-actions-implementation-plan.md` to mark completed checkboxes.

**Interfaces:**
- Produces a manual verification sequence for lesson, review, assessment, and course-complete flows.

- [ ] **Step 1: Run focused automated gates**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/lesson-progress/progression-action.test.ts \
  apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm typecheck
pnpm lint
bash scripts/go/with-internal-toolchain.sh test ./internal/progression ./internal/server
```

- [ ] **Step 2: Write manual verification guide**

Include:
1. lesson 1 CTA reads `Tiếp tục bài Event Loop` after completion,
2. review lesson has no banner/breadcrumb,
3. assessment keeps top shell and AI assistant,
4. assessment completion refreshes navigation and footer,
5. course completion shows status text with no fake button.

- [ ] **Step 3: Commit documentation**

```bash
git add docs/testing docs/superpowers/plans
git commit -m "docs: add unified learning workspace verification"
```
