# Revision 2.1 Visual Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring the approved Single Active Workspace Revision 2 implementation into visual fidelity with the accepted mockup without changing persistence, save-before-switch, or single-editor behavior.

**Architecture:** Keep the existing three-zone composition and controller contracts. Correct visual fidelity at component boundaries: the workspace frame owns viewport height and the assistant dock, Theory owns reading rhythm and document chrome, Practice owns a bounded card header/content/footer, and Navigator remains a fixed sibling. Browser geometry and screenshots are the acceptance source of truth.

**Tech Stack:** React 19, TypeScript 6, CSS, `@synaploom/ui`, Vitest, Testing Library, Playwright, Go embedded runtime.

## Global Constraints

- Preserve exactly one editable activity renderer in the DOM.
- Preserve save-before-switch, optimistic revision conflict handling, refresh persistence, and process-restart recovery.
- Wide desktop remains `Theory | Practice Workspace Card | Activity Navigator`.
- Theory, Practice, and Navigator must share the same bounded main-workspace height and scroll independently.
- AI assistance remains optional and never blocks lesson completion.
- Do not add a new runtime dependency.
- Use Vietnamese UI copy consistent with the approved mockup.
- Every production change starts with a failing test and ends with a focused verification plus commit.

---

### Task 1: Bound the workspace and integrate the assistant dock

**Files:**

- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Consumes: existing `LearningWorkspaceShellProps.assistant` and viewport mapping.
- Produces: `.syn-learning-workspace-layout` with one bounded main row and one complete dock row; `data-workspace-main` for geometry assertions.

- [x] **Step 1: Write the failing component and browser assertions**

```tsx
expect(screen.getByTestId('workspace-layout')).toContainElement(
  screen.getByTestId('workspace-main'),
);
expect(screen.getByTestId('workspace-assistant')).toBeVisible();
```

```ts
const main = page.locator('[data-workspace-main]');
const assistant = page.getByRole('region', { name: 'Trợ lý AI' });
expect(
  (await main.boundingBox())!.height + (await assistant.boundingBox())!.height,
).toBeLessThanOrEqual(page.viewportSize()!.height);
```

- [x] **Step 2: Run focused tests and confirm RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
```

Expected: FAIL because the main and assistant geometry hooks do not exist and the dock is clipped by page-height composition.

- [x] **Step 3: Implement bounded workspace composition**

Add explicit layout hooks:

```tsx
<div className="syn-learning-workspace-layout" data-testid="workspace-layout">
  <div
    className="syn-learning-workspace-layout__main"
    data-workspace-main
    data-testid="workspace-main"
  >
    {workspace}
  </div>
  <div className="syn-learning-workspace-layout__assistant" data-testid="workspace-assistant">
    {assistant}
  </div>
</div>
```

Use `height: 100%`, `min-height: 0`, `overflow: hidden`, and a fixed `3.75rem` dock row. Ensure the top-level learning app uses `100dvh` minus the app header rather than document growth.

- [x] **Step 4: Verify focused tests and geometry pass**

Run the focused component test and the single-active runtime spec. Expected: PASS, with Theory, Practice, Navigator, and dock all contained in the viewport.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/application.css tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "fix: bound learning workspace composition"
```

### Task 2: Restore Theory reading rhythm and document chrome

**Files:**

- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonDocumentRenderer.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonDocumentRenderer.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Consumes: `buildLearningProgressSummary`, lesson blockquote/callout AST.
- Produces: progress card with progress bar and completion icon; GitHub-style admonition blockquotes rendered as `.syn-lesson-callout`; consistent table and section spacing.

- [x] **Step 1: Write RED tests for progress anatomy and NOTE conversion**

```tsx
expect(screen.getByRole('progressbar', { name: 'Tiến độ bài học' })).toBeVisible();
expect(screen.getByTestId('lesson-progress-complete-icon')).toBeVisible();
```

```tsx
expect(screen.getByRole('note', { name: 'Ghi chú' })).toHaveTextContent(
  'Thứ tự bước là một phần của tính đúng đắn.',
);
expect(screen.queryByText('[!NOTE]')).not.toBeInTheDocument();
```

- [x] **Step 2: Run tests and confirm RED**

Expected: progress bar/icon absent and `[!NOTE]` exposed as text.

- [x] **Step 3: Implement progress and callout rendering**

Render a native progress element in `.syn-learning-progress-summary`. In `LessonDocumentRenderer`, detect blockquotes whose first paragraph is exactly `[!NOTE]`, `[!TIP]`, `[!WARNING]`, or `[!IMPORTANT]`; remove the marker and render the remaining blocks through the existing callout anatomy.

- [x] **Step 4: Tighten Theory CSS**

Set a stable reading measure, `24–32px` section gaps, `8–12px` paragraph gaps, table row separators, compact activity-embed margins, and a complete callout surface.

