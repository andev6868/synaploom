# Contextual AI Assistant Design

**Status:** Approved design

**Date:** 2026-07-21

## 1. Objective

Replace the permanent bottom AI dock with a contextual assistant that supports both learning surfaces:

- ask about the theory currently being read;
- ask about the activity currently being completed;
- ask about a specific selected passage or practice item;
- continue a longer conversation without permanently reducing the workspace.

The chosen interaction model combines:

1. **Quick Ask:** visible `Hỏi AI` entry points in Theory and Practice;
2. **Selection Context:** a contextual action for a selected theory passage or a specific practice item;
3. **Progressive disclosure:** a compact answer popover first, then an expanded conversation panel only when needed.

AI must occupy **zero permanent workspace area while closed**.

## 2. Problem with the Current Dock

The current implementation reserves a fixed bottom row in `LearningWorkspaceShell` and renders `AssistantDock` across most of the workspace width. This causes four structural problems:

- it competes with Theory completion content and the Practice footer;
- it reduces the usable vertical viewport for every learner, including learners who never use AI;
- it provides one global entry point even though Theory and Practice require different context;
- it presents AI as a permanent fourth workspace region rather than an optional learning tool.

Moving the full assistant into `syn-practice-activity-navigator` is also rejected. That surface is intentionally narrow and has a single responsibility: activity navigation and progress. A chat interface there would either hide navigation or force the column to become wide enough to damage the Theory/Practice proportions.

## 3. Chosen Experience: Hybrid Quick Ask + Selection Context

### 3.1 Default workspace

The default layout remains:

```text
Theory | Practice | Activity Navigator
```

There is no assistant row, assistant column, floating launcher, or AI tab in the Activity Navigator.

Two compact entry points are available:

- `Hỏi AI` in the Theory surface;
- `Hỏi AI` in the Practice header.

The triggers are visible without scrolling, but are visually secondary to learning and submission actions.

### 3.2 Quick Ask from Theory

Opening AI from Theory creates a compact popover anchored to the Theory trigger. Its initial context is:

- current course, chapter, and lesson;
- current Theory section when it can be resolved;
- selected text when a valid Theory selection exists.

The header identifies the source explicitly, for example:

```text
Lý thuyết · Thuật toán là gì?
```

The quick actions are Theory-specific:

- `Giải thích`;
- `Cho ví dụ`;
- `Tóm tắt`.

### 3.3 Quick Ask from Practice

Opening AI from Practice anchors the same popover pattern to the Practice trigger. Its context is:

- focused activity identifier and title;
- activity definition and instructions;
- current attempt state derived by the daemon;
- latest validation/check result when available;
- selected or explicitly targeted practice item when present.

The header identifies the source explicitly, for example:

```text
Bài tập · Sắp xếp thuật toán
```

The quick actions are Practice-specific:

- `Gợi ý`;
- `Giải thích lỗi`;
- `Kiểm tra cách làm`.

AI must not submit, reorder, edit, or complete an activity on the learner's behalf.

### 3.4 Selection Context

Selection Context supplements the visible triggers; it does not replace them.

#### Theory selection

When the learner selects valid text inside the Theory reading surface, a small contextual toolbar appears close to the selection with one primary action:

```text
Hỏi AI
```

Rules:

- selection must originate entirely inside the Theory content zone;
- whitespace-only selections are ignored;
- the normalized selection length is limited to 2,000 Unicode characters;
- the toolbar disappears when the selection collapses, the user presses `Escape`, or focus moves to an unrelated workspace surface;
- the original selected text remains visibly selected until the Quick Ask popover is opened.

#### Practice item targeting

Practice activities must not overload text selection or row clicks because those interactions may already be used for dragging, ordering, editing, or choosing answers.

A practice renderer exposes an explicit accessible context action for a targetable item, such as:

```text
Hỏi AI về bước này
```

This action may appear in an item action menu or as a compact icon button. It must not change the answer state, trigger drag behavior, or submit the activity.

## 4. Quick Answer Popover

The popover is the default AI surface.

### 4.1 Geometry

Desktop target:

- width: `clamp(22.5rem, 28vw, 26.25rem)`;
- maximum height: `min(60vh, 34rem)`;
- positioned against the invoking trigger or selection anchor;
- shifted to remain inside the workspace viewport;
- never changes grid column widths or workspace height.

Tablet target:

- width constrained to the active Theory or Practice surface where possible;
- otherwise centered inside the workspace with safe margins.

Mobile target:

- compact bottom sheet for Quick Ask;
- expanded conversation uses a full-screen dialog.

### 4.2 Content

The popover contains:

