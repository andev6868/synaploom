# Single Active Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the dual-surface learning workspace so every authored activity is represented by a read-only summary in Theory while exactly one editable activity is mounted in Practice, with a compact collapsed rail and contextual AI dock.

**Architecture:** Keep the existing workspace presentation persistence, save-before-switch transaction, viewport mapping, and `ActivityHost` lifecycle. Replace the remaining inline-editor branch with a summary-only component, remove the `return-inline` transition from the UI/controller, make Practice the sole editor host, and tighten the shell/layout CSS around independent scroll ownership and a 52–56 px collapsed rail. Lesson and assessment composition continue sharing the same controller and shell.

**Tech Stack:** React 19, TypeScript 6, TanStack Query, Vitest + Testing Library, Playwright, Go runtime with embedded Vite assets, pnpm 11.13.0.

## Global Constraints

- Exactly one editable activity renderer may exist in the DOM.
- Every authored activity position in Theory renders a summary card, never an editor.
- All activity kinds, including assessment activities, use the same Practice-hosted interaction model.
- Dirty activity state must save before focus, collapse, expand, resize, or activity-list navigation changes.
- Save failure keeps the current editor mounted and blocks the requested transition.
- Existing workspace presentation persistence, optimistic revision handling, and attempt data remain backward compatible.
- Historical `allowInline` and `defaultSurface: inline` metadata remain parseable but do not mount inline editors.
- Theory and Practice own independent scroll containers at wide, compact, and mobile breakpoints.
- The desktop collapsed Practice surface occupies approximately 52–56 px and must not reserve a blank content column.
- Focus, collapse state, split ratio, and active draft survive refresh and runtime restart.
- Opening Practice moves keyboard focus to the active Practice heading after persistence succeeds.
- Status must be communicated using text and icon, not color alone.
- Use test-first development and create one focused commit per task.

---

## Planned file structure

- `apps/web/src/features/learning-workspace/ActivitySummaryCard.tsx`: summary-only representation used by lesson and assessment theory content.
- `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`: focused/non-focused/collapsed summary behavior.
- `apps/web/src/features/learning-workspace/InlineActivitySlot.tsx`: compatibility wrapper that delegates to `ActivitySummaryCard`; no editor mounting.
- `apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts`: remove return-inline transition and expose Practice-only transitions.
- `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`: unified status, collapse, expand, and activity-list controls.
- `apps/web/src/features/learning-workspace/PracticePane.tsx`: sole `ActivityHost`, stable body/action layout, save/error feedback.
- `apps/web/src/features/learning-workspace/ActivityTray.tsx`: authored-order activity navigation with active state.
- `apps/web/src/features/learning-workspace/WorkspacePaneRail.tsx`: narrow collapsed rail and restoration affordance.
- `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`: wide/compact/mobile surface mapping and independent scroll ownership.
- `apps/web/src/features/ai-assistant/AssistantPanel.tsx`: explicit lesson/activity context label.
- `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`: pass context and compose one editor host.
- `apps/web/src/application.css`: approved visual hierarchy, stable pane sizing, compact rail, summary cards, and contextual assistant dock.
- `tests/e2e/dual-surface-workspace-runtime.spec.ts`: one-editor, scroll, collapse/restore, save-before-switch, and restart acceptance.
- `tests/e2e/multi-domain-runtime.spec.ts`: all activity kinds and assessment use summary + Practice behavior.

---

### Task 1: Lock the summary-only activity contract

**Files:**

- Create: `apps/web/src/features/learning-workspace/ActivitySummaryCard.tsx`
- Create: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/InlineActivitySlot.tsx`
- Modify: `apps/web/src/features/learning-workspace/InlineActivitySlot.test.tsx`

**Interfaces:**

- Consumes: `ResolvedWorkspaceActivity`, `ActivityStatusPayload | null`, `PracticePaneMode`, and `(activityId: string) => Promise<void>`.
- Produces:

```ts
export interface ActivitySummaryCardProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onRegisterHeading?: (activityId: string, element: HTMLElement | null) => void;
}

export function ActivitySummaryCard(props: ActivitySummaryCardProps): ReactNode;
```

- [ ] **Step 1: Write failing summary-card tests**

```tsx
it('never mounts an editable activity host', () => {
  render(
    <InlineActivitySlot
      item={item}
      owner={owner}
      focused={false}
      paneMode="collapsed"
      status={null}
      onOpenPractice={vi.fn(() => Promise.resolve())}
      onProgressChanged={vi.fn()}
      onPersistenceHandleChange={vi.fn()}
      renderHost={() => <input aria-label="editor" />}
    />,
  );

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thực hành bài này' })).toBeVisible();
});

