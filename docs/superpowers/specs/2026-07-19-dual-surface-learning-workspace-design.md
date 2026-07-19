# Dual-Surface Learning Workspace Design

**Status:** Approved interaction design; written specification awaiting review  
**Date:** 2026-07-19  
**Target release:** Workspace Presentation v1  
**Builds on:** Rich Content and Activity Engine v1, Unified Learning Workspace, Top Learning Navigation

## 1. Purpose

Synaploom must let learners read theory and perform activities without losing context. The current workspace only opens a second pane for coding activities. That model is too narrow for a multi-domain learning platform because quizzes, mathematics, writing, matching, simulations, assessment questions, and future media activities may also benefit from a focused practice surface.

This design replaces the coding-specific split layout with a subject-neutral **Dual-Surface Learning Workspace**:

- the **Theory Pane** preserves lesson or assessment context;
- the **Practice Pane** focuses one activity at a time;
- an activity may begin inline and move to the Practice Pane without creating a second editable instance;
- workspace presentation state is persisted in the backend and restored after refresh, restart, or reopening the learning item.

The Activity Engine remains responsible for drafts, attempts, evaluation, and feedback. The workspace controller is responsible only for presentation, focus, pane state, and safe activity switching.

## 2. Product principles

### 2.1 Theory and practice remain connected

The Theory Pane keeps the material required to solve the focused activity visible: explanations, examples, formulas, source text, vocabulary, instructions, references, or rubric. Opening an activity must not navigate to a separate application page or lose the learner's reading position.

### 2.2 The Practice Pane is not a coding pane

The Practice Pane is a focus dock for any activity renderer that benefits from additional space or simultaneous reference to theory. Coding is one supported renderer, not the trigger that defines the workspace architecture.

### 2.3 One editable activity instance

An activity may be represented inline and in the Practice Pane, but only one location may contain editable controls at a time. When focused in the Practice Pane, the inline representation becomes a read-only summary and navigation affordance.

### 2.4 Learner preference outranks author defaults

Presentation state is resolved in this order:

```text
persisted learner preference
→ authored activity presentation policy
→ system default for the activity kind
```

An activity configured with `defaultSurface: "practice"` opens automatically only when no persisted learner preference exists. If the learner later collapses the pane, reopening the lesson respects that choice.

### 2.5 Draft state and layout state are separate

Activity answers and drafts remain in Activity Engine attempt storage. Workspace presentation state stores only focus and pane layout. Presentation updates must never overwrite or duplicate an activity draft.

### 2.6 Fail safely

The system must not switch away from the focused activity when saving its draft fails. Invalid or stale focused activity references must collapse safely instead of breaking the lesson.

## 3. Scope

### 3.1 Included in version 1

- A reusable dual-surface shell for lessons and assessments.
- Theory Pane and Practice Pane.
- Collapsed, split, and expanded pane modes.
- Automatic collapse when no activity is focused.
- A collapsed Practice Rail with activity count and entry action.
- An Activity Tray listing activities in authored order and completion status.
- Inline-to-practice transitions.
- Practice-to-inline transitions.
- Save-before-switch between activities.
- Backend persistence of presentation state per learner and learning-item owner.
- Revision-based stale update protection.
- Restore after refresh, runtime restart, reopening, or switching devices and reopening the item.
- Presentation policy for all ten Activity Engine v1 kinds.
- Shared behavior for lesson and assessment owners.
- Desktop, laptop, and mobile presentations.
- Accessibility and keyboard focus management.
- Existing pane ratio migration.

### 3.2 Deferred

- Near-real-time synchronization between tabs or devices.
- Collaborative activity editing.
- Multiple simultaneous focused activities.
- Floating or detachable activity windows.
- Cross-lesson pinned activities.
- Browser-local draft fallback when backend persistence fails.
- User-configurable pane presets.
- Author-controlled forced-open panes that override a learner's persisted collapse preference.

## 4. Workspace anatomy

```text
┌──────────────────────────────────┬──────────────────────────────────┐
│ Theory Pane                      │ Practice Pane                    │
│                                  │                                  │
│ Rich lesson document             │ Focused activity                 │
│ Source material and references   │ Activity feedback                │
│ Inline activities                │ Terminal/evaluator where needed  │
│ Lesson progression footer        │ Practice action bar              │
└──────────────────────────────────┴──────────────────────────────────┘
```

### 4.1 Theory Pane

The Theory Pane contains:

- the rich lesson document or assessment reference material;
- inline activity slots;
- read-only summary cards for activities focused in the Practice Pane;
- lesson or assessment contextual information;
- the lesson progression footer.

