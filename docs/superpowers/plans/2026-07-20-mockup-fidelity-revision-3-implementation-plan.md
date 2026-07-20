# Synaploom Mockup Fidelity Revision 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Single Active Workspace match the approved `1672 × 941` mockup at no less than 90% screenshot similarity while preserving all responsive and behavioral contracts.

**Architecture:** Keep the existing React controller, activity engine, Go persistence service, and responsive shell. Correct fidelity through deterministic fixture/test state, bounded markup changes in Header/Theory/Practice/Navigator/Assistant components, a `0.54` first-load split ratio, and consolidation of the final CSS owners instead of appending another override layer.

**Tech Stack:** React 19, TypeScript 6, CSS, `@synaploom/ui`, Vitest 4, Testing Library, Playwright 1.61, Go, SQLite-backed native runtime.

## Global Constraints

- Canonical viewport is exactly `1672 × 941` CSS pixels with device scale factor `1`.
- Canonical state is ordering activity focused, draft saved, second activity unopened, ordering `read → show → add`, Theory scrolled to top, permanent Navigator visible, and AI dock visible.
- Approved mockup `docs/superpowers/specs/assets/2026-07-20-single-active-workspace-approved.png` is immutable acceptance evidence and must never be regenerated from runtime output.
- Canonical screenshot diff must use `maxDiffPixelRatio: 0.10` or stricter.
- Primary geometry anchors must remain within `2–4px` tolerance.
- Preserve one editable activity renderer in the DOM.
- Preserve save-before-switch, failed-save retry, draft persistence, split-ratio persistence, collapse/restore, Navigator drawer, mobile Practice dialog, coding containment, keyboard operation, and reduced-motion behavior.
- User-persisted split ratios remain authoritative; only the new-workspace default changes to `0.54`.
- Do not add runtime dependencies.
- Do not implement pointer drag-and-drop.
- Do not change API schemas, database schemas, progression rules, or assessment rules.
- Do not append a new terminal override section to `apps/web/src/application.css`; edit and delete the existing authoritative/superseded rules in place.
- Every production change starts with a failing focused test, passes focused verification, and ends with a commit.

---

## File ownership map

| File or area | Responsibility in Revision 3 |
|---|---|
| `examples/multi-domain-foundations/lessons/01-algorithm-flow/lesson.md` | Canonical authored order: two activity summaries are consecutive, then note and summary. |
| `tests/e2e/single-active-workspace-go-runtime.spec.ts` | Deterministic canonical setup, geometry assertions, approved-mockup comparison, and responsive regressions. |
| `packages/ui/src/components/app-header/app-header.tsx` | Product brand, divider, central navigation slot, and trailing slot. |
| `apps/web/src/features/learning-progress/LearningTopNavigation.tsx` | Chapter/lesson breadcrumb selectors and previous/next/curriculum controls. |
| `packages/ui/src/components/workspace-shell/workspace-shell.tsx` | Resizable Theory/Practice split and sibling Navigator geometry. |
| `internal/workspacepresentation/model.go` | First-load split-ratio default only. |
| `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx` | Header trailing profile, Theory composition, and assistant context wiring. |
| `apps/web/src/features/learning-workspace/PracticePane.tsx` | Single Practice card anatomy, footer state, and locally observed draft-save time. |
| `apps/web/src/features/learning-workspace/PracticePaneHeader.tsx` | Ordinal/title/status controls and wide/intermediate Navigator trigger. |
| `apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx` | Supporting instruction, six-dot affordance, and keyboard move controls. |
| `apps/web/src/features/learning-workspace/ActivityTray.tsx` | Shared human-readable workspace status labels. |
| `apps/web/src/features/learning-workspace/PracticeActivityNavigator.tsx` | Active/unopened status mapping, chevron, and Navigator item anatomy. |
| `packages/ui/src/components/assistant-dock/assistant-dock.tsx` | One-row dock anatomy and muted square send control. |
| `apps/web/src/features/ai-assistant/AssistantPanel.tsx` | Hidden activity request context with lesson-level visible copy. |
| `packages/ui/src/styles.css` | Shared Header, WorkspaceShell, and AssistantDock base geometry. |
| `apps/web/src/application.css` | Application-specific Theory, Practice, Navigator, header navigation, and assistant placement. |

---

### Task 1: Lock the canonical authored order and deterministic browser state

**Files:**

- Modify: `examples/multi-domain-foundations/lessons/01-algorithm-flow/lesson.md`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `prepareCanonicalOrderingState(page: Page): Promise<void>`.
- Produces: deterministic browser time `2026-07-20T07:32:00Z`, which renders as `14:32` in `Asia/Ho_Chi_Minh`.
- Produces: canonical DOM order where the second activity summary is above the note.

- [ ] **Step 1: Write the failing canonical-order browser assertion**

Add this helper and assertion near `openActivity`:

```ts
async function prepareCanonicalOrderingState(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-07-20T07:32:00Z') });
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })).toBeVisible();

  await openActivity(page, 'Sắp xếp thuật toán');
  await page.getByRole('button', { name: 'Di chuyển Hiển thị kết quả lên' }).click();
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click();

  await expect(page.locator('.syn-activity-host__state', { hasText: 'Đã lưu bản nháp.' })).toBeVisible();
  const rows = page.locator('.syn-activity-ordering > li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Đọc hai số a và b');
  await expect(rows.nth(1)).toContainText('Hiển thị kết quả');
  await expect(rows.nth(2)).toContainText('Tính a + b');
}
```

At the beginning of the wide-state test, replace the current setup with:

```ts
await prepareCanonicalOrderingState(page);

const secondSummary = page
  .locator('[data-activity-summary-card]')
  .filter({ hasText: 'Viết chương trình tính tổng' });
const note = page.getByRole('note', { name: 'Ghi chú' });
const [secondSummaryBox, noteBox] = await Promise.all([
  secondSummary.boundingBox(),
  note.boundingBox(),
]);
expect(secondSummaryBox).not.toBeNull();
expect(noteBox).not.toBeNull();
expect(secondSummaryBox!.y).toBeLessThan(noteBox!.y);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: FAIL because the note currently appears before `Viết chương trình tính tổng`.

- [ ] **Step 3: Move the note after the second activity in the canonical fixture**

Change the relevant `lesson.md` sequence to exactly:

```md
:::activity id="algorithm-order"
:::

:::activity id="sum-program"
:::

> [!NOTE]
> Thứ tự bước là một phần của tính đúng đắn.

:::summary title="Ghi nhớ"
Thuật toán tốt phải rõ đầu vào, trình tự và đầu ra.
:::
```

- [ ] **Step 4: Run focused validation**

Run:

```bash
pnpm validate:multi-domain
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: course validation PASS; browser test proceeds past canonical ordering and authored-order assertions.

