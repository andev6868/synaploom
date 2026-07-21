# Expanded AI Assistant Panel Design

## Goal

Restyle the desktop contextual AI assistant panel to match the approved
Vietnamese reference: a spacious conversation surface with a clear assistant
identity, a useful empty state, rich contextual suggestions, and a persistent
composer.

## Scope

- Change the expanded `AssistantConversationPanel` presentation and its
  component-level interactions.
- Preserve the controller contract, AI request payloads, API routes, and the
  compact quick popover.
- Keep the existing responsive dialog treatment on narrow viewports, adapting
  the same visual hierarchy without changing its modal semantics.

## Empty Conversation State

When the expanded controller has no live messages, render the mockup's
display-only starting conversation:

1. Assistant heading and avatar.
2. A soft assistant greeting: “Mình có thể giúp gì cho bạn? 👋”.
3. A bordered guidance bubble: “Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo
   ngữ cảnh hiện tại.”
4. The “Gợi ý cho bạn” section with three wide cards for explanation, example,
   and summary.

These greeting and guidance bubbles are not persisted and are never submitted
as user messages. Once live conversation messages exist, only real messages
are displayed and the empty-state suggestion cards are hidden.

## Suggestions

- Use the controller's current contextual actions so theory and practice keep
  their existing request kinds and labels.
- Theory presents the mockup's `Giải thích`, `Cho ví dụ`, and `Tóm tắt`
  hierarchy using distinct blue, green, and violet accents, leading icon, body
  text, and trailing chevron.
- Selecting a card starts the existing corresponding AI request. The cards are
  disabled while a request is pending, as current quick actions are.

## Visual Composition

1. **Panel header** — assistant avatar, title, context label, expand and
   close controls, followed by a divider.
2. **Conversation area** — generous internal spacing, assistant avatar-led
   bubbles, readable timestamps, and distinct assistant/user surfaces for
   live messages.
3. **Composer** — pinned to the panel bottom with a rounded border, add and
   microphone affordances as non-disruptive UI controls, the current prompt
   textarea, and a blue circular send button. Existing submit, pending,
   disabled, and error behavior remains authoritative.
4. **Disclaimer** — render the brief AI caveat beneath the composer to match
   the reference without displacing the interaction controls.

## Accessibility and Responsiveness

- Retain accessible labels, live status, error alert, dialog/complementary
  semantics, focus behavior, and keyboard submission.
- Icon-only controls have explicit accessible names; decorative avatars and
  embellishments remain hidden from assistive technology.
- Desktop panel stays anchored at the right edge but is widened enough for the
  three-card layout. Mobile continues to use the current modal presentation
  with cards stacking or wrapping as available width requires.

## Verification

- Extend unit tests for the display-only empty state, suggestion invocation,
  and hiding suggestions after live messages exist.
- Extend focused browser coverage for panel header, composer controls, and
  suggestion action semantics.
- Run lint, typecheck, unit tests, and the focused Go-runtime browser test.

## Self-review

The new default conversation content is explicitly display-only, suggestion
clicks continue to use existing controller actions, and no backend or AI
protocol behavior changes.