The Theory Pane owns document scroll position. Opening, switching, expanding, or closing the Practice Pane must not reset that position.

### 4.2 Practice Pane

The Practice Pane contains:

- `PracticePaneHeader`;
- `ActivityTray`;
- one `ActivityFocusHost`;
- feedback, terminal, evaluator, or result region;
- `PracticeActionBar`;
- controls to collapse or expand the pane.

It renders one activity at a time. It does not own lesson progression actions such as continuing to the next lesson.

### 4.3 Practice Rail

When the pane is collapsed, the shell shows a compact rail rather than a blank second panel:

```text
Thực hành · 4 hoạt động ›
```

The rail exposes:

- number of activities in the active owner;
- focused activity status when a focus is persisted but the learner has collapsed the pane;
- an action to open the Activity Tray or restore the focused activity.

The Theory Pane consumes the remaining width.

## 5. Pane modes

```ts
export type PracticePaneMode = 'collapsed' | 'split' | 'expanded';
```

### 5.1 `collapsed`

- The Practice Pane content is not mounted as an editable surface.
- The Practice Rail remains available.
- The Theory Pane uses the available width.
- A focused activity may remain persisted while the pane is collapsed because the learner deliberately hid it.
- Inline rendering becomes editable again only when the focused activity is explicitly returned inline. A collapsed-but-focused activity uses a summary card and can be restored from the rail.

### 5.2 `split`

- Theory and Practice Panes are visible side by side on desktop.
- The divider is keyboard and pointer resizable.
- The saved ratio applies after clamping to supported minimum widths.
- This is the default mode when opening an activity in the Practice Pane.

### 5.3 `expanded`

- The Practice Pane consumes most of the content viewport.
- A Theory Rail remains available so the learner can return to split or theory-focused presentation.
- Expanded mode is suitable for coding, long-form writing, large matching/ordering activities, and future graph or simulation renderers.

## 6. Activity presentation policy

Course Schema extends each activity with optional presentation metadata:

```ts
export interface ActivityPresentation {
  readonly defaultSurface: 'inline' | 'practice' | 'auto';
  readonly allowInline: boolean;
  readonly allowPractice: boolean;
  readonly preferredWidth: 'compact' | 'standard' | 'wide';
  readonly supportsFullscreen: boolean;
}
```

### 6.1 System defaults

| Activity kind | Default surface | Notes |
| --- | --- | --- |
| `true-false` | inline | Compact binary response. |
| `single-choice` | inline | Practice default may be selected for long option sets. |
| `short-answer` | inline | Practice remains available. |
| `fill-blanks` | inline | Large passages may use Practice Pane. |
| `numeric` | inline | Wide graph or scratch tools may override later. |
| `multiple-choice` | auto | Inline for compact sets, Practice Pane for long sets. |
| `ordering` | auto | Practice Pane for many items or long labels. |
| `matching` | auto | Practice Pane for larger pair sets. |
| `writing` | practice | Long-form editor requires stable space. |
| `coding` | practice | Editor, files, terminal, and results require focused space. |

### 6.2 Resolution algorithm

```text
1. Load persisted presentation state for the owner.
2. If a valid persisted state exists, use it.
3. Otherwise resolve the authored presentation policy.
4. For `auto`, use the system kind/size heuristic.
5. If no activity should open, collapse the Practice Pane.
```

An author may prohibit one surface by setting `allowInline` or `allowPractice` to `false`. Validation rejects impossible combinations, including both flags being `false`.

## 7. Inline activity behavior

### 7.1 Inline controls

An activity that supports inline rendering may show:

```text
[Làm tại đây] [Mở trong khu vực thực hành]
```

Complex activities may show only:

```text
[Mở khu vực thực hành]
```

### 7.2 Opening in the Practice Pane

Selecting `Mở trong khu vực thực hành` performs this sequence:

```text
persist current inline draft if dirty
→ update workspace focus to the selected activity
→ set pane mode to split
→ replace inline controls with a summary card
→ mount the same activity attempt in ActivityFocusHost
→ move keyboard focus to the Practice Pane heading
```

No preview confirmation is required.

### 7.3 Focused inline summary

When the activity is focused in the Practice Pane, its document slot renders a summary:

```text
Quiz đang mở trong khu vực thực hành
2/3 câu đã trả lời

[Đi tới khu vực thực hành]
```

The summary may include completion, score, draft, or feedback status. It must not mount another editable activity form.

### 7.4 Returning inline

Returning an activity inline:

```text
save draft if dirty
→ clear focusedActivityId
→ collapse the Practice Pane
→ restore the inline renderer with the same attempt state
→ move keyboard focus to the inline activity heading
```

