# Compact AI Assistance Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the quick AI assistance popover as a compact, mockup-inspired conversation surface without changing its size, controller contract, or API behavior.

**Architecture:** `AssistantQuickPopover` will derive a small display-only conversation preview from the controller's existing messages and response state. It will render semantic quick-action cards and an icon-led composer; CSS in the existing application stylesheet supplies the scaled header, bubbles, cards, and responsive rules. The controller, API contracts, and expanded conversation panel remain untouched.

**Tech Stack:** React 19, TypeScript, lucide-react, CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Change only the quick popover and its tests/styles; leave `AssistantConversationPanel`, controller state, API routes, and payloads unchanged.
- Preserve `assistantPopoverPosition` and its desktop width range of 320–420px.
- Preserve `role="dialog"`, the `Trợ lý AI` label, close/focus behavior, loading/error live regions, submit behavior, and the existing bottom-sheet mobile rule.
- Use existing `lucide-react`; do not add an avatar image or a dependency.
- Keep theory and practice request kinds and Vietnamese prompt copy exactly as they are today.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx` | Build the compact header, display-only chat preview, action cards, and accessible composer from existing controller data. |
| `apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx` | Cover the new semantic structure, previews, action submission, and preserved status/error behavior. |
| `apps/web/src/application.css` | Define the scaled mockup visual system and retain responsive quick-popover behavior. |
| `tests/e2e/single-active-workspace-go-runtime.spec.ts` | Keep browser coverage aligned with the quick-card and compact-size contract. |

### Task 1: Render a compact mockup-style quick popover

**Files:**

- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx`
- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx`

**Interfaces:**

- Consumes: unchanged `ContextualAssistantController` (`messages`, `response`, `prompt`, `status`, `error`, `submit`, `expand`, `close`).
- Produces: the same `AssistantQuickPopover` dialog and button labels, plus `assistant-quick-message-list`, `assistant-quick-actions`, and an accessible `Gửi` submit control.
- Leaves unchanged: `assistantPopoverPosition(anchor, boundary, source)` and all `submit(kind, promptOverride?)` calls.

- [ ] **Step 1: Write failing component tests for the visual semantics**

  In `AssistantQuickPopover.test.tsx`, import `Bot`, `Code2`, `Lightbulb`,
  `NotebookPen`, `SendHorizontal`, and `Maximize2` only in the component file;
  tests must query user-visible semantics instead of SVG implementation.
  Add this test after the existing Theory action test:

  ```tsx
  it('renders the compact conversation preview, action cards, and icon-led composer', () => {
    const { controller } = controllerFor({
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    const popover = screen.getByTestId('assistant-quick-popover');
    expect(popover.querySelector('[data-assistant-quick-avatar]')).toBeInTheDocument();
    expect(screen.getByText('Mình có thể giúp gì cho bạn?')).toBeVisible();
    expect(screen.getByLabelText('Các gợi ý của Trợ lý AI')).toHaveAttribute(
      'data-testid',
      'assistant-quick-actions',
    );
    expect(screen.getByRole('button', { name: 'Giải thích' })).toHaveTextContent(
      'Giải thích khái niệm',
    );
    expect(screen.getByRole('button', { name: 'Cho ví dụ' })).toHaveTextContent('Ví dụ minh hoạ');
    expect(screen.getByRole('button', { name: 'Tóm tắt' })).toHaveTextContent('Tóm tắt nội dung');
    expect(screen.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  });
  ```

  Add a message-preview test that uses the existing controller shape:

  ```tsx
  it('shows the latest user and assistant messages as chat bubbles', () => {
    const invocation: AssistantInvocation = {
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    };
    render(
      <AssistantQuickPopover
        controller={controllerWithState(invocation, {
          messages: [
            { id: 'user-1', role: 'user', content: 'Giải thích dòng chảy thuật toán', source: 'theory', contextLabel: 'Lý thuyết' },
            { id: 'assistant-1', role: 'assistant', content: 'Mình sẽ giải thích ngắn gọn và dễ hiểu.', source: 'theory', contextLabel: 'Lý thuyết' },
          ],
        })}
      />,
    );

    const messages = screen.getByLabelText('Tóm tắt cuộc hội thoại');
    expect(messages).toHaveTextContent('Giải thích dòng chảy thuật toán');
    expect(messages).toHaveTextContent('Mình sẽ giải thích ngắn gọn và dễ hiểu.');
    expect(messages.querySelector('[data-role="user"]')).toBeInTheDocument();
    expect(messages.querySelector('[data-role="assistant"]')).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: Run the focused test and verify the new semantic contract fails**

  Run:

  ```bash
  pnpm exec vitest run apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  ```

  Expected: FAIL because the avatar marker, welcome message, conversation summary, and action-card descriptions do not exist yet.

- [ ] **Step 3: Replace the old tuple actions with display metadata and derive the preview**

  In `AssistantQuickPopover.tsx`, replace the two tuple arrays with typed object arrays. Keep each original `kind` and `prompt` unchanged; add `description` and a local `icon` component:

  ```tsx
  import { Bot, Code2, Lightbulb, Maximize2, NotebookPen, SendHorizontal, X } from 'lucide-react';
  import type { LucideIcon } from 'lucide-react';

  type QuickAction = {
    readonly label: string;
    readonly description: string;
    readonly kind: AiRequestKind;
    readonly prompt: string;
    readonly icon: LucideIcon;
  };

  const theoryActions: readonly QuickAction[] = [
    { label: 'Giải thích', description: 'Giải thích khái niệm', kind: 'explain', prompt: 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.', icon: Lightbulb },
    { label: 'Cho ví dụ', description: 'Ví dụ minh hoạ', kind: 'explain', prompt: 'Cho một ví dụ cụ thể về nội dung này.', icon: Code2 },
    { label: 'Tóm tắt', description: 'Tóm tắt nội dung', kind: 'summarize', prompt: 'Tóm tắt các ý chính của nội dung này.', icon: NotebookPen },
  ];
  ```

  Define `practiceActions` with its current labels, request kinds, and prompts,
  descriptions `Gợi ý bước tiếp theo`, `Giải thích điểm cần xem lại`, and
  `Kiểm tra hướng làm`; reuse the three icons in the same visual order.

  Immediately before the component, add a pure display helper that keeps only
  the latest exchange and falls back to the existing response when there is no
  stored message yet:

  ```tsx
  function quickPreviewMessages(controller: ContextualAssistantController) {
    if (controller.messages.length > 0) return controller.messages.slice(-2);
    if (controller.response) {
      return [{ id: 'assistant-response', role: 'assistant' as const, content: controller.response }];
    }
    return [];
  }
  ```

- [ ] **Step 4: Render the header, preview, cards, and composer without changing controller calls**

  Replace the current header/body/footer children with this structure (retain
  the outer section, current `style`, dialog semantics, selected-text
  blockquote, pending/error logic, and close handler):

  ```tsx
  <header className="syn-contextual-assistant-popover__header">
    <span className="syn-contextual-assistant-popover__avatar" data-assistant-quick-avatar aria-hidden="true">
      <Bot size={20} strokeWidth={2.25} />
    </span>
    <div className="syn-contextual-assistant-popover__identity">
      <strong>Trợ lý AI</strong>
      <AssistantContextBadge invocation={invocation} />
    </div>
    <button type="button" className="syn-contextual-assistant__expand" aria-label="Mở cuộc hội thoại đầy đủ" onClick={() => controller.expand()}>
      <Maximize2 aria-hidden="true" size={16} />
    </button>
    <button type="button" className="syn-contextual-assistant__close" aria-label="Đóng Trợ lý AI" onClick={() => controller.close()}>
      <X aria-hidden="true" size={16} />
    </button>
  </header>
  <div className="syn-contextual-assistant-popover__body">
    {invocation.selectedText ? <blockquote>{invocation.selectedText.slice(0, 240)}</blockquote> : null}
    <div className="syn-contextual-assistant-popover__messages" aria-label="Tóm tắt cuộc hội thoại">
      {quickPreviewMessages(controller).length === 0 ? (
        <article data-role="assistant"><p>Mình có thể giúp gì cho bạn?</p></article>
      ) : quickPreviewMessages(controller).map((message) => (
        <article key={message.id} data-role={message.role}><p>{message.content}</p></article>
      ))}
    </div>
    <div className="syn-contextual-assistant-popover__actions" data-testid="assistant-quick-actions" aria-label="Các gợi ý của Trợ lý AI">
      {actions.map(({ label, description, kind, prompt, icon: Icon }) => (
        <button key={label} type="button" aria-label={label} disabled={pending} onClick={() => void controller.submit(kind, prompt)}>
          <Icon aria-hidden="true" size={18} /><span><strong>{label}</strong><small>{description}</small></span>
        </button>
      ))}
    </div>
  </div>
  ```

  Update the existing footer so its label remains `Câu hỏi`, its textarea
  retains the existing source-specific placeholder and controller value/change
  handler, and its submit button has `aria-label="Gửi"`, displays
  `<SendHorizontal aria-hidden="true" size={18} />`, and still calls
  `controller.submit('explain')`. Do not remove `role="status"` or the error
  `role="alert"`; place both immediately above the composer row.

- [ ] **Step 5: Run focused tests and TypeScript validation**

  Run:

  ```bash
  pnpm exec vitest run apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  pnpm typecheck
  ```

  Expected: the component test file passes and TypeScript finds no icon or
  controller-type errors.

- [ ] **Step 6: Commit the semantic component change**

  ```bash
  git add apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx
  git commit -m "feat: redesign compact AI quick popover"
  ```

### Task 2: Apply the scaled mockup visual system and verify it in a browser

**Files:**

- Modify: `apps/web/src/application.css:2352-2502`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts:422-470`

**Interfaces:**

- Consumes: the semantic classes and data attributes introduced in Task 1.
- Produces: a 320–420px desktop quick popover with a compact gradient header,
  chat bubbles, three icon cards, and a circular composer send button.
- Preserves: the existing `@media (max-width: 719px)` bottom-sheet selector and
  `assistant-quick-popover` browser test id.

- [ ] **Step 1: Add a failing browser assertion for the compact action-card surface**

  In the existing `keeps contextual AI zero-footprint...` Playwright test,
  immediately after `await expect(quick).toBeVisible();`, add:

  ```ts
  await expect(quick.getByTestId('assistant-quick-actions')).toBeVisible();
  await expect(quick.getByTestId('assistant-quick-actions').getByRole('button')).toHaveCount(3);
  await expect(quick.getByLabel('Gửi')).toBeDisabled();
  ```

  After calculating `practiceQuickBox`, add an explicit retained-size check:

  ```ts
  expect(practiceQuickBox.width).toBeLessThanOrEqual(420);
  expect(practiceQuickBox.width).toBeGreaterThanOrEqual(320);
  ```

- [ ] **Step 2: Run the focused browser test and verify it fails before Task 1 is complete**

  Run:

  ```bash
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: FAIL until the quick-actions test id and labelled send button are
  rendered by Task 1. If macOS screenshots are unavailable, use this focused
  non-screenshot assertion and report the platform-baseline limitation rather
  than generating committed snapshots.

- [ ] **Step 3: Replace the old popover visual rules with compact mockup rules**

  In `application.css`, replace the rules from
  `.syn-contextual-assistant-popover` through
  `.syn-contextual-assistant-popover__footer textarea` with rules that satisfy
  the following exact layout contract:

  ```css
  .syn-contextual-assistant-popover {
    grid-template-rows: auto minmax(0, 1fr) auto;
    border: 1px solid color-mix(in srgb, var(--syn-color-primary) 18%, var(--syn-color-border));
    border-radius: 1rem;
    background: var(--syn-color-surface);
    box-shadow: 0 18px 48px rgb(15 23 42 / 18%);
  }

  .syn-contextual-assistant-popover__header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--syn-color-border);
    background: linear-gradient(120deg, #f7faff 0%, #eef3ff 58%, #faf8ff 100%);
  }

  .syn-contextual-assistant-popover__avatar,
  .syn-contextual-assistant__expand,
  .syn-contextual-assistant__close {
    display: grid;
    place-items: center;
    flex: none;
  }

  .syn-contextual-assistant-popover__avatar {
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid rgb(255 255 255 / 85%);
    border-radius: 50%;
    background: radial-gradient(circle at 35% 25%, #dbeafe, #dbeafe 34%, #2563eb 100%);
    color: white;
    box-shadow: 0 6px 16px rgb(37 99 235 / 24%);
  }
  ```

  Add complementary rules with these constraints:

  - identity text is min-width `0`, header title is `1rem`/`700`, and the
    context badge truncates with ellipsis instead of increasing popover width;
  - the expand and close buttons are separate 2rem circular/squircle controls;
  - messages use a `0.5rem` gap; assistant bubbles align start on a soft white
    surface, user bubbles align end with pale blue fill, and message paragraphs
    have no default margin;
  - action grid is three equal columns above 360px and wraps to two columns on
    narrower desktop widths; each button has 44px minimum height, visible
    focus outline, icon circle, title, and muted description;
  - footer contains one bordered composer row; label is visually hidden but
    stays available to assistive technology; textarea has 2.75rem min-height
    and no resize handle; submit button is a 2.5rem blue circle;
  - selected-text blockquote and status/error styles remain readable in the
    shortened body and do not remove their existing semantics.

  Keep the existing mobile media query but add a one-column action grid inside
  it; do not change its `inset`, `width`, or bottom-sheet border radius.

- [ ] **Step 4: Run focused visual validation**

  Start the existing local dev workflow and open the lesson's quick AI trigger.
  Validate at desktop width and at `390×844`:

  ```bash
  pnpm dev:full -- examples/frontend-performance-foundations
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: the desktop popover remains inside its source pane at 320–420px,
  exposes the three compact cards, and mobile remains a usable bottom sheet.

- [ ] **Step 5: Run final relevant checks**

  Run:

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'
  ```

  Expected: every command exits `0`. If an unrelated macOS visual-snapshot
  baseline test fails, record the exact existing baseline absence separately;
  do not update platform snapshots as part of this task.

- [ ] **Step 6: Commit visual styling and browser coverage**

  ```bash
  git add apps/web/src/application.css tests/e2e/single-active-workspace-go-runtime.spec.ts
  git commit -m "style: match compact AI popover mockup"
  ```

## Plan self-review

- **Spec coverage:** Task 1 implements the quick-popover-only markup,
  preserved controller behavior, prompt/action labels, conversation preview,
  and accessibility. Task 2 implements the scaled desktop mockup, the mobile
  bottom-sheet constraint, retained width, and browser verification.
- **Scope:** No task changes the controller, AI API, expanded conversation
  panel, dependencies, or persisted conversation model.
- **Placeholder scan:** This plan has no `TBD`, deferred implementation, or
  unspecified test steps.
- **Type consistency:** Every new identifier in Task 2 is introduced in Task
  1; controller calls preserve the current `submit(kind, promptOverride?)`
  interface.
