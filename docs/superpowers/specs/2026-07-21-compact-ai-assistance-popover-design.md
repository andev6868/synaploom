# Compact AI Assistance Popover Design

## Goal

Restyle the desktop quick AI assistance popover to use the visual language of
the approved Vietnamese mockup, while retaining its existing anchored,
compact size and every current AI interaction.

## Scope

- Change only `AssistantQuickPopover` and its styles.
- Keep the existing quick-popover positioning policy: it remains anchored to
  the invoking control and is at most 420px wide.
- Keep the existing mobile bottom-sheet behavior.
- Do not change request payloads, API routes, controller state, or the
  expanded conversation panel.

## Visual Composition

The popover is a scaled-down version of the mockup rather than a full-screen
chat surface:

1. **Header** — a soft blue/lilac gradient, compact AI glyph, "Trợ lý AI",
   context label, an expand button, and the existing close action.
2. **Conversation preview** — assistant greeting/response and latest user
   prompt appear as distinct small bubbles. Pending and error states retain
   their accessible live-region and alert semantics.
3. **Quick actions** — the current theory actions render as three compact,
   icon-led cards: "Giải thích", "Cho ví dụ", and "Tóm tắt". Practice keeps
   its existing action labels and request kinds, using the same card pattern.
4. **Composer** — a single-line, rounded prompt field and circular send
   control. The existing expand action remains available without competing
   with the primary send button.

## Interaction and Accessibility

- Existing `role="dialog"`, label, close control, keyboard focus, submit,
  disabled-state, loading, error, and expand behaviors remain unchanged.
- Decorative AI and action icons are `aria-hidden`; controls retain text or
  accessible labels.
- The component continues to use its current one-question controller state;
  this is a visual preview, not a new persisted chat transcript.

## Responsive Behavior

Desktop preserves the current 320–420px width and max-height constraints.
On narrow screens the current bottom-sheet media rule remains active; cards
may wrap but controls retain usable tap sizes.

## Verification

- Extend component tests for the new semantic controls and action labels.
- Run the focused assistant tests, lint, typecheck, and relevant browser
  coverage.
- Visually compare a desktop quick popover and a narrow mobile popover with
  the approved mockup's hierarchy, spacing, and hierarchy of actions.

## Self-review

This design is limited to the quick popover, explicitly retains the old size
and controller contract, and does not imply any change to expanded chat,
backend behavior, or mobile interaction.
