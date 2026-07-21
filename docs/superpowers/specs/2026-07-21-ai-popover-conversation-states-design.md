# AI Popover Conversation States Design

## Goal

Make the compact quick AI popover feel populated before the AI provider is
available, while preserving a clear way to return to its contextual quick
actions.

## Scope

- Extend only the quick popover's display state and styles.
- Increase the quick popover body space slightly so the conversation preview
  can show three compact bubbles without crowding the composer.
- Do not change the controller, AI request payloads, backend, expanded panel,
  or current 320–420px popover width policy.

## Conversation Preview

When the controller has no saved messages and no provider response, show this
static, Vietnamese mock exchange:

1. Assistant: "Mình có thể giúp gì cho bạn?"
2. User: "Giải thích dòng chảy thuật toán"
3. Assistant: "Mình sẽ giải thích ngắn gọn và dễ hiểu."

This is presentational sample content only. It is not persisted, sent to the
provider, or added to `controller.messages`.

When live messages or a response exist, show the latest existing conversation
preview instead of the sample exchange.

## Quick Actions State

- With no conversation, show the current three contextual action cards.
- Once mock or live conversation bubbles are displayed, hide the cards to keep
  the compact surface focused on the chat.
- Show a small, accessible `Xem gợi ý` button above the composer while cards
  are hidden. It toggles the cards back into view without removing any
  conversation bubbles.
- The toggle is local component UI state and resets to hidden whenever the
  quick popover closes or receives a new invocation.

## Layout and Accessibility

- Increase the popover's available vertical room and the body minimum space by
  one compact row; preserve the existing source-pane positioning and mobile
  bottom-sheet behavior.
- Continue exposing the conversation summary, action group, live status,
  error alert, labels, and button names semantically.
- `Xem gợi ý` uses a text label and updates `aria-expanded` against the action
  group; no icon-only action is introduced.

## Verification

- Unit-test mock preview, action hiding, and action re-enable behavior.
- Browser-test retained compact width, increased vertical room, and the
  semantic action toggle.
- Run lint, typecheck, unit tests, and the focused Go-runtime browser test.

## Self-review

The mock content is explicitly display-only, the action toggle does not alter
controller state, and this scope does not change any AI request or expanded
conversation behavior.
