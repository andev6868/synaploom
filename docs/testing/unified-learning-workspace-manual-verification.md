# Unified Learning Workspace Manual Verification

This guide verifies the continuous lesson/assessment experience introduced by the unified learning workspace change.

## Preparation

```bash
pnpm install --frozen-lockfile
pnpm build:web
pnpm go:stage-web
```

Stop any older runtime process and start the preview from the current source tree:

```bash
pkill -f synaploom-preview || true
bash scripts/go/with-internal-toolchain.sh run \
  ./cmd/synaploom-preview \
  examples/frontend-performance-foundations
```

Open the new loopback URL printed by the command. Do not reuse a browser tab connected to an older port.

## 1. Forward progression language

1. Open the first lesson in the Runtime chapter.
2. Satisfy its reading/practice requirements.
3. Inspect the requirement footer.

Expected:

- The primary action is visibly styled as a button.
- The button names the real destination, for example `Tiếp tục bài Event Loop`.
- The button never says `Quay lại bài Event Loop` when Event Loop is the current progression target.
- Raw identifiers such as `event-loop-order` are not displayed.

## 2. Review lesson chrome

1. Complete the first lesson and continue to Event Loop.
2. Use top navigation to reopen the completed first lesson.

Expected:

- The status badge says `Đang xem lại`.
- No `syn-review-banner` is rendered.
- No breadcrumb is rendered inside the lesson body.
- The top navigation remains the only course/chapter/item navigation surface.
- The footer action says `Tiếp tục bài Event Loop`.

Browser-console checks:

```js
document.querySelector('.syn-review-banner')
document.querySelector('.syn-breadcrumb')
```

Both expressions must return `null`.

## 3. Assessment continuity

1. Complete all required lessons in the chapter.
2. Open the chapter assessment from the top item selector, next control, or curriculum popover.

Expected:

- The URL remains canonical:

  ```text
  /courses/:courseId/chapters/:chapterId/assessments/:assessmentId
  ```

- The Synaploom application header remains visible.
- The same top course navigation remains visible.
- The AI assistant remains mounted.
- The assessment occupies the reading workspace instead of opening a standalone application page.
- No empty editor or terminal panel is shown for the quiz/form assessment.

Browser-console check:

```js
document.querySelector('.syn-assessment-page')
```

The expression must return `null`.

## 4. Assessment result and navigation refresh

1. On the assessment workspace, select `Kiểm tra kết quả`.
2. Wait for the mutation and navigation refresh.

Expected:

- The assessment result updates in the same workspace.
- Latest/best score information is announced without a page transition.
- Top navigation immediately reflects the new assessment/chapter state.
- The footer exposes the next valid lesson/chapter action when one exists.

In browser DevTools, confirm successful requests for:

```text
POST /api/v1/chapters/:chapterId/assessments/:assessmentId/actions/check
GET  /api/v1/chapters/:chapterId/assessments/:assessmentId
GET  /api/v1/courses/:courseId/navigation?viewedKind=assessment&...
```

## 5. Course completion

1. Complete the final required assessment or lesson.
2. Observe the requirement footer.

Expected:

- The footer displays `Bạn đã hoàn thành khóa học` as status text.
- There is no `Xem tổng kết khóa học` button.
- Clicking is not required because no summary screen exists yet.
- The URL does not gain a `#course-summary` fragment.

## Focused automated commands

```bash
pnpm exec vitest run --project dom \
  apps/web/src/features/lesson-progress/progression-action.test.ts \
  apps/web/src/features/lesson-progress/LessonRequirementFooter.test.tsx \
  apps/web/src/features/chapter-assessment/AssessmentWorkspaceContent.test.tsx \
  apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx \
  apps/web/src/shared/api/client.test.tsx

pnpm typecheck
pnpm lint
pnpm build:web
bash scripts/go/with-internal-toolchain.sh test ./internal/progression ./internal/server
```

When a step fails, send the first failing command, its complete output, the current URL, and a screenshot of the visible workspace state.