1. source and context label;
2. optional bounded context preview;
3. one short response area;
4. source-specific quick actions;
5. prompt composer and send action;
6. `Mở cuộc hội thoại đầy đủ` action.

A short response may contain paragraphs, a small list, or a compact code fragment. Large tables, long code, or multi-turn discussion should transition to the expanded panel.

### 4.3 Interaction

- `Escape` closes the popover and returns focus to the invoking control.
- Clicking outside closes it unless a request is actively being submitted.
- Sending a prompt keeps the popover open and renders the response in place.
- A second trigger changes context only after the user explicitly invokes it; background focus changes must not silently retarget an open conversation.
- Opening a new source while an unsent prompt exists requires a lightweight confirmation or preserves the draft per source.

## 5. Expanded Conversation Panel

The expanded panel supports longer conversations while remaining temporary.

### 5.1 Desktop behavior

The panel opens from the right edge of the workspace:

- width: `clamp(26.25rem, 36vw, 35rem)`;
- top aligned below the application header;
- bottom aligned to the workspace boundary;
- overlays Activity Navigator and part of Practice instead of resizing the underlying grid;
- no permanent backdrop;
- underlying uncovered content remains readable and interactive.

The panel is non-modal on desktop. It receives focus when opened, supports `Escape`, and returns focus to the originating trigger when closed.

### 5.2 Mobile behavior

On mobile, the expanded assistant is a modal full-screen dialog with focus containment and an explicit close action.

### 5.3 Conversation continuity

There is one conversation session per lesson or chapter-assessment workspace instance. Each user and assistant message records a context badge:

- `Lý thuyết`;
- `Bài tập`;
- `Đoạn được chọn`;
- `Bước được chọn`.

Changing context does not erase previous messages. The current composer context is always visible before submission. Conversation persistence across application restarts is outside this design.

## 6. Context and Security Contract

The browser must not send arbitrary filesystem content, complete lesson documents, answer-state objects, provider credentials, or constructed daemon context.

Extend the browser command with bounded, validated identifiers only:

```ts
export type AiContextSource = 'theory' | 'practice';

export interface AiGenerateCommand {
  readonly kind: AiRequestKind;
  readonly prompt: string;
  readonly source: AiContextSource;
  readonly activityId?: string;
  readonly selectedText?: string;
}
```

Rules:

- `activityId` is accepted only for `source: 'practice'`;
- the daemon validates that the activity belongs to the active lesson or assessment;
- `selectedText` is normalized and capped at 2,000 Unicode characters;
- the daemon remains the authority that constructs `lessonText`, activity instructions, editable files, attempt state, and latest check message;
- invalid context returns a localized validation error and does not call the provider.

The UI keeps a local view model separate from the provider contract:

```ts
type AssistantInvocation =
  | {
      readonly source: 'theory';
      readonly sectionTitle?: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    }
  | {
      readonly source: 'practice';
      readonly activityId: string;
      readonly activityTitle: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    };
```

DOM anchors never cross the API boundary.

## 7. Component Architecture

### 7.1 Workspace-level controller

A single assistant controller is mounted at the lesson/assessment composition level. It owns:

- closed, quick, and expanded presentation state;
- active invocation context;
- prompt drafts by source;
- request lifecycle and stale-response protection;
- in-memory conversation messages;
- focus restoration.

The state model is explicit:

```ts
type AssistantSurfaceState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'quick'; readonly invocation: AssistantInvocation }
  | { readonly kind: 'expanded'; readonly invocation: AssistantInvocation };
```

### 7.2 UI boundaries

Create focused UI units instead of expanding the current dock component:

- `AssistantTrigger`: reusable Theory/Practice entry action;
- `AssistantSelectionToolbar`: action anchored to a valid selection;
- `AssistantQuickPopover`: compact single-response interface;
- `AssistantConversationPanel`: expanded multi-turn interface;
- `AssistantContextBadge`: source and target identity;
- `useTheoryAssistantSelection`: selection validation and anchor calculation;
- `useContextualAssistant`: controller and API request coordination.

The current `AssistantDock` is retired from the learning workspace. It may remain temporarily in the design-system package only if another consumer still uses it; otherwise it should be removed with its tests and styles.

### 7.3 Workspace integration

`LearningWorkspaceShell` no longer receives an `assistant` slot and no longer reserves an assistant grid row. The contextual overlays mount inside the workspace composition layer above Theory, Practice, and Navigator.

Theory and Practice receive callbacks rather than importing assistant implementation details:

```ts
onAskTheory(context)
onAskPractice(context)
```

Activity renderers expose optional target context through a narrow callback and do not call the AI API directly.

