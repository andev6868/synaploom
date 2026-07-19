# Dual-Surface Learning Workspace

The Dual-Surface Learning Workspace lets a learner keep lesson or assessment context visible while focusing one activity. The Theory Pane contains authored content, embedded activity positions, references, and progression requirements. The Practice Pane contains exactly one editable activity renderer plus its feedback and activity-level actions. A focused activity remains represented at its authored Theory Pane position as a read-only summary; it is never mounted as a second editable form.

## Presentation metadata

Authors may attach the following optional policy to an activity definition:

```json
{
  "presentation": {
    "defaultSurface": "practice",
    "allowInline": true,
    "allowPractice": true,
    "preferredWidth": "wide",
    "supportsFullscreen": true
  }
}
```

`defaultSurface` accepts `inline`, `practice`, or `auto`. `allowInline` controls whether the editable renderer may appear inside Theory Pane content. `allowPractice` controls whether the activity may be focused in the Practice Pane. `preferredWidth` is `compact`, `standard`, or `wide` and documents the minimum comfortable surface. `supportsFullscreen` permits expanded Practice Pane mode; it is valid only when `allowPractice` is true.

The authoring validator rejects impossible policies: both surfaces disabled, an inline default while inline is disabled, a practice default while practice is disabled, or fullscreen support while practice is disabled. Omitted metadata remains backward compatible. The public activity payload always contains normalized metadata.

## Resolution and precedence

Presentation is resolved in this order:

1. A persisted learner state for `profile_id + course_id + owner_kind + owner_id`.
2. Authored presentation metadata.
3. The system policy for the activity kind and collection size.

A learner collapse therefore outranks an authored practice default. Authors cannot force the Practice Pane open after the learner explicitly collapses it. With no persisted row, writing and coding default to practice/wide; compact true-false, short-answer, fill-blanks, and numeric activities default inline; large choice, ordering, and matching collections may resolve to practice.

## One editable instance

An activity may move between Theory Pane and Practice Pane without creating a new attempt. When `focusedActivityId` identifies an activity, the Practice Pane owns the editable renderer and the Theory Pane slot becomes a status summary. When the activity is returned inline, the controller saves its dirty draft, clears `focusedActivityId`, collapses the Practice Pane, remounts the inline renderer, and restores keyboard focus to its heading.

Collapsing is intentionally different from returning inline. Collapse preserves `focusedActivityId` and sets `userCollapsed`; the inline slot remains a summary so a hidden focused activity cannot gain a second editor. The Practice Rail restores the same activity.

## Save-before-switch

Every transition that could unmount or replace an editable renderer follows save-before-switch:

```text
save dirty Activity Engine draft
→ persist workspace presentation revision
→ publish the new state
→ mount the new surface
→ move keyboard focus
```

A failed draft save blocks focus change, collapse, return-inline, and next-activity selection. The current editor and learner content remain mounted. A stale presentation revision returns `WORKSPACE_PRESENTATION_CONFLICT`; the UI displays the backend state and retries the same learner intent with the current revision instead of silently overwriting it.

## Lessons and assessments

Lessons and assessments share `LearningWorkspaceShell`, `LearningWorkspaceController`, `PracticePane`, `ActivityTray`, and `WorkspacePaneRail`. Lesson or assessment progression stays in Theory Pane. Submit, retry, save, and explicit “next activity” controls stay in Practice Pane. Completing an activity never automatically changes focus or advances the lesson.

On wide screens, split mode uses a keyboard-resizable divider. Compact screens provide local Theory/Split/Practice controls without changing persisted state merely because the viewport changed. Mobile maps split or expanded state to a controlled full-screen dialog, traps focus while open, restores the opener on close, and preserves the Theory Pane scroll position.
