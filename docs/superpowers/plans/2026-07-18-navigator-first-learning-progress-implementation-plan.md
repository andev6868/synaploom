# Navigator-First Learning Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible in-pane hierarchical course navigator with explicit progress labels, locked requirement feedback, assessment visibility, and review-safe navigation.

**Architecture:** `LearningWorkspacePage` owns visibility and locked-item feedback. `SynLessonProgress` renders hierarchy only and receives all actions through props. A focused summary helper derives explicit course-position and required-completion labels without changing backend contracts.

**Tech Stack:** React 19, TypeScript 6, TanStack Query, existing `@synaploom/protocol` contracts, existing CSS architecture.

## Global Constraints

- Preserve the current two-pane lesson/workspace layout.
- Do not add or change backend API contracts.
- Keep locked items keyboard-focusable and non-navigable.
- Reuse canonical lesson and assessment routes.
- Do not run project tests in this execution; provide exact manual and automated commands for the user.

---

### Task 1: Extract explicit learning progress summary

**Files:**
- Create: `apps/web/src/features/learning-progress/progress-summary.ts`
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`

**Interfaces:**
- Consumes: `CoursePayload`, `CourseNavigationPayload`, `LessonPayload` from `@synaploom/protocol`.
- Produces: `buildLearningProgressSummary(...)` returning `{ positionLabel: string; completionLabel: string }`.

- [ ] **Step 1:** Add a pure helper that counts required lessons and creates explicit Vietnamese labels.
- [ ] **Step 2:** Replace the ambiguous `LessonProgress` widget with the explicit labels in the lesson heading.
- [ ] **Step 3:** Keep legacy routes functional by falling back to the flat course lesson list.
- [ ] **Step 4:** Commit with `feat: clarify learning progress summary`.

### Task 2: Convert navigator into a controlled drawer body

**Files:**
- Modify: `apps/web/src/features/learning-progress/types.ts`
- Modify: `apps/web/src/features/learning-progress/SynLessonProgress.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Consumes: existing `CourseNavigationPayload` plus open lesson, assessment, and locked callbacks.
- Produces: a presentation-only hierarchy with `id="course-learning-navigation"`.

- [ ] **Step 1:** Remove internal collapsed state and toggle UI from `SynLessonProgress`.
- [ ] **Step 2:** Render chapter status, numbered lesson positions, required/optional labels, assessment identity, and accessible state text.
- [ ] **Step 3:** Keep locked items focusable with `aria-disabled` and call `onLockedItem` instead of navigating.
- [ ] **Step 4:** Update styles for hierarchy density, state markers, and responsive wrapping.
- [ ] **Step 5:** Commit with `feat: refine hierarchical course navigator`.

### Task 3: Add drawer trigger and locked-requirement alert

**Files:**
- Modify: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Modify: `apps/web/src/application.css`

**Interfaces:**
- Consumes: `RequirementView[]` supplied by `SynLessonProgress`.
- Produces: controlled `navigatorOpen` and `lockedRequirements` UI state.

- [ ] **Step 1:** Add `Nội dung khóa học` trigger with `aria-expanded` and `aria-controls`.
- [ ] **Step 2:** Render `SynLessonProgress` only while open.
- [ ] **Step 3:** Show an inline `role="alert"` with readable blocking requirement labels after a locked click.
- [ ] **Step 4:** Clear stale locked feedback when an unlocked item is selected or the drawer closes.
- [ ] **Step 5:** Commit with `feat: add course navigation drawer`.

### Task 4: Add verification guide and package handoff

**Files:**
- Create: `docs/testing/navigator-first-manual-verification.md`

**Interfaces:**
- Produces: exact manual and automated verification instructions for the user.

- [ ] **Step 1:** Document desktop, mobile, keyboard, locked item, assessment, and review scenarios.
- [ ] **Step 2:** Include targeted commands and expected results without running them.
- [ ] **Step 3:** Commit with `docs: add navigator-first verification guide`.
- [ ] **Step 4:** Create a full source ZIP with Git bundle, log, status, and checksums.