## 8. Request Lifecycle and Errors

- Only one generation request may be active per assistant controller.
- Repeated submit actions while pending are disabled.
- Every request has an identity; a response is ignored if its request or invocation is no longer current.
- Closing the surface aborts the active request when supported.
- Provider-disabled is an informative assistant state, not a workspace error.
- Network and validation failures use localized, actionable copy inside the assistant surface.
- The learner's prompt remains available after a recoverable failure.
- AI failure never blocks Theory reading, Practice editing, checking, saving, navigation, or lesson completion.

## 9. Accessibility

- Both persistent triggers have explicit labels that identify their source.
- Quick Ask uses a non-modal dialog/popover pattern with labelled title and context.
- Expanded desktop panel is non-modal and keyboard reachable; expanded mobile panel is modal.
- Focus moves to the composer on open and returns to the invoking control on close.
- `Escape` closes the topmost assistant surface.
- Selection Context is not hover-only and has an equivalent keyboard path.
- Practice item AI actions must be separate from drag handles and answer controls.
- Pending, response, disabled, and error states are announced through appropriate live regions without reading the full conversation repeatedly.
- Reduced-motion preferences disable panel and popover transitions.

## 10. Responsive Contract

### Wide three-column (`wide-three`)

- Theory and Practice triggers are visible.
- Quick popover anchors to its source.
- Expanded panel overlays Navigator and part of Practice.

### Wide two-column (`wide-two`)

- Triggers remain visible.
- Quick popover is constrained to the active surface.
- Expanded panel overlays from the right edge; Activity Navigator drawer state is preserved independently.

### Compact

- Trigger appears in the active segment header.
- Quick Ask is centered or rendered as a large popover within the active surface.
- Expanded panel behaves as a near-full-width side sheet.

### Mobile

- Trigger is available in Theory and the Practice dialog header.
- Selection Context uses an action sheet rather than a floating toolbar.
- Quick Ask is a bottom sheet.
- Expanded conversation is full screen.

## 11. Testing Strategy

### Unit and component tests

- Theory trigger opens Quick Ask with `source: 'theory'`.
- Practice trigger opens Quick Ask with the focused activity identifier.
- Theory selection is bounded, normalized, and sent as `selectedText`.
- Selection outside Theory is ignored.
- Practice item AI action does not mutate or reorder the answer.
- Expanding preserves invocation context, prompt, and messages.
- Switching context cannot apply a stale response to the new context.
- Disabled and error states preserve normal learning interactions.
- Closing restores focus to the correct trigger.
- `LearningWorkspaceShell` no longer renders or reserves the bottom assistant row.

### Browser behavior tests

- AI occupies no layout space while closed at canonical desktop viewport.
- Popover stays inside viewport boundaries near both Theory and Practice triggers.
- Expanded panel does not resize Theory/Practice columns.
- Activity Navigator state survives open/close of the expanded panel.
- Selection toolbar appears only for valid Theory selections.
- Mobile bottom sheet and full-screen assistant follow their focus contracts.

### Visual regression

Add snapshots for:

- default workspace with AI closed;
- Theory Quick Ask;
- Practice Quick Ask;
- Theory selection toolbar;
- expanded desktop conversation;
- mobile Quick Ask and expanded conversation.

## 12. Migration Sequence

1. Introduce the assistant invocation/controller model and command contract.
2. Add Theory and Practice triggers with Quick Ask.
3. Remove the permanent assistant slot and bottom-row CSS.
4. Add Theory selection context.
5. Add explicit Practice item context actions to supported renderers.
6. Add expanded conversation panel and responsive surfaces.
7. Remove obsolete `AssistantDock` usage and superseded snapshots.

Each step must leave the lesson fully usable when AI is disabled.

## 13. Non-goals

- persistent cross-session conversation history;
- cross-course learner memory;
- autonomous AI actions in an activity;
- AI-generated grading or completion decisions;
- automatic opening based on learner behavior;
- streaming provider responses in the first implementation;
- replacing authored hints, validation, or lesson content;
- widening or repurposing Activity Navigator for chat.

## 14. Acceptance Criteria

The design is accepted when:

- the default workspace contains no permanent AI surface or reserved AI area;
- learners can invoke AI from both Theory and Practice without choosing context manually;
- a valid selection or explicit practice item can refine the context;
- short answers remain in a compact popover;
- longer conversations expand without reflowing the three-column workspace;
- Activity Navigator remains dedicated to navigation;
- the daemon, not the browser, constructs trusted lesson and activity context;
- AI-disabled and AI-error states never block core learning actions;
- keyboard, focus, responsive, and reduced-motion contracts are covered by tests.