- [ ] **Step 5: Commit**

```bash
git add examples/multi-domain-foundations/lessons/01-algorithm-flow/lesson.md \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "test: lock revision three canonical workspace state"
```

---

### Task 2: Rebuild the desktop header hierarchy

**Files:**

- Create: `packages/ui/src/components/app-header/app-header.test.tsx`
- Modify: `packages/ui/src/components/app-header/app-header.tsx`
- Modify: `apps/web/src/features/learning-progress/LearningTopNavigation.tsx`
- Modify: `apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `data-testid="app-header-divider"`.
- Produces: `.syn-learning-top-nav__breadcrumb-separator` between chapter and lesson selectors.
- Produces: `.syn-learning-profile` with accessible name `Hồ sơ người học`.
- Preserves: `LearningTopNavigationProps` and all navigation callbacks.

- [ ] **Step 1: Add RED AppHeader anatomy test**

Create `packages/ui/src/components/app-header/app-header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppHeader } from '#ui/components/app-header/app-header';

it('renders brand divider, navigation, and trailing content as distinct regions', () => {
  render(<AppHeader navigation={<nav>Learning navigation</nav>} trailing={<span>Local</span>} />);

  expect(screen.getByText('Synaploom')).toBeVisible();
  expect(screen.getByTestId('app-header-divider')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('navigation')).toBeVisible();
  expect(screen.getByText('Local')).toBeVisible();
});
```

- [ ] **Step 2: Update navigation/page tests for the approved hierarchy**

In the first `LearningTopNavigation.test.tsx` case, remove the old `1/3 mục...` and three-step-marker assertions, then replace them with:

```tsx
expect(screen.queryAllByTestId('chapter-step')).toHaveLength(0);
expect(document.querySelector('.syn-learning-top-nav__breadcrumb-separator')).toBeVisible();
expect(screen.getByLabelText('Chọn chương')).toBeVisible();
expect(screen.getByLabelText('Chọn bài học hoặc đánh giá')).toBeVisible();
```

Add to the primary `LearningWorkspacePage.test.tsx` case:

```tsx
expect(screen.getByLabelText('Hồ sơ người học')).toHaveTextContent('N');
expect(screen.getByTestId('app-header-divider')).toBeVisible();
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  packages/ui/src/components/app-header/app-header.test.tsx \
  apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: FAIL because the divider/profile do not exist and chapter step markers still render.

- [ ] **Step 4: Add the explicit AppHeader divider**

Update `AppHeader` return anatomy to:

```tsx
<header className="syn-app-header">
  <div className="syn-app-header__brand">
    <span className="syn-app-header__mark" aria-hidden="true">
      <BrainCircuit size={20} />
    </span>
    <strong>Synaploom</strong>
  </div>
  <span
    className="syn-app-header__divider"
    data-testid="app-header-divider"
    aria-hidden="true"
  />
  <div className="syn-app-header__context">
    {navigation ?? (
      <>
        {courseTitle ? <span>{courseTitle}</span> : null}
        {lessonPosition && lessonCount ? (
          <span className="syn-app-header__position">
            Bài {lessonPosition}/{lessonCount}
          </span>
        ) : null}
      </>
    )}
  </div>
  <div className="syn-app-header__trailing">{trailing}</div>
</header>
```

- [ ] **Step 5: Convert LearningTopNavigation to breadcrumb selectors**

Reuse the existing `ChevronRight` import and remove the visible `syn-learning-top-nav__steps` block. Place this element between the two labels:

```tsx
<ChevronRight
  className="syn-learning-top-nav__breadcrumb-separator"
  aria-hidden="true"
  size={16}
/>
```

Use this top-level structure:

```tsx
<nav className="syn-learning-top-nav" aria-label="Điều hướng khóa học">
  <label className="syn-learning-top-nav__selector syn-learning-top-nav__selector--chapter">
    {/* existing chapter label/select */}
  </label>
  <ChevronRight
    className="syn-learning-top-nav__breadcrumb-separator"
    aria-hidden="true"
    size={16}
  />
  <label className="syn-learning-top-nav__selector syn-learning-top-nav__selector--item">
    {/* existing item label/select */}
  </label>
  <div className="syn-learning-top-nav__actions">{/* existing controls */}</div>
  {/* existing curriculum popover */}
</nav>
```

Keep `completed` and `chapterCompleted` only where still needed by the curriculum popover; remove unused step-marker calculations after TypeScript reports them.

- [ ] **Step 6: Add the profile surface without replacing Local status**

Change the `AppHeader` trailing prop in `LearningWorkspacePage.tsx` to:

```tsx
trailing={
  <div className="syn-learning-header-trailing">
    <StatusBadge status="passed">Local</StatusBadge>
    <span className="syn-learning-profile" aria-label="Hồ sơ người học">
      N
    </span>
  </div>
}
```

- [ ] **Step 7: Replace Header/navigation CSS with one authoritative rule set**

In `packages/ui/src/styles.css`, make the shared Header grid:

```css
.syn-app-header {
  display: grid;
  grid-template-columns: auto 1px minmax(0, 1fr) auto;
  align-items: center;
  min-height: var(--syn-header-height);
  padding: 0 1.75rem;
  border-bottom: 1px solid var(--syn-color-border);
  background: rgb(255 255 255 / 0.96);
  backdrop-filter: blur(12px);
}

.syn-app-header__divider {
  align-self: stretch;
  width: 1px;
  margin-block: 0.8rem;
  background: var(--syn-color-border);
}

.syn-app-header__context {
  justify-content: flex-start;
  padding-inline: 1.25rem;
}
```

In `apps/web/src/application.css`, replace the existing base navigation layout with:

```css
.syn-learning-top-nav {
  position: relative;
  display: grid;
  grid-template-columns: minmax(11rem, 1fr) auto minmax(14rem, 1.25fr) auto;
  align-items: center;
  width: min(62rem, 100%);
  gap: 0.7rem;
}

.syn-learning-top-nav__breadcrumb-separator {
  color: var(--syn-color-text-muted);
}

.syn-learning-header-trailing {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.syn-learning-profile {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  color: var(--syn-color-text);
  background: var(--syn-color-surface-muted);
  font-size: 0.78rem;
  font-weight: 700;
}
```

Delete the obsolete `.syn-learning-top-nav__steps` and `.syn-learning-top-nav__step*` declarations instead of overriding them later.

- [ ] **Step 8: Add canonical header geometry assertions**

After canonical setup in Playwright:

