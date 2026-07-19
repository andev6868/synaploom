# Dual-Surface Learning Workspace manual verification

Run these checks against a staged Go runtime using a temporary `SYNAPLOOM_HOME`. Use role-based controls and inspect the page for console errors after each transition.

## Lesson and inline transition

1. Open a reading lesson with activities and verify Theory Pane is primary and the Practice Rail reports the authored activity count.
2. Edit an inline activity without using its explicit save button, then choose “Mở trong khu vực thực hành”. Confirm save-before-switch preserves the draft and exactly one editable renderer exists.
3. Switch to another activity through Activity Tray. Confirm the previous draft is saved first and the new Practice Pane `h2` receives keyboard focus.
4. Return the activity inline and confirm focus moves to the inline `h3`, Theory scroll position is preserved, and no new attempt is created.

## Persistence, refresh, and runtime restart

1. Focus an activity, drag the divider to a valid ratio, then collapse Practice Pane.
2. Refresh the browser. Confirm the activity remains focused-but-hidden, the summary says it is temporarily hidden, `userCollapsed` is respected, and the rail can restore it.
3. Stop and restart the runtime while reusing the same `SYNAPLOOM_HOME` and SQLite database. Bootstrap a new session and reopen the same lesson. Confirm focus, collapse mode, and ratio are restored.

## Assessment shared shell

1. Open a chapter assessment and verify it uses the same shell, rail, Activity Tray, and Practice Pane as a lesson.
2. Confirm assessment title, attempt policy, score/progress, references, and completion requirements remain in Theory Pane.
3. Switch assessment activities and prove there is one editable form for the focused question. Confirm assessment or chapter continuation controls are not mixed with activity submit/retry controls.

## Responsive and mobile

1. At a wide viewport, verify collapsed, split, and supported expanded modes. Resize the divider with pointer and keyboard; persistence must occur after the completed drag, not on every pointer movement.
2. At compact width, use “Lý thuyết | Chia đôi | Thực hành”. Confirm this viewport mapping does not itself mutate backend pane mode.
3. At mobile width, open practice as a full-screen dialog. Verify focus is trapped, safe-area padding is present, closing restores focus to the opener, and returning to Theory restores the exact scroll position.
4. Enable reduced motion and confirm pane, rail, and dialog transitions are removed.

## Failure and conflict recovery

1. Force an Activity Engine draft save failure, then attempt a focus switch, collapse, and return-inline action. Each save failure must keep the current editor mounted, retain focus, display an alert, and provide “Thử lưu lại”.
2. Force activity-load failure. The Practice Pane must remain open with “Thử tải lại”; retry must refetch without collapsing or discarding context.
3. Produce a stale optimistic revision from a second client. Confirm HTTP 409 `WORKSPACE_PRESENTATION_CONFLICT`, a visible conflict recovery notice, and retry of the same intent using the returned revision. Do not silently adopt the other client’s focus before retry succeeds.
4. Remove a previously focused activity from the course package, restart, and reopen the owner. Confirm invalid focus is recovered to collapsed state and Theory remains usable.

## Accessibility and event privacy

Navigate the rail, tray, pane controls, divider, inline actions, and mobile dialog using keyboard only. Status must be communicated with text rather than color. Inspect `synaploom:workspace-event` and backend structured events: they may contain IDs, pane mode, ratio, revision, viewport, transition, and error code, but never learner answers, source code, essay content, prompts, or feedback bodies.
