# Top Navigation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-document curriculum drawer with a compact persistent top navigation shell and remove the empty practice pane for reading-only lessons.

**Architecture:** Keep progression data and routing in `LearningWorkspacePage`. Add a presentational header navigation component that emits lesson, assessment, and locked-item actions. Extend `AppHeader` with a navigation slot and render reading-only lessons in a single-pane layout.

**Tech Stack:** React, TypeScript, TanStack Query, existing Synaploom UI/CSS.

## Global Constraints

- Do not change progression API contracts.
- Do not add third-party UI dependencies.
- Preserve keyboard-accessible locked items and review navigation.

---

### Task 1: Header navigation component

**Files:**

- Create: `apps/web/src/features/learning-progress/LearningTopNavigation.tsx`
- Modify: `apps/web/src/features/learning-progress/types.ts`
- Test: `apps/web/src/features/learning-progress/LearningTopNavigation.test.tsx`

- [ ] Render progress steps, chapter selector, item selector, previous/next controls, and curriculum popover.
- [ ] Emit locked requirements instead of navigating locked items.
- [ ] Cover current, completed, optional, assessment, and locked states.

### Task 2: Application header integration

**Files:**

- Modify: `packages/ui/src/components/app-header/app-header.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Test: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`

- [ ] Add an optional navigation slot to `AppHeader`.
- [ ] Remove `SynLessonProgress` from the lesson article.
- [ ] Mount `LearningTopNavigation` in the persistent header.
- [ ] Keep blocking requirements visible in the curriculum popover.

### Task 3: Reading-only adaptive layout

**Files:**

- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/application.css`
- Test: `apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx`

- [ ] Render a full-width reading surface when `lesson.exercise` is absent.
- [ ] Preserve the two-pane resizable layout for exercise lessons.
- [ ] Add responsive styles for compact header navigation.