Closing the pane does not delete answers, reset an attempt, or clear feedback.

## 8. Activity switching

When activity A is focused and the learner selects activity B:

```text
save draft A
→ if save succeeds: persist focus B and render B
→ if save fails: retain A, retain focus, show an actionable error
```

The workspace does not show a confirmation dialog during the normal successful flow.

If activity A is not dirty, the controller may switch without a draft request.

### 8.1 Save failure

On save failure:

- do not mutate `focusedActivityId`;
- do not unmount activity A;
- display the error next to the save state in the Practice Pane;
- provide `Thử lưu lại`;
- do not create a browser-memory draft source.

### 8.2 Revision conflict

If the presentation update uses a stale revision:

- the backend returns `409 WORKSPACE_PRESENTATION_CONFLICT` with the current state;
- the frontend refreshes presentation state;
- it does not silently overwrite the newer state;
- activity drafts remain safe because they are stored independently.

Version 1 does not push state updates to other tabs. A second tab observes the new state only after reload or reopening the owner.

## 9. Completion behavior

After an activity is submitted or passes:

- keep the activity visible;
- keep feedback in the viewport;
- do not switch automatically;
- do not collapse automatically;
- update activity-set progress and lesson requirements;
- show an explicit next action.

```text
✓ Hoàn thành
Điểm: 4/4

[Thử lại] [Hoạt động tiếp theo]
```

`Hoạt động tiếp theo` uses authored activity order and performs the same save-before-switch flow. If there is no remaining activity, the pane shows:

```text
✓ Tất cả hoạt động trong bài đã hoàn thành
```

Lesson or chapter progression remains in the Theory Pane footer. Activity actions and learning progression actions are never mixed in one action bar.

## 10. Activity Tray

The tray lists all activities belonging to the active lesson or assessment in authored order:

```text
Hoạt động trong bài

✓ Kiểm tra nhanh
→ Coding lab
○ Bài viết phản tư
○ Quiz cuối bài
```

Each row communicates:

- activity title;
- activity kind;
- required or optional status;
- draft, in-progress, passed, failed, or available status;
- locked state and blocking requirement when applicable.

Selecting a row invokes the workspace controller's focus transition. The tray does not directly mount activity renderers.

## 11. Backend presentation persistence

### 11.1 Canonical model

The existing global `/preferences/pane-ratio` stub is replaced by owner-scoped presentation state.

```ts
export interface WorkspacePresentationState {
  readonly courseId: string;
  readonly ownerKind: 'lessons' | 'assessments';
  readonly ownerId: string;
  readonly focusedActivityId: string | null;
  readonly paneMode: 'collapsed' | 'split' | 'expanded';
  readonly splitRatio: number;
  readonly userCollapsed: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}
```

`ownerKind` matches the existing Activity Engine owner vocabulary. The current local application profile is the learner identity for version 1. The storage key must allow an explicit user/profile dimension when multi-user authentication is introduced.

### 11.2 Storage table

```sql
CREATE TABLE workspace_presentation_states (
  profile_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('lessons', 'assessments')),
  owner_id TEXT NOT NULL,
  focused_activity_id TEXT,
  pane_mode TEXT NOT NULL CHECK (pane_mode IN ('collapsed', 'split', 'expanded')),
  split_ratio REAL NOT NULL,
  user_collapsed INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, course_id, owner_kind, owner_id)
);
```

### 11.3 Invariants

- `splitRatio` is clamped to the supported interval before persistence.
- `focusedActivityId`, when non-null, must belong to the owner and remain accessible.
- Invalid persisted focus is cleared and the pane collapses.
- `userCollapsed` is set only by an explicit learner collapse action.
- Opening an activity clears `userCollapsed` for that owner.
- Author defaults never overwrite an existing row.
- Every update requires the expected `revision` and increments it once.

### 11.4 API

```text
GET /api/v1/courses/:courseId/:ownerKind/:ownerId/workspace-presentation
PUT /api/v1/courses/:courseId/:ownerKind/:ownerId/workspace-presentation
```

PUT request:

```json
{
  "focusedActivityId": "event-loop-lab",
  "paneMode": "split",
  "splitRatio": 0.45,
  "userCollapsed": false,
  "revision": 3
}
```

The server returns the normalized state with revision `4`.

The frontend saves only after discrete actions:

- focus activity;
- close or collapse pane;
- change split/expanded mode;
- complete divider drag.

It does not write on every pointer movement.

## 12. Frontend controller