```ts
const headerBox = await page.locator('.syn-app-header').boundingBox();
const brandBox = await page.locator('.syn-app-header__brand').boundingBox();
const dividerBox = await page.getByTestId('app-header-divider').boundingBox();
const profileBox = await page.getByLabel('Hồ sơ người học').boundingBox();
expect(headerBox).not.toBeNull();
expect(brandBox).not.toBeNull();
expect(dividerBox).not.toBeNull();
expect(profileBox).not.toBeNull();
expect(headerBox!.height).toBeGreaterThanOrEqual(56);
expect(headerBox!.height).toBeLessThanOrEqual(64);
expect(dividerBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width);
expect(profileBox!.x + profileBox!.width).toBeLessThanOrEqual(1672 - 24);
```

- [ ] **Step 9: Verify and commit**

Run:

```bash
pnpm exec vitest run --project dom \
  packages/ui/src/components/app-header/app-header.test.tsx \
  apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm lint
pnpm typecheck
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Commit:

```bash
git add packages/ui/src/components/app-header \
  packages/ui/src/styles.css \
  apps/web/src/features/learning-progress/LearningTopNavigation.tsx \
  apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: align learning header with approved mockup"
```

---

### Task 3: Correct first-load workspace proportions and Navigator gutter

**Files:**

- Modify: `internal/workspacepresentation/model.go`
- Modify: `internal/workspacepresentation/service_test.go`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.tsx`
- Modify: `packages/ui/src/components/workspace-shell/workspace-shell.test.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `workspacepresentation.DefaultSplitRatio == 0.54`.
- Produces: `WorkspaceShell` fallback `defaultLessonRatio == 0.54`.
- Preserves: persisted ratios and `clampWorkspaceRatio` range `32–68`.
- Produces: `12–24px` visible gutter between Practice and permanent Navigator.

- [ ] **Step 1: Write RED Go and UI tests**

Add to `internal/workspacepresentation/service_test.go`:

```go
func TestDefaultSplitRatioMatchesRevisionThreeDesktopContract(t *testing.T) {
	if DefaultSplitRatio != 0.54 {
		t.Fatalf("DefaultSplitRatio = %v, want 0.54", DefaultSplitRatio)
	}
}
```

Change the fallback-ratio UI test render to omit `defaultLessonRatio` and assert:

```tsx
expect(groupProps?.defaultLayout).toEqual({
  [lessonPanelId]: 54,
  [practicePanelId]: 46,
});
```

- [ ] **Step 2: Add RED canonical geometry assertions**

Use the canonical viewport width instead of hard-coded `1600`:

```ts
const viewportWidth = 1672;
const practiceNavigatorGap = navigatorBox!.x - (practiceBox!.x + practiceBox!.width);
expect(theoryBox!.width / viewportWidth).toBeGreaterThanOrEqual(0.45);
expect(theoryBox!.width / viewportWidth).toBeLessThanOrEqual(0.47);
expect(practiceBox!.width / viewportWidth).toBeGreaterThanOrEqual(0.36);
expect(practiceBox!.width / viewportWidth).toBeLessThanOrEqual(0.40);
expect(navigatorBox!.width).toBeGreaterThanOrEqual(216);
expect(navigatorBox!.width).toBeLessThanOrEqual(232);
expect(practiceNavigatorGap).toBeGreaterThanOrEqual(12);
expect(practiceNavigatorGap).toBeLessThanOrEqual(24);
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm exec vitest run --project dom packages/ui/src/components/workspace-shell/workspace-shell.test.tsx
bash scripts/go/with-internal-toolchain.sh test ./internal/workspacepresentation
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: unit tests fail on `0.52/0.48`; browser test fails because no explicit Practice–Navigator gutter exists.

- [ ] **Step 4: Change only the new-workspace defaults**

In Go:

```go
const DefaultSplitRatio = 0.54
```

In `WorkspaceShell`:

```tsx
export function WorkspaceShell({
  defaultLessonRatio = 0.54,
  lesson,
  navigator,
  navigatorWidth = 224,
  onLessonSizeChange,
  practice,
}: WorkspaceShellProps): ReactNode {
```

Do not change `MIN_RATIO`, `MAX_RATIO`, schema limits, or persistence payloads.

- [ ] **Step 5: Implement the sibling gutter at the owning frame**

Update the shared shell rules in place:

```css
.syn-workspace-frame {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  gap: 1rem;
  overflow: hidden;
  background: var(--syn-color-workspace-canvas);
}

.syn-workspace-frame__navigator {
  flex: 0 0 auto;
  min-width: 11rem;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--syn-color-border);
  border-radius: 0.75rem 0 0 0.75rem;
  background: var(--syn-color-workspace-panel);
}
```

Keep the `@media (min-width: 1440px)` Navigator width rule at `224px` equivalent; remove the later `clamp(13.5rem, 14vw, 15rem) !important` declaration because it conflicts with the component-owned width.

- [ ] **Step 6: Verify persisted ratios remain authoritative**

Keep the existing UI callback assertion:

```tsx
groupProps?.onLayoutChanged?.({
  [lessonPanelId]: 60,
  [practicePanelId]: 40,
});
expect(onLessonSizeChange).toHaveBeenCalledWith(0.6);
```

Run:

```bash
pnpm exec vitest run --project dom packages/ui/src/components/workspace-shell/workspace-shell.test.tsx
bash scripts/go/with-internal-toolchain.sh test ./internal/workspacepresentation
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/workspacepresentation/model.go \
  internal/workspacepresentation/service_test.go \
  packages/ui/src/components/workspace-shell/workspace-shell.tsx \
  packages/ui/src/components/workspace-shell/workspace-shell.test.tsx \
  packages/ui/src/styles.css apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: correct revision three workspace proportions"
```

---

### Task 4: Expand Theory measure and compact the vertical rhythm

**Files:**

- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivityTray.tsx`
- Modify: `apps/web/src/features/learning-workspace/ActivityTray.test.tsx`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: Theory article fills its pane with mockup-aligned horizontal padding.
- Produces: both activity summaries visible before the note at canonical viewport.
- Produces: progress card height `≤ 92px` and activity summary height `84–104px`.
- Preserves: authored order supplied by `LessonActivities`; renderer does not reorder arbitrary blocks.

- [ ] **Step 1: Add RED semantic and geometry assertions**

In `LearningWorkspacePage.test.tsx`, retain `data-theory-reading-column` and add:

```tsx
expect(document.querySelectorAll('[data-activity-summary-card]')).toHaveLength(0);
```

This fixture has no activities and protects against page-level synthetic summaries.

In `ActivitySummaryCard.test.tsx`, add inactive-state coverage:

```tsx
it('renders an unopened inactive activity as a compact summary', () => {
  render(
    <ActivitySummaryCard
      item={item}
      focused={false}
      paneMode="split"
      status={null}
      onOpenPractice={vi.fn(() => Promise.resolve())}
    />,
  );

  expect(screen.getByText('Chưa mở')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Thực hành bài này' })).toBeVisible();
});
```

Add Playwright geometry:

```ts
const theoryArticle = page.locator('[data-theory-reading-column]');
const progressCard = page.locator('[data-lesson-progress-card]');
const summaries = page.locator('[data-activity-summary-card]');
const [articleBox, progressBox, firstSummaryBox, secondSummaryBox] = await Promise.all([
  theoryArticle.boundingBox(),
  progressCard.boundingBox(),
  summaries.nth(0).boundingBox(),
  summaries.nth(1).boundingBox(),
]);
expect(articleBox).not.toBeNull();
expect(progressBox).not.toBeNull();
expect(firstSummaryBox).not.toBeNull();
expect(secondSummaryBox).not.toBeNull();
expect(articleBox!.x - theoryBox!.x).toBeGreaterThanOrEqual(40);
expect(articleBox!.x - theoryBox!.x).toBeLessThanOrEqual(56);
expect(theoryBox!.x + theoryBox!.width - (articleBox!.x + articleBox!.width)).toBeGreaterThanOrEqual(40);
expect(progressBox!.height).toBeLessThanOrEqual(92);
expect(firstSummaryBox!.height).toBeGreaterThanOrEqual(84);
expect(firstSummaryBox!.height).toBeLessThanOrEqual(104);
expect(secondSummaryBox!.y + secondSummaryBox!.height).toBeLessThanOrEqual(noteBox!.y);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: inactive label test fails with `Chưa bắt đầu`; geometry fails because the article remains narrowly centered.

- [ ] **Step 3: Change the shared AVAILABLE label to `Chưa mở`**

In `ActivityTray.tsx`:

```ts
export function activityStatusLabel(status: ActivityWorkspaceStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Chưa mở';
    case 'DRAFT':
      return 'Bản nháp';
    case 'IN_PROGRESS':
      return 'Đang chấm';
    case 'PASSED':
      return 'Đã đạt';
    case 'FAILED':
      return 'Chưa đạt';
  }
}
```

Update the existing `ActivityTray.test.tsx` expectation in the same RED/GREEN cycle:

```tsx
expect(screen.getByText('Chưa mở')).toBeVisible();
```

- [ ] **Step 4: Consolidate Theory and summary CSS in place**

Replace the final effective Theory block with:

```css
.syn-lesson-panel__article {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 1.5rem clamp(2.5rem, 3vw, 3.5rem) 2rem;
}

.syn-lesson-panel__heading {
  gap: 1.25rem;
  margin-bottom: 1rem;
}

.syn-lesson-panel__heading h1 {
  margin-top: 0.45rem;
  font-size: clamp(1.9rem, 2.3vw, 2.4rem);
}

.syn-lesson-panel__article > .syn-prose {
  font-size: 0.94rem;
  line-height: 1.55;
}

.syn-lesson-panel__article > .syn-prose h2,
.syn-lesson-panel__article > .syn-prose h3,
.syn-lesson-panel__article > .syn-prose h4 {
  margin-block: 1rem 0.4rem;
}

.syn-lesson-panel__article > .syn-prose p,
.syn-lesson-panel__article > .syn-prose ul,
.syn-lesson-panel__article > .syn-prose ol {
  margin-bottom: 0.55rem;
}

.syn-lesson-panel__article .syn-activity-embed,
.syn-lesson-panel__article .syn-lesson-activities {
  margin-block: 0.7rem;
}

.syn-learning-progress-summary {
  min-width: 13.5rem;
  max-width: 14rem;
  gap: 0.4rem;
  padding: 0.7rem 0.85rem;
}

.syn-activity-summary {
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  min-height: 5.5rem;
  padding: 0.9rem 1rem;
  border-radius: 0.7rem;
}
```

Delete the earlier Revision 2.1 and Revision 2.2 declarations for these same selectors, retaining only responsive overrides that materially differ.

- [ ] **Step 5: Verify canonical Theory and compact/mobile regressions**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx \
  apps/web/src/features/lesson-content/LessonActivities.test.tsx
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: PASS, including the later compact/mobile states in the same browser test.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/features/learning-workspace/ActivitySummaryCard.test.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.tsx \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: align theory density with approved mockup"
```

---

### Task 5: Flatten Practice into one surface and render an observed draft-save time

**Files:**

- Modify: `apps/web/src/features/learning-workspace/PracticePane.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticePane.test.tsx`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `formatDraftSavedTime(value: Date): string` using `Asia/Ho_Chi_Minh`.
- Produces: footer label `Đã lưu bản nháp lúc 14:32` only after status transitions into `DRAFT` during the current mounted activity session.
- Preserves: generic `Đã lưu bản nháp` for a pre-existing draft without an observed local save time.
- Preserves: retry and next-activity behavior.

- [ ] **Step 1: Write RED PracticePane tests**

Update the existing primary test so a passed status still permits `Hoạt động tiếp theo`, but add this new test:

```tsx
it('shows a deterministic local save time when the focused status transitions into DRAFT', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T07:32:00Z'));

  const controller = {
    focusedActivity: activities[0],
    state: { paneMode: 'split' },
    saveStatus: 'idle',
    error: null,
    selectNextActivity: vi.fn(() => Promise.resolve()),
    retryLastSave: vi.fn(() => Promise.resolve()),
    registerPersistenceHandle: vi.fn(),
    registerPracticeHeading: vi.fn(),
    registerInlineHeading: vi.fn(),
    collapsePracticePane: vi.fn(),
    expandPracticePane: vi.fn(),
    focusActivity: vi.fn(() => Promise.resolve()),
  } as unknown as LearningWorkspaceController;

  const view = render(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[]}
      controller={controller}
      onProgressChanged={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );

  expect(screen.getByTestId('practice-footer-status')).toHaveTextContent('Sẵn sàng');

  view.rerender(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[
        {
          activityId: 'Quiz',
          status: 'DRAFT',
          attemptNumber: 1,
          score: null,
          maxScore: null,
          passed: null,
        },
      ]}
      controller={controller}
      onProgressChanged={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );

  expect(screen.getByTestId('practice-footer-status')).toHaveTextContent(
    'Đã lưu bản nháp lúc 14:32',
  );
  vi.useRealTimers();
});
```

Add a structure assertion:

```tsx
expect(screen.getByTestId('practice-workspace-content').children).toHaveLength(1);
expect(screen.getByTestId('practice-workspace-content').firstElementChild).toHaveClass(
  'syn-practice-pane__body',
);
```

- [ ] **Step 2: Run Practice tests and verify RED**

Run:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-workspace/PracticePane.test.tsx
```