it('describes the focused activity as open in Practice', () => {
  render(
    <ActivitySummaryCard
      item={item}
      focused
      paneMode="split"
      status={draftStatus}
      onOpenPractice={vi.fn(() => Promise.resolve())}
    />,
  );

  expect(screen.getByText('Đang làm · Đã lưu bản nháp')).toBeVisible();
  expect(screen.getByText('Activity đang mở trong khu vực thực hành.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Quay lại thực hành' })).toBeVisible();
});

it('uses a restore action when focused Practice is collapsed', () => {
  render(
    <ActivitySummaryCard
      item={item}
      focused
      paneMode="collapsed"
      status={draftStatus}
      onOpenPractice={vi.fn(() => Promise.resolve())}
    />,
  );

  expect(screen.getByText('Activity đang tạm ẩn trong khu vực thực hành.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Mở lại thực hành' })).toBeVisible();
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/InlineActivitySlot.test.tsx
```

Expected: FAIL because `ActivitySummaryCard` does not exist and the non-focused inline slot still mounts `renderHost()`.

- [ ] **Step 3: Implement the summary-only card**

```tsx
export function ActivitySummaryCard({
  item,
  focused,
  paneMode,
  status,
  onOpenPractice,
  onRegisterHeading = () => undefined,
}: ActivitySummaryCardProps): ReactNode {
  const savedDraft = status?.status === 'DRAFT';
  const statusText = focused
    ? savedDraft
      ? 'Đang làm · Đã lưu bản nháp'
      : 'Đang làm'
    : activityStatusLabel(status?.status ?? 'AVAILABLE');
  const message = focused
    ? paneMode === 'collapsed'
      ? 'Activity đang tạm ẩn trong khu vực thực hành.'
      : 'Activity đang mở trong khu vực thực hành.'
    : item.activity.title;
  const action = focused
    ? paneMode === 'collapsed'
      ? 'Mở lại thực hành'
      : 'Quay lại thực hành'
    : 'Thực hành bài này';

  return (
    <section
      className={`syn-activity-summary${focused ? ' syn-activity-summary--active' : ''}`}
      data-activity-id={item.activity.id}
      data-focused={focused || undefined}
    >
      <div className="syn-activity-summary__content">
        <h3
          ref={(element) => onRegisterHeading(item.activity.id, element)}
          data-inline-activity-heading
          tabIndex={-1}
        >
          {item.activity.title}
        </h3>
        <p className="syn-activity-summary__status">{statusText}</p>
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={() => void onOpenPractice(item.activity.id).catch(() => undefined)}
      >
        {action}
      </button>
    </section>
  );
}
```

Update `InlineActivitySlot` so it delegates directly to `ActivitySummaryCard` and does not build `ActivityHostProps` or call `renderHost`.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/InlineActivitySlot.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: all tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/ActivitySummaryCard.tsx \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/InlineActivitySlot.tsx \
  apps/web/src/features/learning-workspace/InlineActivitySlot.test.tsx
git commit -m "feat: render theory activities as summaries"
```

---

### Task 2: Remove return-inline behavior from the controller and header

**Files:**

- Modify: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts`
- Modify: `apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`

**Interfaces:**

- Consumes: existing `focusActivity`, `collapsePracticePane`, `expandPracticePane`, `restoreSplitPane`, `setSplitRatio`, and `retryLastSave` transitions.
- Produces: `WorkspaceTransitionKind` without `'return-inline'`; `LearningWorkspaceController` without `returnActivityInline()`.

- [ ] **Step 1: Write failing tests for Practice-only navigation**

```tsx
it('does not expose a return-inline transition', () => {
  const controller = renderController();
  expect('returnActivityInline' in controller.current).toBe(false);
});

it('renders no inline-editor action in the Practice header', () => {
  render(<PracticePane {...propsWithInlineCapableActivity} />);
  expect(screen.queryByRole('button', { name: 'Làm tại đây' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
```

Expected: FAIL because the controller still exposes `returnActivityInline` and the header still renders `Làm tại đây`.

- [ ] **Step 3: Remove the transition**

Make these exact changes:

```ts
export type WorkspaceTransitionKind =
  'focus' | 'collapse' | 'expand' | 'restore-split' | 'resize' | 'next';
```

Delete `returnActivityInline` from `LearningWorkspaceController`, delete its callback implementation, remove the `intent.kind === 'return-inline'` focus branch, and always focus the Practice heading after a successful non-collapsed transition.

Remove the `allowInline` button block from `PracticePaneHeader`.

- [ ] **Step 4: Run focused tests, lint, and typecheck**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
pnpm lint
pnpm --filter @synaploom/web typecheck
```

Expected: tests PASS; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/useLearningWorkspaceController.ts \
  apps/web/src/features/learning-workspace/useLearningWorkspaceController.test.tsx \
  apps/web/src/features/learning-workspace/PracticePaneHeader.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
git commit -m "refactor: make practice the only activity surface"
```

---

### Task 3: Make the Practice Pane the complete active-workspace surface

**Files:**

- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivityTray.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivityTray.test.tsx`

**Interfaces:**

- Consumes: `LearningWorkspaceController`, `ActivityStatusPayload[]`, `ResolvedWorkspaceActivity[]`, and one `renderHost` function.
- Produces: one `data-active-activity-editor` host, active tray state, save-state label, and shell-level navigation controls.

- [ ] **Step 1: Write failing Practice hierarchy tests**

```tsx
it('mounts exactly one active editor and exposes active activity metadata', () => {
  render(<PracticePane {...props} renderHost={() => <textarea aria-label="active editor" />} />);

  expect(screen.getAllByRole('textbox', { name: 'active editor' })).toHaveLength(1);
  expect(screen.getByText('1/2')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Sắp xếp thuật toán' })).toBeVisible();
  expect(screen.getByText('Đã lưu bản nháp')).toBeVisible();
});

it('marks the focused activity in the activity list', () => {
  render(
    <ActivityTray
      activities={activities}
      statuses={statuses}
      controller={controller}
      focusedActivityId="ordering"
    />,
  );
  expect(screen.getByRole('button', { name: /Sắp xếp thuật toán/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx
```

Expected: FAIL because the tray has no active-state API and the header does not display the save-state label.

- [ ] **Step 3: Implement the unified Practice hierarchy**

Extend `ActivityTray`:

```ts
readonly focusedActivityId: string | null;
```

and apply:

```tsx
aria-current={item.activity.id === focusedActivityId ? 'true' : undefined}
```

Pass `focusedActivityId={focused.activity.id}` from `PracticePane`.

Add to `PracticePaneHeader`:

```tsx
<p className="syn-practice-pane__save-status" aria-live="polite">
  {controller.saveStatus === 'saving'
    ? 'Đang lưu…'
    : controller.saveStatus === 'saved'
      ? 'Đã lưu bản nháp'
      : controller.saveStatus === 'error'
        ? 'Lưu thất bại'
        : activityStatusLabel(status?.status ?? 'AVAILABLE')}
</p>
```

Pass `status` into the header. Add `data-active-activity-editor` to the Practice body wrapper. Keep renderer-specific submit/run controls inside `ActivityHost`.

- [ ] **Step 4: Run focused tests and accessibility assertions**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/PracticePane.tsx \
  apps/web/src/features/learning-workspace/PracticePaneHeader.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx
git commit -m "feat: unify active practice workspace hierarchy"
```

---

### Task 4: Replace the blank collapsed column with a compact Practice Rail

**Files:**

- Modify: `apps/web/src/features/learning-workspace/WorkspacePaneRail.tsx`
- Modify: `apps/web/src/features/learning-workspace/WorkspacePaneRail.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Consumes: focused activity, authored activity count, status list, and `restoreSplitPane()`.
- Produces: a desktop rail with `data-workspace-practice-rail`, `aria-expanded="false"`, and width constrained to `3.5rem`.

- [ ] **Step 1: Write failing rail and shell tests**

```tsx
it('renders a compact collapsed rail that restores the same activity', () => {
  render(<WorkspacePaneRail {...props} />);
  const rail = screen.getByLabelText('Khu vực thực hành đang thu gọn');

  expect(rail).toHaveAttribute('data-workspace-practice-rail');
  expect(screen.getByRole('button', { name: /Mở lại Sắp xếp thuật toán/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  fireEvent.click(screen.getByRole('button', { name: /Mở lại Sắp xếp thuật toán/ }));
  expect(controller.restoreSplitPane).toHaveBeenCalledOnce();
});

it('uses a fixed compact rail column in collapsed desktop mode', () => {
  render(<LearningWorkspaceShell {...collapsedWideProps} />);
  expect(screen.getByRole('main')).toHaveClass('syn-learning-workspace--collapsed');
  expect(screen.getByTestId('practice-rail')).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/WorkspacePaneRail.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
```

Expected: FAIL because the current rail is a full information card and has no collapsed-control semantics.

- [ ] **Step 3: Implement compact rail markup and sizing**

Use this structure:

```tsx
<aside
  className="syn-workspace-pane-rail"
  data-workspace-practice-rail
  aria-label="Khu vực thực hành đang thu gọn"
>
  <button
    type="button"
    aria-expanded="false"
    aria-controls="syn-practice-pane"
    aria-label={`Mở lại ${focusedActivity.activity.title}`}
    onClick={() => void controller.restoreSplitPane().catch(() => undefined)}
  >
    <span aria-hidden="true">↤</span>
    <strong>Thực hành</strong>
    <span>{activities.length}</span>
  </button>
</aside>
```

Apply exact desktop sizing:

```css
.syn-learning-workspace--collapsed {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.5rem;
}

.syn-workspace-pane-rail {
  width: 3.5rem;
  min-width: 3.5rem;
  border-left: 1px solid var(--syn-color-border, #d8dde6);
  background: var(--syn-color-surface, #fff);
}

.syn-workspace-pane-rail > button {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  align-content: start;
  gap: 0.75rem;
  padding: 0.75rem 0.375rem;
}

.syn-workspace-pane-rail strong {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
```

- [ ] **Step 4: Run tests and browser-independent layout checks**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/WorkspacePaneRail.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
pnpm lint
pnpm --filter @synaploom/web typecheck
```

Expected: tests PASS; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/WorkspacePaneRail.tsx \
  apps/web/src/features/learning-workspace/WorkspacePaneRail.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/application.css
git commit -m "feat: add compact collapsed practice rail"
```

---

### Task 5: Stabilize wide, compact, and mobile surface behavior

**Files:**

- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx`
- Modify: `apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Consumes: persisted `PracticePaneMode`, local `CompactSurface`, and viewport classification.
- Produces: wide split/collapsed/expanded mapping; compact Theory/Practice tabs; mobile full-screen Practice dialog; independent Theory and Practice scroll ownership.

- [ ] **Step 1: Write failing responsive behavior tests**

```tsx
it('does not mount Practice under the mobile sheet', () => {
  mockViewport('mobile');
  render(<LearningWorkspaceShell {...splitProps} />);

  expect(screen.getAllByTestId('practice-surface')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('practice-surface'));
});

it('keeps compact surface switching local without persisting pane mode', () => {
  mockViewport('compact');
  const onSplitRatioCommit = vi.fn();
  render(<LearningWorkspaceShell {...splitProps} onSplitRatioCommit={onSplitRatioCommit} />);

  fireEvent.click(screen.getByRole('button', { name: 'Thực hành' }));
  expect(screen.getByTestId('practice-surface')).toBeVisible();
  expect(onSplitRatioCommit).not.toHaveBeenCalled();
});

it('renders bounded independent Theory and Practice regions in wide split mode', () => {
  mockViewport('wide');
  render(<LearningWorkspaceShell {...splitProps} />);
  expect(screen.getByTestId('theory-surface')).toHaveClass('syn-learning-workspace__theory');
  expect(screen.getByTestId('practice-surface')).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx
```

Expected: at least one assertion fails until explicit test IDs, single mobile mount, and bounded layout semantics are present.

- [ ] **Step 3: Implement one mount per viewport and explicit scroll ownership**

Ensure the wide split wraps Theory once and passes Practice once to `WorkspaceShell`. Keep mobile Practice only inside `Dialog`. Add:

```css
.syn-learning-workspace,
.syn-learning-workspace > *,
.syn-practice-pane {
  min-width: 0;
  min-height: 0;
}

.syn-learning-workspace__theory {
  height: 100%;
  overflow: hidden;
}

.syn-lesson-panel,
.syn-practice-pane {
  height: 100%;
  min-height: 0;
}

.syn-lesson-panel__scroll,
.syn-practice-pane__body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
```

Keep compact surface state local and never call persistence APIs when switching compact tabs.

- [ ] **Step 4: Run focused tests and the existing scroll regression**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/learning-workspace/LearningWorkspaceShell.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx \
  apps/web/src/features/learning-workspace/useWorkspaceViewport.test.tsx \
  apps/web/src/application.css
git commit -m "fix: stabilize responsive workspace surfaces"
```

---

### Task 6: Apply the shared model to lesson and assessment compositions

**Files:**

- Modify: `apps/web/src/features/lesson-content/LessonActivities.tsx`
- Modify: `apps/web/src/features/lesson-content/LessonActivities.test.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx`
- Modify: `apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`

**Interfaces:**

- Consumes: `ActivitySummaryCard` through `InlineActivitySlot`, `LearningWorkspaceController.focusActivity`, and the shared `PracticePane`.
- Produces: lesson and assessment Theory surfaces containing summary cards only, with exactly one Practice-hosted editor.

- [ ] **Step 1: Write failing integration tests**

```tsx
it('renders all lesson activities as summaries and one focused Practice editor', async () => {
  renderLessonWorkspace();
  await screen.findByRole('heading', { name: 'Dòng chảy thuật toán' });

  expect(screen.getAllByText(/Thực hành bài này|Quay lại thực hành/)).toHaveLength(2);
  expect(screen.getAllByTestId('activity-editor')).toHaveLength(1);
});

it('uses the same summary plus Practice model for assessment questions', async () => {
  renderAssessmentWorkspace();
  await screen.findByRole('heading', { name: 'Đánh giá chương' });

  expect(
    screen.getAllByRole('button', { name: /Thực hành bài này|Quay lại thực hành/ }).length,
  ).toBeGreaterThan(0);
  expect(screen.getAllByTestId('activity-editor')).toHaveLength(1);
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/lesson-content/LessonActivities.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: FAIL until all inline paths are summary-only and tests use the shared one-editor contract.

- [ ] **Step 3: Simplify composition props**

Remove `owner`, `onProgressChanged`, `onPersistenceHandleChange`, and `renderHost` from the summary component path where they are no longer used. Keep these props only in `PracticePane`.

Use this summary invocation in both lesson and assessment:

```tsx
<InlineActivitySlot
  item={item}
  focused={focusedActivityId === item.activity.id}
  paneMode={controller.state.paneMode}
  status={findActivityStatus(statuses, item.activity.id)}
  onOpenPractice={(activityId) => controller.focusActivity(activityId)}
  onRegisterInlineHeading={(activityId, element) =>
    controller.registerInlineHeading(activityId, element)
  }
/>
```

Confirm `LearningWorkspacePage` mounts `PracticePane` exactly once per composition.

- [ ] **Step 4: Run integration tests and typecheck**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/lesson-content/LessonActivities.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm --filter @synaploom/web typecheck
```

Expected: tests PASS and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/lesson-content/LessonActivities.tsx \
  apps/web/src/features/lesson-content/LessonActivities.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
git commit -m "feat: unify lesson and assessment activity surfaces"
```

---

### Task 7: Add contextual AI dock semantics

**Files:**

- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Consumes: lesson title and optional focused activity title.
- Produces:

```ts
export interface AssistantPanelProps {
  readonly lessonTitle: string;
  readonly activityTitle?: string;
}
```

The displayed context is `Hoạt động: <title>` when `activityTitle` exists, otherwise `Bài học: <title>`.

- [ ] **Step 1: Write failing context tests**

```tsx
it('shows activity context when Practice has focus', () => {
  render(<AssistantPanel lessonTitle="Dòng chảy thuật toán" activityTitle="Sắp xếp thuật toán" />);
  expect(screen.getByText('Hoạt động: Sắp xếp thuật toán')).toBeVisible();
});

it('falls back to lesson context without a focused activity', () => {
  render(<AssistantPanel lessonTitle="Dòng chảy thuật toán" />);
  expect(screen.getByText('Bài học: Dòng chảy thuật toán')).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant/AssistantPanel.test.tsx
```

Expected: FAIL because `AssistantPanel` accepts no context props and renders no visible context label.

- [ ] **Step 3: Implement contextual labeling and prompt propagation**

```tsx
export function AssistantPanel({ lessonTitle, activityTitle }: AssistantPanelProps): ReactNode {
  const context = activityTitle ? `Hoạt động: ${activityTitle}` : `Bài học: ${lessonTitle}`;

  const request = async (mode: AssistantMode): Promise<void> => {
    const response = await api.requestAi({
      kind: kinds[mode],
      prompt: `${context}. Hỗ trợ người học theo chế độ ${mode}.`,
    });
    setMessage(response.status === 'ok' ? response.content : response.message);
  };

  return (
    <section className="syn-assistant-context" aria-label="Trợ lý AI">
      <p>{context}</p>
      <AssistantDock
        {...(message === undefined ? {} : { message })}
        onRequest={(mode) => void request(mode)}
      />
    </section>
  );
}
```

Pass the lesson or assessment title plus `controller.focusedActivity?.activity.title` from both workspace compositions.

- [ ] **Step 4: Run tests, lint, and typecheck**

```bash
pnpm exec vitest run --project dom apps/web/src/features/ai-assistant/AssistantPanel.test.tsx
pnpm lint
pnpm --filter @synaploom/web typecheck
```

Expected: test PASS; lint and typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/ai-assistant/AssistantPanel.tsx \
  apps/web/src/features/ai-assistant/AssistantPanel.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/application.css
git commit -m "feat: contextualize workspace AI assistance"
```

---

### Task 8: Implement the approved visual hierarchy

**Files:**

- Modify: `apps/web/src/application.css`
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`

**Interfaces:**

- Consumes: semantic class names introduced by Tasks 1–7.
- Produces: stable 55–65% Theory split, visually dominant Practice surface, restrained active summary, sticky/reachable Practice actions, and integrated assistant dock.

- [ ] **Step 1: Add semantic class assertions before styling**

```tsx
expect(
  screen.getByText('Activity đang mở trong khu vực thực hành.').closest('section'),
).toHaveClass('syn-activity-summary--active');
expect(screen.getByLabelText('Khu vực thực hành')).toHaveClass('syn-practice-pane');
expect(screen.getByLabelText('Trợ lý AI')).toHaveClass('syn-assistant-context');
```

- [ ] **Step 2: Verify RED where classes are missing**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: FAIL for any semantic class not introduced by earlier tasks.

- [ ] **Step 3: Apply the approved design tokens and layout rules**

Implement these concrete rules, adjusting only selectors needed by existing components:

```css
.syn-activity-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--syn-color-border, #d8dde6);
  border-radius: 0.75rem;
  background: var(--syn-color-surface, #fff);
}

.syn-activity-summary--active {
  border-color: color-mix(in srgb, var(--syn-color-primary, #2563eb) 35%, white);
  background: color-mix(in srgb, var(--syn-color-primary, #2563eb) 5%, white);
}

.syn-practice-pane {
  height: 100%;
  border-color: color-mix(in srgb, var(--syn-color-primary, #2563eb) 40%, white);
  box-shadow: 0 12px 32px rgb(15 23 42 / 0.08);
}

.syn-practice-pane__header,
.syn-practice-pane__actions {
  flex: none;
}

.syn-practice-pane__actions {
  position: sticky;
  bottom: 0;
  background: var(--syn-color-surface, #fff);
}

.syn-assistant-context {
  flex: none;
  border-top: 1px solid var(--syn-color-border, #d8dde6);
  background: var(--syn-color-surface, #fff);
}
```

Keep the Theory article reading measure stable with `width: min(54rem, 100%)` and centered inline margins. Do not create a third permanent content column for the tray.

- [ ] **Step 4: Run formatting, focused tests, and build**

```bash
pnpm format
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm --filter @synaploom/web build
```

Expected: tests PASS and Vite build exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/application.css \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
git commit -m "style: align workspace with approved single-active UI"
```

---

### Task 9: Add browser acceptance for the single-editor model

**Files:**

- Modify: `tests/e2e/dual-surface-workspace-runtime.spec.ts`
- Modify: `tests/e2e/multi-domain-runtime.spec.ts`

**Interfaces:**

- Consumes: staged Go runtime, example courses, persisted workspace presentation, and browser-visible activity controls.
- Produces: acceptance evidence for one editor, save-before-switch, compact rail, independent scroll, all activity kinds, assessment, refresh, and process restart.

- [ ] **Step 1: Add failing browser assertions**

Add these checks to the existing runtime flow:

```ts
await expect(page.locator('[data-active-activity-editor]')).toHaveCount(1);
await expect(
  page.locator('.syn-activity-summary input, .syn-activity-summary textarea'),
).toHaveCount(0);
await expect(page.locator('.syn-workspace-pane-rail')).toHaveCSS('width', '56px');
```

For save-before-switch:

```ts
await page.getByRole('textbox', { name: 'Câu trả lời' }).fill('Bản nháp chưa lưu');
const saveRequest = page.waitForRequest(
  (request) => request.method() === 'PUT' && request.url().includes('/attempts/'),
);
await page.getByRole('button', { name: 'Thực hành bài này' }).nth(1).click();
await saveRequest;
await expect(page.locator('[data-active-activity-editor]')).toHaveCount(1);
```

For independent scrolling:

```ts
const theory = page.locator('.syn-lesson-panel__scroll');
const practice = page.locator('.syn-practice-pane__body');
await theory.hover();
await page.mouse.wheel(0, 600);
await expect.poll(() => theory.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
await expect.poll(() => practice.evaluate((node) => node.scrollTop)).toBe(0);
```

- [ ] **Step 2: Run browser tests and verify RED**

```bash
pnpm go:stage-web
pnpm exec playwright test tests/e2e/dual-surface-workspace-runtime.spec.ts \
  tests/e2e/multi-domain-runtime.spec.ts --project=go-runtime --reporter=line
```

Expected: FAIL until the implementation consistently exposes one editor, compact rail width, and summary-only Theory content.

- [ ] **Step 3: Adjust only product defects revealed by acceptance**

Fix the relevant component or CSS source identified by each failure. Do not weaken selectors, remove the one-editor assertion, or add arbitrary waits. Keep request synchronization tied to the actual save endpoint and keep restart tests on the same `SYNAPLOOM_HOME`.

- [ ] **Step 4: Run the full Go-runtime browser project**

```bash
pnpm go:stage-web
pnpm exec playwright test --project=go-runtime --reporter=line
```

Expected: all Go-runtime Playwright tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/dual-surface-workspace-runtime.spec.ts \
  tests/e2e/multi-domain-runtime.spec.ts \
  apps/web/src
git commit -m "test: verify single active workspace runtime"
```

---

### Task 10: Run release verification and record evidence

**Files:**

- Modify: `docs/verification/workspace-presentation-verification.md`
- Modify only if generated/staged output changes: `internal/server/web_dist/**`

**Interfaces:**

- Consumes: the complete implementation from Tasks 1–9.
- Produces: fresh release evidence with exact commands, exit status, test counts, commit hash, and known limitations.

- [ ] **Step 1: Run static and generated-contract gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:type-strip
pnpm contracts:check
```

Expected: every command exits 0 with no warnings.

- [ ] **Step 2: Run frontend, documentation, and build gates**

```bash
pnpm test
pnpm test:workspace-presentation-docs
pnpm test:activity-engine-docs
pnpm build
```

Expected: all tests PASS and all workspace packages build successfully.

- [ ] **Step 3: Run Go and example-course gates**

```bash
pnpm go:verify
pnpm validate:example
pnpm validate:multi-domain
pnpm go:stage-web
pnpm go:verify-web-inventory
```

Expected: Go formatting/tests/vet/staticcheck PASS; both courses validate; staged asset inventory matches.

- [ ] **Step 4: Run final browser and native-preview gates**

```bash
pnpm exec playwright test --project=go-runtime --reporter=line
pnpm go:build-preview
pnpm go:verify-release
```

Expected: browser project PASS; preview binary builds and release verification exits 0.

- [ ] **Step 5: Record evidence**

Update `docs/verification/workspace-presentation-verification.md` with:

```markdown
## Single Active Workspace verification — 2026-07-20

- Commit: `<git rev-parse HEAD>`
- Exactly one editable renderer: verified by Vitest and Playwright.
- Theory summary-only rendering: verified for lesson and assessment.
- Save-before-switch: verified with request synchronization.
- Compact rail: verified at 56 px in desktop collapsed mode.
- Independent scroll: verified by wheel-driven browser assertions.
- Refresh and runtime restart persistence: verified on one `SYNAPLOOM_HOME`.
- Static, frontend, Go, course, browser, and native release gates: PASS.
```

Replace `<git rev-parse HEAD>` with the actual hash before committing.

- [ ] **Step 6: Confirm clean diff and commit**

```bash
git diff --check
git status --short
git add docs/verification/workspace-presentation-verification.md internal/server/web_dist
git commit -m "docs: record single active workspace verification"
git status --short
```

Expected: `git diff --check` exits 0 and final `git status --short` prints nothing.