```ts
export interface LearningWorkspaceController {
  readonly state: WorkspacePresentationState;
  readonly saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  readonly error: Error | null;

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

The controller coordinates Activity Engine draft persistence and workspace presentation persistence. It does not implement activity evaluation.

### 12.1 Switch transaction

```text
Activity Engine: save dirty draft
→ Presentation API: update focused activity/pane mode
→ Query cache: publish new presentation state
→ UI: move focus to new activity heading
```

A failure in the first step stops the sequence. A presentation update conflict refreshes state and leaves the current activity mounted until the conflict is resolved.

## 13. Component architecture

```text
LearningWorkspaceShell
├── TheoryPane
│   ├── RichLessonDocument
│   ├── InlineActivitySlot
│   └── LessonRequirementFooter
│
├── PracticePane
│   ├── PracticePaneHeader
│   ├── ActivityTray
│   ├── ActivityFocusHost
│   ├── ActivityFeedbackRegion
│   └── PracticeActionBar
│
└── WorkspacePaneRail
```

### 13.1 Responsibilities

- `LearningWorkspaceShell`: layout and responsive mode mapping.
- `TheoryPane`: document rendering and inline activity slots.
- `PracticePane`: focused activity presentation.
- `ActivityFocusHost`: wraps the existing `ActivityHost` without changing evaluator behavior.
- `WorkspacePaneRail`: collapsed entry point.
- `LearningWorkspaceController`: orchestration and persistence.
- `ActivityHost`: activity rendering, draft, submission, evaluation, and feedback only.

The current `WorkspaceShell` can be evolved into `LearningWorkspaceShell`, but coding-specific assumptions must be removed. The current `resolveWorkspaceLayout()` decision based on `focusedKind === 'coding'` is superseded by persisted presentation state and activity presentation policy.

## 14. Lesson use cases

### 14.1 Reading-only lesson

- No activity is focused.
- Practice Pane is collapsed.
- Theory Pane uses the full content width.
- The rail may be hidden when the owner has zero activities.

### 14.2 Inline checkpoint

- Activity renders inline by default.
- Learner may complete it inline or move it to Practice Pane.
- Moving it does not create a new attempt.

### 14.3 Coding lesson

- First visit may open the authored/default coding activity in split mode.
- Theory Pane keeps instructions and references visible.
- Practice Pane contains files, editor, terminal, run/check/reset, and feedback.
- A learner collapse preference is restored on later visits.

### 14.4 Long-form writing

- Source text, rubric, and references remain in Theory Pane.
- Writing editor opens in Practice Pane.
- Draft save state is always visible.

### 14.5 Multiple activities

- Activity Tray lists all activities.
- Only one activity is focused.
- Switching follows save-before-switch.
- Completed activities remain reviewable.

## 15. Assessment use cases

Assessment uses the same shell and persistence model.

### 15.1 Open-reference assessment

Theory Pane may contain:

- instructions;
- source text;
- formula sheet;
- allowed references;
- assessment progress.

Practice Pane contains the focused assessment activity.

### 15.2 Closed-book assessment

Theory Pane changes to assessment context rather than lesson theory:

- attempt policy;
- time or status information when introduced;
- question/activity navigator;
- progress and submission rules.

It still uses the same shell, controller, and Activity Tray. It is not a separate application page.

## 16. Responsive behavior

### 16.1 Wide desktop

- Horizontal split.
- Default ratio derived from persisted state or `45/55` system default.
- Divider constraints protect both reading and activity usability.

### 16.2 Narrow laptop/tablet

The shell exposes three presentation choices:

```text
Lý thuyết | Chia đôi | Thực hành
```

If the viewport cannot support both minimum widths, `split` maps to one active surface with a quick switch control instead of rendering two unusably narrow columns.

### 16.3 Mobile

- Theory is the primary page.
- Opening Practice Pane presents a full-screen activity sheet.
- Browser/back UI returns to the exact Theory Pane scroll position.
- Persisted `split` or `expanded` maps to full-screen practice on restore.
- Closing the sheet preserves draft and focus semantics.

## 17. Accessibility

- Practice Rail is a button with activity count and expanded state.
- Divider supports keyboard resizing and has an accessible label.
- Opening an activity moves focus to its `h2` heading.
- Returning inline moves focus to the inline activity heading.
- Activity Tray uses a list or listbox pattern appropriate to selection behavior.
- Status is communicated with text, not color alone.
- Collapsed and expanded controls expose `aria-expanded` and `aria-controls`.
- Live regions announce save success, save failure, evaluation result, and revision conflict.
- Mobile full-screen practice maintains a focus trap and restores focus on close.
- Reduced-motion preference disables animated pane transitions.

## 18. Error and stale-state handling

### 18.1 Invalid focused activity

If the stored activity no longer exists, is no longer owned by the lesson/assessment, or becomes inaccessible:

- clear focus;
- set mode to `collapsed`;
- preserve other valid presentation fields;
- show a non-blocking notice once;
- continue rendering theory.

### 18.2 Activity loading failure

The Practice Pane remains open with a retryable error. Theory stays usable. The system does not collapse automatically because that would hide the failure context.

### 18.3 Presentation persistence failure

The current UI state stays mounted, save status becomes error, and actions that would unmount the dirty activity are blocked until retry succeeds.

### 18.4 Offline behavior

Version 1 does not create a secondary local presentation store. The current in-memory view may remain usable, but transitions requiring authoritative persistence display an error and do not pretend to have been saved.

## 19. Migration

### 19.1 Existing pane ratio

The existing global pane ratio preference is currently a stub that always returns `0.48`. During migration:

- no global ratio data needs to be preserved;
- new owner state defaults to `0.45` Theory Pane width when split;
- the legacy `/preferences/pane-ratio` endpoint remains temporarily for compatibility and is removed after all clients use owner-scoped presentation APIs.

### 19.2 Existing coding layout

A lesson with a coding activity and no presentation row receives an initial state derived from the coding activity policy:

```text
focusedActivityId = first required coding activity
paneMode = split
splitRatio = 0.45
userCollapsed = false
```

A reading-only lesson receives:

```text
focusedActivityId = null
paneMode = collapsed
splitRatio = 0.45
userCollapsed = false
```

### 19.3 Existing inline activities

Existing Activity Engine activities remain inline unless their kind default or authored policy resolves to Practice Pane. Their attempts and drafts require no migration.

## 20. Observability

Structured events should record:

- presentation state load and normalization;
- focus activity transition;
- draft-save-before-switch failure;
- pane collapse, split, and expand;
- stale revision conflict;
- invalid stored activity recovery;
- responsive mode mapping.

Events must not include learner answers, source code contents, essay text, or evaluator feedback bodies.

## 21. Testing strategy

### 21.1 Backend

- repository create/read/update/restart tests;
- optimistic revision conflict tests;
- invalid focus normalization;
- owner isolation between lessons and assessments;
- profile isolation;
- ratio clamping;
- route contract tests.

### 21.2 Controller

- open inline activity in Practice Pane;
- save-before-switch succeeds;
- save-before-switch failure blocks transition;
- return inline preserves draft;
- persisted learner collapse outranks authored default;
- activity completion stays visible;
- next activity requires explicit action;
- stale revision recovery;
- restore after refresh.

### 21.3 UI

- collapsed rail and zero-activity behavior;
- no duplicate editable activity instances;
- activity summary card while focused;
- tray ordering and status;
- split resize persistence only after completed drag;
- expanded mode;
- keyboard focus transfer;
- reduced motion;
- desktop, narrow laptop, and mobile mapping.

### 21.4 Browser acceptance

A required flow must verify:

```text
open reading lesson with collapsed pane
→ complete an inline quiz
→ open it in Practice Pane without losing draft
→ switch to coding activity after draft save
→ collapse pane
→ refresh and confirm collapse/focus restoration
→ restore pane from rail
→ complete coding activity and inspect feedback
→ choose next activity explicitly
→ open assessment in the same shell
→ restart runtime and confirm state restoration
```

## 22. Acceptance criteria

The design is complete when all of these are true:

1. The second pane is no longer conditional on `kind: "coding"`.
2. A lesson with no focused activity uses the full theory width and exposes a compact Practice Rail when activities exist.
3. Any activity with `allowPractice: true` can move from inline to Practice Pane without creating a new attempt.
4. Only one editable renderer exists for a focused activity.
5. Activity switching saves the current dirty draft first and stops on failure.
6. A completed activity remains visible with feedback until the learner explicitly moves on.
7. Learner collapse preference is restored and outranks author defaults.
8. Presentation state survives refresh and runtime restart through backend persistence.
9. Lessons and assessments use the same shell and controller.
10. Activity actions remain separate from lesson progression actions.
11. Desktop, narrow-screen, and mobile behavior remains usable and keyboard accessible.
12. Stale or invalid persisted focus cannot break the learning page.

## 23. Delivery sequence

Implementation should proceed in this order:

1. Protocol and persistence model.
2. Owner-scoped presentation API.
3. Activity presentation policy and validation.
4. Workspace controller with save-before-switch.
5. Dual-surface shell and collapsed rail.
6. Inline summary/focus transition.
7. Activity Tray and completion/next behavior.
8. Assessment integration.
9. Responsive and accessibility behavior.
10. Migration, documentation, browser acceptance, and release gates.
