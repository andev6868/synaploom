# AI Popover Conversation States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a display-only three-message mock conversation to the compact AI quick popover, hide quick-action cards while chat is displayed, and let the learner reveal them again.

**Architecture:** `AssistantQuickPopover` derives either its latest controller messages/response or a fixed local preview. A local boolean controls whether the action cards are temporarily revealed; it is scoped to the mounted quick popover. CSS allocates one additional compact body row and styles the action-toggle affordance without changing controller or API code.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Do not change `ContextualAssistantController`, backend routes, request payloads, or the expanded assistant panel.
- Preserve the existing 320–420px positioning policy, quick-popover dialog semantics, and mobile bottom-sheet behavior.
- Mock text is display-only: it must not be added to `controller.messages`, persisted, or submitted to AI.
- Retain the current action labels, request kinds, and prompts when cards are revealed.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx` | Derive sample/live preview, own the local action-card visibility toggle, and render the `Xem gợi ý` affordance. |
| `apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx` | Verify mock bubbles, hidden cards, and reopening cards without changing AI controller calls. |
| `apps/web/src/application.css` | Increase body room and style the compact text action-toggle. |
| `tests/e2e/single-active-workspace-go-runtime.spec.ts` | Verify the quick popover exposes mock conversation and can reveal its action group in a browser. |

### Task 1: Add preview state and action re-enable control

**Files:**

- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx`

**Interfaces:**

- Consumes: unchanged `ContextualAssistantController.messages`, `response`, `submit`, and quick invocation state.
- Produces: a `Tóm tắt cuộc hội thoại` group with three fixed sample bubbles when live history is absent; an action group that is hidden by default while preview bubbles are present; a `Xem gợi ý` button with `aria-expanded`.
- Leaves unchanged: `assistantPopoverPosition`, request kinds, action prompts, close behavior, and composer submit behavior.

- [ ] **Step 1: Write failing tests for default mock conversation and action reveal**

  Update the existing Theory-action test to click `Xem gợi ý` before finding
  `Giải thích`, then replace the expectation for a single welcome message in
  the compact-preview test with these assertions:

  ```tsx
  expect(screen.getByText('Mình có thể giúp gì cho bạn?')).toBeVisible();
  expect(screen.getByText('Giải thích dòng chảy thuật toán')).toBeVisible();
  expect(screen.getByText('Mình sẽ giải thích ngắn gọn và dễ hiểu.')).toBeVisible();
  expect(screen.queryByTestId('assistant-quick-actions')).not.toBeInTheDocument();

  const reveal = screen.getByRole('button', { name: 'Xem gợi ý' });
  expect(reveal).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(reveal);
  expect(reveal).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('assistant-quick-actions')).toBeVisible();
  ```

  Add a dedicated live-message test that renders the two existing controller
  messages and asserts the action group is initially absent and becomes visible
  after clicking `Xem gợi ý`.

- [ ] **Step 2: Run the component test and confirm it fails because current cards remain visible**

  Run:

  ```bash
  pnpm exec vitest run apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  ```

  Expected: FAIL at the absent-card assertion because the current implementation
  renders `assistant-quick-actions` immediately and does not render three mock
  bubbles or `Xem gợi ý`.

- [ ] **Step 3: Add display-only preview constants and local reveal state**

  In `AssistantQuickPopover.tsx`, import `useState` and add this immutable
  preview alongside `QuickPreviewMessage`:

  ```tsx
  const mockPreviewMessages: readonly QuickPreviewMessage[] = [
    { id: 'mock-assistant-greeting', role: 'assistant', content: 'Mình có thể giúp gì cho bạn?' },
    { id: 'mock-user-question', role: 'user', content: 'Giải thích dòng chảy thuật toán' },
    { id: 'mock-assistant-answer', role: 'assistant', content: 'Mình sẽ giải thích ngắn gọn và dễ hiểu.' },
  ];
  ```

  Change `quickPreviewMessages` so empty controller history and no response
  returns `mockPreviewMessages`. In the component, add:

  ```tsx
  const [revealedForState, setRevealedForState] = useState<
    ContextualAssistantController['state'] | null
  >(null);
  const actionsRevealed = revealedForState === controller.state;
  const showActions = previewMessages.length === 0 || actionsRevealed;
  ```

  Render the action group only when `showActions` is true. When false, render:

  ```tsx
  <button
    type="button"
    className="syn-contextual-assistant-popover__show-actions"
    aria-expanded={actionsRevealed}
    aria-controls="assistant-quick-actions"
    onClick={() => setRevealedForState(controller.state)}
  >
    Xem gợi ý
  </button>
  ```

  Give the action group `id="assistant-quick-actions"` while retaining its
  current test id and label. Comparing the stored state identity to
  `controller.state` resets local reveal state whenever the controller switches
  invocation or closes the quick popover, without an effect-driven render.