Expected: FAIL because no draft transition timestamp is recorded.

- [ ] **Step 3: Add the formatter and transition observer before the conditional return**

Update imports to include `useEffect` and `useRef`, then add:

```tsx
export function formatDraftSavedTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}
```

Inside `PracticePane`, before `if (!focused) return null`:

```tsx
const focused = controller.focusedActivity;
const focusedId = focused?.activity.id ?? null;
const status = focusedId ? findActivityStatus(statuses, focusedId) : null;
const previousStatusRef = useRef(status?.status);
const previousFocusedIdRef = useRef(focusedId);
const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

useEffect(() => {
  if (previousFocusedIdRef.current !== focusedId) {
    previousFocusedIdRef.current = focusedId;
    previousStatusRef.current = status?.status;
    setLastSavedAt(null);
    return;
  }

  if (status?.status === 'DRAFT' && previousStatusRef.current !== 'DRAFT') {
    setLastSavedAt(new Date());
  }
  previousStatusRef.current = status?.status;
}, [focusedId, status?.status]);

if (!focused) return null;
```

Remove the later duplicate `focused` and `status` declarations.

- [ ] **Step 4: Render the footer status with explicit priority**

Replace the normal footer `<span>` with:

```tsx
<span>
  {lastSavedAt
    ? `Đã lưu bản nháp lúc ${formatDraftSavedTime(lastSavedAt)}`
    : status?.status === 'DRAFT' || controller.saveStatus === 'saved'
      ? 'Đã lưu bản nháp'
      : 'Sẵn sàng'}
</span>
```

Keep the error/conflict branch unchanged.

- [ ] **Step 5: Flatten the Practice visual surface**

Consolidate these selectors in `application.css`:

```css
.syn-practice-pane {
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0.75rem 0;
  border: 0;
  background: var(--syn-color-workspace-canvas);
}

.syn-practice-workspace-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--syn-color-primary) 45%, var(--syn-color-border));
  border-radius: 0.75rem;
  background: var(--syn-color-workspace-panel);
  box-shadow: none;
}

.syn-practice-workspace-card__content {
  min-height: 0;
  overflow: auto;
  padding: 1.75rem 1.5rem;
  background: var(--syn-color-workspace-panel);
}

.syn-practice-pane__body {
  min-height: 0;
  height: auto;
}

.syn-practice-workspace-card__header {
  min-height: 8.5rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--syn-color-border);
}

.syn-practice-workspace-card__footer {
  min-height: 5rem;
  padding: 0.9rem 1.5rem;
  border-top: 1px solid var(--syn-color-border);
  background: var(--syn-color-workspace-panel);
}
```

Delete the superseded rule that sets `.syn-practice-workspace-card__content` to `var(--syn-color-workspace-subtle)` and any earlier nested-card styling for `.syn-activity-renderer` inside the contained Practice surface. Also delete the wide breakpoint rule below so the approved `Danh sách hoạt động` control remains visible at `1672px`:

```css
@media (min-width: 1440px) {
  .syn-practice-workspace-card__controls > button:first-child {
    display: none;
  }
}
```

- [ ] **Step 6: Add one-surface browser assertions**

```ts
await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
await expect(page.getByTestId('practice-workspace-content')).toHaveCSS(
  'background-color',
  'rgb(255, 255, 255)',
);
await expect(page.getByTestId('practice-footer-status')).toContainText(
  'Đã lưu bản nháp lúc 14:32',
);
await expect(page.getByRole('button', { name: 'Hoạt động tiếp theo' })).toHaveCount(0);
await expect(page.getByRole('button', { name: 'Danh sách hoạt động' })).toBeVisible();
```

Use the actual computed white token value if the browser resolves the token differently; do not loosen the assertion to a generic visibility check.

- [ ] **Step 7: Verify and commit**

Run:

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/features/learning-workspace/LearningWorkspaceShell.test.tsx
pnpm lint
pnpm typecheck
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Commit:

```bash
git add apps/web/src/features/learning-workspace/PracticePane.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: flatten practice workspace surface"
```

---

### Task 6: Add ordering instruction and six-dot affordance

**Files:**

