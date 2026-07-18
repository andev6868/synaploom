# Top Navigation Shell Design

## Goal

Move hierarchical learning navigation out of the lesson document flow and into a persistent application header so learners can change chapter or item without scrolling away from lesson content.

## Architecture

The existing progression API remains unchanged. A new `LearningTopNavigation` component consumes the navigation payload and renders compact progress steps, chapter/item selectors, previous/next controls, and a curriculum popover. `LearningWorkspacePage` owns route navigation and locked-item state, while the header component remains presentational.

For lessons without an exercise, the workspace renders the lesson as a full-width reading surface instead of reserving an empty practice pane.

## Behavior

- The curriculum is never rendered inside the lesson scroll area.
- Chapter and current-item selectors are always visible on desktop.
- Previous and next controls follow curriculum order.
- Locked items do not navigate and expose blocking requirements in the header popover.
- Completed lessons remain available for review.
- Assessment items participate in the same navigation sequence.
- On narrow screens, selectors collapse into a single curriculum control.
- Review banners remain in lesson content because they describe the viewed lesson state.
