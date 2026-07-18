# Navigator-First Manual Verification

This checklist verifies the in-pane hierarchical navigator without changing backend contracts.

## Setup

```bash
pnpm install --frozen-lockfile
pnpm go:stage-web
pnpm go:build-preview
```

Start the preview using the project command documented for your platform, then open the canonical lesson URL for the example course.

## Desktop flow

1. Confirm the lesson workspace still has two panes and the coding pane width is unchanged.
2. Confirm the lesson header shows explicit copy such as `Bài 2 trong 3` and `1/3 bài bắt buộc đã hoàn thành`.
3. Confirm `Nội dung khóa học` is collapsed initially.
4. Activate it and confirm `aria-expanded` changes to `true`.
5. Confirm chapters, required lessons, optional lessons, and chapter assessments are visible.
6. Confirm the viewed lesson has a visually distinct current marker and `aria-current="step"`.
7. Open a completed lesson and confirm canonical review navigation occurs.
8. Open an available assessment and confirm the chapter assessment route loads.

## Locked item flow

1. Open `Nội dung khóa học`.
2. Activate a locked lesson or assessment.
3. Confirm the URL does not change.
4. Confirm an inline alert appears with `Mục này chưa thể mở`.
5. Confirm each unsatisfied required blocker is listed in readable Vietnamese.
6. Confirm the locked button remains keyboard-focusable and has `aria-disabled="true"`.

## Review flow

1. Complete or use fixture state for a prior lesson.
2. Open that completed lesson from the navigator.
3. Confirm the review banner is visible.
4. Confirm the navigator marks the viewed lesson separately from `Tiến trình hiện tại`.
5. Use the review banner return action and confirm the persisted current lesson opens.

## Keyboard flow

1. Tab to `Nội dung khóa học` and activate with Enter and Space.
2. Tab through every lesson and assessment.
3. Confirm focus is visible.
4. Activate a locked item and confirm focus remains usable after the alert appears.
5. Close and reopen the drawer; confirm stale blocker feedback is cleared.

## Responsive flow

At viewport widths around 390 px and 768 px:

1. Confirm the drawer stays inside the lesson pane rather than creating a third column.
2. Confirm long chapter and lesson titles wrap without horizontal scrolling.
3. Confirm the practice pane remains accessible below the lesson pane.

## Targeted automated commands

Run these and send the first complete failure output if any command fails:

```bash
pnpm exec vitest run --project dom apps/web/src/features/learning-progress/SynLessonProgress.test.tsx
pnpm exec vitest run --project dom apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
pnpm typecheck
pnpm lint
pnpm build:web
```

For runtime acceptance:

```bash
pnpm go:stage-web
pnpm playwright test --project=go-runtime --headed
```

## Legacy/current lesson entry route

The Go runtime commonly opens the application without a canonical lesson URL. Verify that the
navigator is still available on this entry route:

1. Start Synaploom at its default root URL without a `/courses/.../chapters/.../lessons/...` path.
2. Confirm the lesson page shows the **Nội dung khóa học** button.
3. Open the drawer and select a lesson.
4. Confirm the browser moves to the canonical course/chapter/lesson URL.

If the progress summary appears but the button is absent, inspect the network panel for
`GET /api/courses/<course-id>/navigation`. The request must be sent after the course payload loads.