- [ ] **Step 4: Run focused tests and typecheck**

  Run:

  ```bash
  pnpm exec vitest run apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  pnpm typecheck
  ```

  Expected: all component tests pass, and TypeScript reports no state or
  controller-contract errors.

- [ ] **Step 5: Commit component behavior and unit coverage**

  ```bash
  git add apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  git commit -m "feat: add AI popover mock conversation"
  ```

### Task 2: Increase compact body space and verify the toggle in the browser

**Files:**

- Modify: `apps/web/src/application.css:2353-2630`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts:422-452`

**Interfaces:**

- Consumes: `syn-contextual-assistant-popover__show-actions` and the action
  group id introduced in Task 1.
- Produces: slightly increased vertical room for the message group and a clear
  secondary action control above the composer.
- Preserves: popover source-pane bounds, max width, and the narrow-screen
  bottom-sheet rule.

- [ ] **Step 1: Write a failing browser assertion for message preview and reveal control**

  In the existing contextual-AI Playwright test, after opening `quick`, add:

  ```ts
  await expect(quick.getByText('Mình có thể giúp gì cho bạn?')).toBeVisible();
  await expect(quick.getByText('Giải thích dòng chảy thuật toán')).toBeVisible();
  await expect(quick.getByText('Mình sẽ giải thích ngắn gọn và dễ hiểu.')).toBeVisible();
  await expect(quick.getByTestId('assistant-quick-actions')).toHaveCount(0);
  await quick.getByRole('button', { name: 'Xem gợi ý' }).click();
  await expect(quick.getByTestId('assistant-quick-actions')).toBeVisible();
  ```

  Add a computed-style assertion after the existing `quickVisuals` call:

  ```ts
  expect(
    await quick.locator('.syn-contextual-assistant-popover__body').evaluate(
      (element) => getComputedStyle(element).minHeight,
    ),
  ).toBe('176px');
  ```

- [ ] **Step 2: Build/stage the web asset and run the focused browser test to verify it fails**

  Run:

  ```bash
  pnpm go:stage-web
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: FAIL before Task 1/Task 2 implementation because the current
  bundle has no static three-message preview, reveal button, or 176px body
  minimum.

- [ ] **Step 3: Add only the required compact CSS rules**

  In `application.css`, add this rule to the existing popover body:

  ```css
  .syn-contextual-assistant-popover__body {
    min-height: 11rem;
  }
  ```

  Add the secondary toggle immediately after the action-card rules:

  ```css
  .syn-contextual-assistant-popover__show-actions {
    justify-self: start;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--syn-color-primary);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 650;
    cursor: pointer;
  }

  .syn-contextual-assistant-popover__show-actions:hover,
  .syn-contextual-assistant-popover__show-actions:focus-visible {
    text-decoration: underline;
  }
  ```

  Do not increase width, alter popover positioning, or add a mobile-only
  layout override; the current action-grid mobile rule applies after reveal.

- [ ] **Step 4: Format, stage assets, and run focused browser verification**

  Run:

  ```bash
  pnpm exec prettier --write apps/web/src/application.css tests/e2e/single-active-workspace-go-runtime.spec.ts
  pnpm go:stage-web
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: the popover shows the mock exchange, actions stay hidden until
  `Xem gợi ý`, and remains inside its source pane.

- [ ] **Step 5: Run final relevant checks**

  Run:

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: all commands exit `0`. If an unrelated macOS visual-snapshot
  baseline is absent, report it without generating new snapshots.

- [ ] **Step 6: Commit styling, browser coverage, and generated assets**

  ```bash
  git add apps/web/src/application.css tests/e2e/single-active-workspace-go-runtime.spec.ts internal/webassets/dist internal/webassets/inventory.json
  git commit -m "style: expand AI popover conversation preview"
  ```

## Plan self-review

- **Spec coverage:** Task 1 supplies the fixed display-only mock exchange,
  local action reveal state, and accessible action toggle. Task 2 supplies the
  increased body room, toggle styling, generated asset staging, and browser
  verification.
- **Scope:** Neither task changes controller state, AI API, the expanded panel,
  or the compact width/position policy.
- **Placeholder scan:** The plan contains no incomplete implementation steps.
- **Type consistency:** `QuickPreviewMessage`, `actionsRevealed`,
  `assistant-quick-actions`, and `syn-contextual-assistant-popover__show-actions`
  are defined before use and use the existing controller interface unchanged.