- Modify: `apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx`
- Modify: `apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `[data-ordering-drag-handle]` on every ordering row.
- Produces: visible supporting copy `Kéo và thả để sắp xếp theo trình tự đúng.`.
- Preserves: move-up/move-down button behavior and live-region announcement.
- Does not produce: pointer drag event handlers.

- [ ] **Step 1: Add RED renderer tests**

Extend `OrderingActivity.test.tsx`:

```tsx
it('renders a visual drag affordance while preserving keyboard move controls', () => {
  render(<RendererHarness Renderer={OrderingActivity} activity={activity} />);

  expect(screen.getByText('Kéo và thả để sắp xếp theo trình tự đúng.')).toBeVisible();
  expect(document.querySelectorAll('[data-ordering-drag-handle]')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Di chuyển First xuống' })).toBeEnabled();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx
```

Expected: FAIL because supporting copy and handles do not exist.

- [ ] **Step 3: Add the affordance without changing interaction semantics**

Import `GripVertical` from `lucide-react`, then render:

```tsx
<div className="syn-activity-renderer">
  <p className="syn-activity-ordering__instruction">
    Kéo và thả để sắp xếp theo trình tự đúng.
  </p>
  <ol className="syn-activity-ordering">
    {itemIds.map((id, index) => {
      const label = optionById(config.items, id)?.label ?? id;
      return (
        <li key={id}>
          <span
            className="syn-activity-ordering__drag-handle"
            data-ordering-drag-handle
            aria-hidden="true"
          >
            <GripVertical size={18} />
          </span>
          <span className="syn-activity-ordering__label">{label}</span>
          <span className="syn-activity-ordering__actions">
            {/* existing up/down buttons unchanged */}
          </span>
        </li>
      );
    })}
  </ol>
  {/* existing live region and ActivityActions unchanged */}
</div>
```

- [ ] **Step 4: Consolidate ordering geometry**

Replace the final ordering rules with:

```css
.syn-activity-ordering__instruction {
  margin: 0 0 1rem;
  color: var(--syn-color-text-muted);
  font-size: 0.82rem;
}

.syn-activity-ordering {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.syn-activity-ordering li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  min-height: 5.15rem;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--syn-color-border);
  border-radius: 0.7rem;
  background: var(--syn-color-workspace-panel);
}

.syn-activity-ordering__drag-handle {
  display: inline-grid;
  place-items: center;
  color: var(--syn-color-text-muted);
}

.syn-activity-ordering__label {
  min-width: 0;
}

.syn-activity-ordering__actions {
  display: flex;
  gap: 0.5rem;
}

.syn-activity-ordering__actions button {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--syn-color-border);
  border-radius: 0.55rem;
  background: var(--syn-color-workspace-panel);
}
```

Delete older declarations for `.syn-activity-ordering li`, buttons, and action gaps that conflict with this block.

- [ ] **Step 5: Add browser row geometry assertions**

```ts
const orderingRows = page.locator('.syn-activity-ordering > li');
const firstRowBox = await orderingRows.nth(0).boundingBox();
const secondRowBox = await orderingRows.nth(1).boundingBox();
expect(firstRowBox).not.toBeNull();
expect(secondRowBox).not.toBeNull();
expect(firstRowBox!.height).toBeGreaterThanOrEqual(78);
expect(firstRowBox!.height).toBeLessThanOrEqual(88);
expect(secondRowBox!.y - (firstRowBox!.y + firstRowBox!.height)).toBeGreaterThanOrEqual(10);
expect(page.locator('[data-ordering-drag-handle]')).toHaveCount(3);
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm exec vitest run --project dom apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx
pnpm test:activity-engine
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
git add apps/web/src/features/activity-engine/renderers/OrderingActivity.tsx \
  apps/web/src/features/activity-engine/renderers/OrderingActivity.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: add ordering drag affordance"
```

---

### Task 7: Align Navigator state mapping and item anatomy

**Files:**

- Test: `apps/web/src/features/learning-workspace/ActivityTray.test.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.tsx`
- Modify: `apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- Produces: `activityNavigatorStatusLabel(status: ActivityWorkspaceStatus, active: boolean): string`.
- Mapping: active non-passed activity → `Đang làm`; inactive AVAILABLE → `Chưa mở`; PASSED → `Đã đạt`; FAILED → `Chưa đạt`; inactive DRAFT → `Bản nháp`; IN_PROGRESS → `Đang chấm`.
- Produces: `[data-navigator-header-chevron]`.
- Preserves: save-before-switch and drawer close-after-success behavior.

- [ ] **Step 1: Add RED mapping tests**

Add to `PracticeActivityNavigator.test.tsx`:

```tsx
it('presents the canonical focused and unopened labels', () => {
  render(
    <PracticeActivityNavigator
      activities={activities}
      statuses={[]}
      focusedActivityId="A"
      onSelectActivity={vi.fn(() => Promise.resolve())}
    />,
  );

  expect(screen.getByRole('button', { name: /1\. A\. Đang làm/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  expect(screen.getByRole('button', { name: /2\. B\. Chưa mở/ })).toBeVisible();
  expect(document.querySelector('[data-navigator-header-chevron]')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx \
  apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx
```

Expected: FAIL because active AVAILABLE renders `Chưa mở` and no header chevron exists.

- [ ] **Step 3: Add the active-aware mapping**

In `PracticeActivityNavigator.tsx`:

```ts
export function activityNavigatorStatusLabel(
  status: ActivityWorkspaceStatus,
  active: boolean,
): string {
  if (active && status !== 'PASSED' && status !== 'FAILED') return 'Đang làm';
  return activityStatusLabel(status);
}
```

Import `ActivityWorkspaceStatus` and `ChevronRight`, then use:

```tsx
const workspaceStatus = status?.status ?? 'AVAILABLE';
const label = activityNavigatorStatusLabel(workspaceStatus, active);
```

Render the header:

```tsx
<header className="syn-practice-activity-navigator__header">
  <strong>Thực hành · {activities.length} hoạt động</strong>
  <ChevronRight data-navigator-header-chevron aria-hidden="true" size={16} />
</header>
```

Keep `data-status={workspaceStatus}` so color remains tied to persisted status rather than the presentation label.

- [ ] **Step 4: Consolidate Navigator CSS**

Use one final block:

```css
.syn-practice-activity-navigator {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  height: 100%;
  padding: 1rem 0.75rem;
}

.syn-practice-activity-navigator__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.25rem 0.85rem;
  font-size: 0.84rem;
}

.syn-practice-activity-navigator__list {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.syn-practice-activity-navigator__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  width: 100%;
  min-height: 4.5rem;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid var(--syn-color-border);
  border-radius: 0.7rem;
  background: var(--syn-color-workspace-panel);
  text-align: left;
}

.syn-practice-activity-navigator__item[aria-current='true'] {
  border-color: color-mix(in srgb, var(--syn-color-primary) 40%, var(--syn-color-border));
  background: var(--syn-color-workspace-active);
  box-shadow: none;
}

.syn-practice-activity-navigator__guidance {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: auto 0.25rem 0;
  padding-top: 0.75rem;
  border-top: 0;
  color: var(--syn-color-text-muted);
}
```

Delete the earlier active inset bar and duplicate Navigator blocks.

- [ ] **Step 5: Add canonical browser-state assertions**

```ts
const navigator = page.getByRole('navigation', { name: 'Danh sách hoạt động' });
await expect(navigator.getByRole('button', { name: /1\. Sắp xếp thuật toán\. Đang làm/ })).toHaveAttribute(
  'aria-current',
  'true',
);
await expect(navigator.getByRole('button', { name: /2\. Viết chương trình tính tổng\. Chưa mở/ })).toBeVisible();
await expect(navigator.locator('[data-navigator-header-chevron]')).toBeVisible();
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/learning-workspace/ActivityTray.test.tsx \
  apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx \
  apps/web/src/features/learning-workspace/PracticePane.test.tsx
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
git add apps/web/src/features/learning-workspace/PracticeActivityNavigator.tsx \
  apps/web/src/features/learning-workspace/PracticeActivityNavigator.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: align activity navigator states"
```

---

### Task 8: Convert the assistant to a centered one-row lesson dock

**Files:**

- Modify: `packages/ui/src/components/assistant-dock/assistant-dock.tsx`
- Modify: `packages/ui/src/components/assistant-dock/assistant-dock.test.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/application.css`
- Test: `tests/e2e/single-active-workspace-go-runtime.spec.ts`

**Interfaces:**

- `AssistantDockProps.contextLabel` remains accepted but becomes an accessible description rather than a visible second line.
- Visible placeholder is always `Đặt câu hỏi về bài học này…`.
- `AssistantPanel` request payload still starts with `Hoạt động: <title>` when an activity is focused.
- Produces: centered desktop width `70–76%` of viewport and height `56–64px`.

- [ ] **Step 1: Write RED UI and integration tests**

Update `assistant-dock.test.tsx`:

```tsx
expect(screen.queryByText('Hoạt động: Sắp xếp thuật toán')).not.toBeInTheDocument();
expect(screen.getByRole('complementary', { name: 'Trợ lý AI' })).toHaveAttribute(
  'aria-description',
  'Hoạt động: Sắp xếp thuật toán',
);
```

Replace the existing activity-context test in `AssistantPanel.test.tsx` with this API-spy test, and update the lesson-only test to assert the same lesson-level placeholder without visible context text:

```tsx
it('keeps activity context in the request while showing lesson-level copy', async () => {
  const requestAi = vi.fn(() =>
    Promise.resolve({ status: 'disabled' as const, message: 'AI disabled' }),
  );
  const api = { requestAi } as unknown as SynaploomApiClient;

  render(
    <AppProviders api={api}>
      <AssistantPanel lessonTitle="Dòng chảy thuật toán" activityTitle="Sắp xếp thuật toán" />
    </AppProviders>,
  );

  const input = screen.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' });
  expect(input).toHaveAttribute('placeholder', 'Đặt câu hỏi về bài học này…');
  expect(screen.queryByText('Hoạt động: Sắp xếp thuật toán')).not.toBeInTheDocument();

  fireEvent.change(input, { target: { value: 'Giải thích bước này' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));

  await waitFor(() =>
    expect(requestAi).toHaveBeenCalledWith({
      kind: 'explain',
      prompt: 'Hoạt động: Sắp xếp thuật toán. Giải thích bước này',
    }),
  );
});
```

Add `fireEvent`, `vi`, and `waitFor` imports.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec vitest run --project dom \
  packages/ui/src/components/assistant-dock/assistant-dock.test.tsx \
  apps/web/src/features/ai-assistant/AssistantPanel.test.tsx
```

Expected: FAIL because context is visible and activity-specific placeholder remains.

- [ ] **Step 3: Keep context accessible but not visible**

Change the dock root and identity:

```tsx
<aside
  className="syn-assistant-dock"
  aria-label="Trợ lý AI"
  {...(contextLabel ? { 'aria-description': contextLabel } : {})}
>
  <div className="syn-assistant-dock__identity">
    <div className="syn-assistant-dock__title">
      <Sparkles aria-hidden="true" size={17} />
      <strong>Trợ lý AI</strong>
    </div>
  </div>
  {/* prompt and modes unchanged */}
</aside>
```

Remove `.syn-assistant-dock__context` markup.

Set the send button variant explicitly:

```tsx
<Button
  aria-label="Gửi câu hỏi"
  className="syn-assistant-dock__send"
  disabled={disabled || trimmedPrompt.length === 0}
  size="sm"
  type="submit"
  variant="ghost"
>
```

- [ ] **Step 4: Keep activity data flow and force lesson-level visible copy**

In `AssistantPanel.tsx`:

```tsx
<AssistantDock
  contextLabel={context}
  {...(message === undefined ? {} : { message })}
  onRequest={(mode) => void request(mode)}
  onSubmit={(prompt) => void request('explain', prompt)}
  placeholder="Đặt câu hỏi về bài học này…"
/>
```

Do not change the `context` string or `request()` prompt composition.

- [ ] **Step 5: Consolidate dock geometry**

In shared styles:

```css
.syn-assistant-dock {
  display: grid;
  grid-template-columns: auto minmax(14rem, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
  min-height: 3.5rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--syn-color-border);
  border-radius: 0.75rem;
  background: var(--syn-color-surface);
}

.syn-assistant-dock__identity {
  display: flex;
  align-items: center;
}

.syn-assistant-dock__send {
  position: absolute;
  right: 0.25rem;
  display: grid;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  border-radius: 0.55rem;
  color: var(--syn-color-text-muted);
  background: var(--syn-color-surface-muted);
}
```

Delete `.syn-assistant-dock__context` rules.

In application styles:

```css
.syn-learning-workspace-layout {
  grid-template-rows: minmax(0, 1fr) 5rem;
}

.syn-learning-workspace-layout__assistant {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 5rem;
  padding: 0.5rem 1rem 0.65rem;
  background: var(--syn-color-workspace-canvas);
}

.syn-assistant-context {
  width: min(73vw, 76rem);
  min-width: 0;
}

.syn-assistant-context .syn-assistant-dock {
  height: 3.75rem;
  box-shadow: none;
}
```

Keep compact/mobile overrides scoped under their existing breakpoints; do not force `73vw` below `960px`.

- [ ] **Step 6: Add canonical dock geometry assertions**

```ts
const assistantDockBox = await page.getByRole('complementary', { name: 'Trợ lý AI' }).boundingBox();
expect(assistantDockBox).not.toBeNull();
expect(assistantDockBox!.width / 1672).toBeGreaterThanOrEqual(0.70);
expect(assistantDockBox!.width / 1672).toBeLessThanOrEqual(0.76);
expect(Math.abs(assistantDockBox!.x - (1672 - assistantDockBox!.width) / 2)).toBeLessThanOrEqual(3);
expect(assistantDockBox!.height).toBeGreaterThanOrEqual(56);
expect(assistantDockBox!.height).toBeLessThanOrEqual(64);
await expect(page.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' })).toHaveAttribute(
  'placeholder',
  'Đặt câu hỏi về bài học này…',
);
```

Use role `complementary` for the inner `<aside>` and role `region` only for the outer `AssistantPanel` section.

- [ ] **Step 7: Verify and commit**

```bash
pnpm exec vitest run --project dom \
  packages/ui/src/components/assistant-dock/assistant-dock.test.tsx \
  apps/web/src/features/ai-assistant/AssistantPanel.test.tsx
pnpm lint
pnpm typecheck
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
git add packages/ui/src/components/assistant-dock \
  packages/ui/src/styles.css \
  apps/web/src/features/ai-assistant/AssistantPanel.tsx \
  apps/web/src/features/ai-assistant/AssistantPanel.test.tsx \
  apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts
git commit -m "style: center the lesson assistant dock"
```

---

### Task 9: Enforce the approved mockup, refresh responsive baselines, and record evidence

**Files:**

- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts`
- Create: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-ordering-approved-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-ordering-wide-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-coding-wide-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-collapsed-wide-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-navigator-1366-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-compact-go-runtime-linux.png`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-mobile-go-runtime-linux.png`
- Create: `docs/verification/single-active-workspace-revision-three.md`
- Modify: `apps/web/src/application.css`

**Interfaces:**

- Produces: immutable approved snapshot named `single-active-ordering-approved.png` with `maxDiffPixelRatio: 0.10`.
- Produces: reviewed runtime regression baselines for six non-approved states.
- Produces: verification evidence with command outputs and final commit hash.

- [ ] **Step 1: Copy the immutable approved mockup into Playwright snapshot naming**

Run exactly:

```bash
cp docs/superpowers/specs/assets/2026-07-20-single-active-workspace-approved.png \
  tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-ordering-approved-go-runtime-linux.png
```

Do not use `--update-snapshots` to create or replace this file.

- [ ] **Step 2: Add the final approved-mockup assertion**

Immediately after canonical state and all canonical geometry assertions:

```ts
await expect(page).toHaveScreenshot('single-active-ordering-approved.png', {
  fullPage: true,
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: 0.1,
});
```

Keep the existing runtime baseline separately:

```ts
await expect(page).toHaveScreenshot('single-active-ordering-wide.png', {
  fullPage: true,
  animations: 'disabled',
  caret: 'hide',
});
```

- [ ] **Step 3: Run the approved comparison and verify RED if fidelity is below 90%**

```bash
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected before final tuning: either PASS, or FAIL reporting a pixel-diff ratio above `0.10`. Do not update the approved snapshot to make this pass.

- [ ] **Step 4: Perform bounded final tuning in existing authoritative CSS blocks**

Use Playwright diff output to adjust only these existing owners:

```text
Header/navigation:  packages/ui/src/styles.css + application.css navigation block
Workspace geometry: packages/ui/src/styles.css workspace block
Theory:             application.css Theory/summary block
Practice/ordering:  application.css Practice/ordering block
Navigator:          application.css Navigator block
Assistant:          packages/ui/src/styles.css + application.css assistant block
```

For every adjustment:

```bash
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: approved comparison reaches `maxDiffPixelRatio <= 0.10` without weakening the threshold.

- [ ] **Step 5: Audit CSS ownership before regenerating runtime snapshots**

Run:

```bash
rg -n "^\.syn-(lesson-panel__article|activity-summary|practice-pane|practice-workspace-card|practice-activity-navigator|assistant-context)" \
  apps/web/src/application.css
rg -n "^\.syn-(app-header|assistant-dock|workspace-frame|workspace-shell)" \
  packages/ui/src/styles.css
```

Expected review result:

- one base authoritative block per selector family;
- additional occurrences only inside intentional media queries or pseudo/state selectors;
- no `Revision 2.1` or `Revision 2.2` catch-all blocks remain for the affected families;
- no `!important` remains on permanent Navigator width.

Remove conflicting duplicates and rerun the focused browser test after each deletion.

- [ ] **Step 6: Regenerate only runtime regression snapshots**

Run:

```bash
pnpm test:e2e --project=go-runtime \
  tests/e2e/single-active-workspace-go-runtime.spec.ts \
  --update-snapshots
```

Immediately restore the immutable approved file from Git or source asset so it cannot be replaced by the update command:

```bash
cp docs/superpowers/specs/assets/2026-07-20-single-active-workspace-approved.png \
  tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots/single-active-ordering-approved-go-runtime-linux.png
```

Then rerun without update mode:

```bash
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
```

Expected: approved comparison PASS; all six responsive runtime snapshots PASS.

- [ ] **Step 7: Run complete verification**

Run in this order:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm check:type-strip
pnpm build
pnpm go:verify
pnpm validate:multi-domain
pnpm go:stage-web
pnpm test:e2e --project=go-runtime tests/e2e/single-active-workspace-go-runtime.spec.ts
pnpm test:e2e --project=go-runtime
```

Expected: all commands exit `0`.

- [ ] **Step 8: Write verification evidence**

Create `docs/verification/single-active-workspace-revision-three.md` with this complete structure:

```md
# Single Active Workspace Revision 3 Verification

**Date:** 2026-07-20
**Canonical viewport:** 1672 × 941
**Approved baseline:** `docs/superpowers/specs/assets/2026-07-20-single-active-workspace-approved.png`
**Maximum approved diff ratio:** 0.10

## Canonical state

- Focused activity: Sắp xếp thuật toán
- Activity status: draft saved
- Ordering: read → show → add
- Second activity: unopened
- Pane mode: split
- Navigator: permanent
- Assistant: visible

## Behavioral contracts retained

- One active editor
- Save-before-switch
- Failed-save retry
- Draft persistence
- Split-ratio persistence
- Collapse and restore
- 1366 Navigator drawer
- Compact split
- Mobile Practice dialog
- Coding containment
- Keyboard movement
- Reduced motion

## Verification commands

Record each command from Task 9 Step 7 and its exit status.

## Snapshot inventory

- single-active-ordering-approved
- single-active-ordering-wide
- single-active-coding-wide
- single-active-collapsed-wide
- single-active-navigator-1366
- single-active-compact
- single-active-mobile

## Result

Approved comparison and all runtime regressions pass. The verified implementation commit is recorded by the follow-up evidence commit.
```

Do not claim success until every command in Step 7 exits `0`.

- [ ] **Step 9: Commit the verified implementation and baseline evidence**

```bash
git add apps/web/src/application.css packages/ui/src/styles.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts \
  tests/e2e/single-active-workspace-go-runtime.spec.ts-snapshots \
  docs/verification/single-active-workspace-revision-three.md
git commit -m "test: verify revision three mockup fidelity"
```

- [ ] **Step 10: Record the verified implementation commit in a docs-only commit**

Capture the just-tested implementation commit:

```bash
verified_commit=$(git rev-parse HEAD)
printf '%s\n' "$verified_commit"
```

Insert the captured hash under the verification document metadata and replace the generic Result sentence using this exact command:

```bash
python - "$verified_commit" <<'PY'
from pathlib import Path
import sys

path = Path('docs/verification/single-active-workspace-revision-three.md')
verified_commit = sys.argv[1]
text = path.read_text()
text = text.replace(
    '**Maximum approved diff ratio:** 0.10\n',
    f'**Maximum approved diff ratio:** 0.10\n**Verified implementation commit:** `{verified_commit}`\n',
)
text = text.replace(
    'Approved comparison and all runtime regressions pass. The verified implementation commit is recorded by the follow-up evidence commit.',
    f'Approved comparison and all runtime regressions pass at implementation commit `{verified_commit}`.',
)
path.write_text(text)
PY
```

Commit only that documentation update:

```bash
git add docs/verification/single-active-workspace-revision-three.md
git commit -m "docs: record revision three verification commit"
git status --short
```

Expected: the final `git status --short` prints no output. The recorded hash identifies the code-and-snapshot commit tested in Step 7; the final docs-only commit does not change runtime behavior.