- [x] **Step 5: Verify and commit**

Run page/renderer tests, lint, and typecheck. Commit:

```bash
git commit -m "fix: align theory content with approved mockup"
```

### Task 3: Refine activity summary cards and Navigator anatomy

**Files:**

- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: semantic status dot/check, directional CTA icon, lighter active Navigator surface, and guidance icon.

- [x] **Step 1: Write RED anatomy tests**

Require `data-activity-status-indicator`, CTA arrow icon, `data-navigator-status`, and an information icon in Navigator guidance.

- [x] **Step 2: Implement component anatomy**

Use `ArrowRight`, `Circle`, `Check`, and `Info` from `lucide-react`; keep all status labels textual for accessibility.

- [x] **Step 3: Apply mockup spacing and color hierarchy**

Use neutral borders by default, a subtle blue active surface, `12–16px` card gaps, and `14px` body/button typography.

- [x] **Step 4: Verify and commit**

Run both focused suites, lint, and typecheck. Commit:

```bash
git commit -m "style: refine activity cards and navigator"
```

### Task 4: Refine Practice header, content, and footer hierarchy

**Files:**

- Modify: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: explicit active and save statuses, grouped controls, neutral nested borders, save timestamp label, and completion status outside the action group.

- [x] **Step 1: Write RED tests for header and footer anatomy**

Require separate active status and save status, grouped controls, footer save metadata, action group, and completion status region.

- [x] **Step 2: Implement header hierarchy**

Render ordinal, title, `Đang làm`, and save state as separate semantic elements. Keep list, expand, and collapse controls in consistent button surfaces.

- [x] **Step 3: Implement footer hierarchy**

Keep save state left and activity actions right. Move “Tất cả hoạt động…” into a compact completion status above or beside the footer without centering it between actions.

- [x] **Step 4: Reduce dark renderer dominance**

Add a neutral Practice content surface, preserve contained coding bounds, and reduce empty terminal height while keeping internal scrolling.

- [x] **Step 5: Verify and commit**

Run Practice, ActivityHost, and Coding focused tests plus typecheck. Commit:

```bash
git commit -m "style: refine contained practice workspace"
```

### Task 5: Implement the approved compact contextual AI dock

**Files:**

- Modify: `packages/ui/src/components/assistant-dock/assistant-dock.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Extends `AssistantDockProps` with optional `placeholder` and `contextLabel` while preserving `onRequest(mode)`.
- Produces a complete 56–64px dock with title, passive prompt field, three actions, and send affordance.

- [x] **Step 1: Write RED tests for full dock anatomy**

Require the contextual label, textbox with lesson/activity placeholder, three mode buttons, and send button within the `Trợ lý AI` region.

- [x] **Step 2: Implement compact dock**

Render a single horizontal row on desktop. The prompt field is local-only UI until an explicit free-form AI API contract exists; mode buttons retain current request behavior. Disable send when the prompt is empty.

- [x] **Step 3: Add responsive behavior**

Desktop stays 56–64px. Compact/mobile may wrap into two rows without clipping or increasing the main document height.

- [x] **Step 4: Verify and commit**

Run UI package tests, AssistantPanel tests, lint, typecheck, and build. Commit:

```bash
git commit -m "feat: complete contextual assistant dock"
```

### Task 6: Refresh visual baselines and release verification

**Files:**

- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/*.png`
- Modify: `docs/verification/single-active-workspace-revision-two.md`
- Create: `docs/verification/single-active-workspace-revision-two-one.md`

**Interfaces:**

- Produces: geometry assertions for equal panel height, visible assistant dock, compact Theory rhythm, Practice footer placement, and updated six-state screenshots.

- [x] **Step 1: Add geometry assertions before snapshot updates**

Assert panel bottom edges align within 2px, assistant bottom is inside viewport, Practice footer is below activity content, and raw `[!NOTE]` is absent.

- [x] **Step 2: Run RED browser acceptance**

Stage web assets, build one Go runtime binary, and run the visual spec without updating snapshots. Expected: geometry or screenshots fail against the previous implementation.

- [x] **Step 3: Update and inspect six baselines**

Generate ordering-wide, coding-wide, collapsed-wide, navigator-1366, compact, and mobile screenshots. Inspect each image before accepting it.

- [x] **Step 4: Run full verification**

Run format, lint, typecheck, exact `pnpm test`, production build, Go verify, course validators, embedded inventory, visual/persistence/multi-domain/browser suites, and native preview build.

- [x] **Step 5: Record evidence and commit**

```bash
git commit -m "test: verify revision two one visual fidelity"
```

- [x] **Step 6: Package source and Git history**

Create source ZIP with Git bundle, clone the bundle, compare commit/tree/archive hashes, verify ZIP CRC, and generate SHA-256 files.
