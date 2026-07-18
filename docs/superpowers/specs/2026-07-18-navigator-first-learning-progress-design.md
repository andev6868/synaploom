# Navigator-First Learning Progress Design

## Goal

Expose hierarchical course progression inside the existing two-pane lesson workspace without reducing the coding workspace width or introducing a permanent third column.

## User Experience

- Add a compact `Nội dung khóa học` trigger at the top of the lesson pane.
- Opening the trigger reveals an in-pane drawer before the lesson body.
- The drawer shows chapter hierarchy, required and optional lessons, chapter assessments, and item states: completed, current, available, locked, and review.
- Locked items remain non-navigable and reveal human-readable blocking requirements.
- Review mode remains visible through the existing review banner and offers a return action to the persisted current lesson.
- Replace ambiguous `2/3` progress copy with explicit position and required-completion copy.

## Architecture

`LearningWorkspacePage` owns drawer open state and supplies canonical navigation data. `SynLessonProgress` becomes a presentation-only hierarchical navigator with no internal expansion state. A small `LearningProgressSummary` helper derives explicit position and completion labels from course and navigation payloads. No backend contract changes are required.

## Interaction Rules

- The drawer defaults closed to preserve lesson reading space.
- The trigger exposes `aria-expanded` and `aria-controls`.
- Clicking an unlocked lesson or assessment uses existing canonical routes.
- Clicking a locked item keeps the drawer open and displays its blocking requirements in an inline alert.
- Current viewed item uses `aria-current="step"`.
- Locked items use `aria-disabled="true"` and remain focusable so users can inspect the reason.

## Responsive Behavior

The drawer remains in normal document flow inside the lesson pane on desktop and mobile. It does not overlay or resize the practice pane. On narrow screens, hierarchy items remain full-width and chapter labels wrap naturally.

## Scope Exclusions

This slice does not redesign evaluator feedback, add new completion mutations, introduce course overview pages, or change backend progression rules.

## Manual Verification

The implementation will include a manual checklist covering drawer toggle, locked reasons, canonical navigation, assessment navigation, review return behavior, explicit progress copy, keyboard focus, and mobile wrapping.
