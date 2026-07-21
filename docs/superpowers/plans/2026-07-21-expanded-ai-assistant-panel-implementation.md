# Expanded AI Assistant Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the expanded contextual AI panel match the approved spacious conversation mockup while preserving the current AI controller behavior.

**Architecture:** Extract the contextual action metadata from the compact popover into one shared catalog so the panel and popover submit identical request kinds and prompt overrides. Render a display-only starter conversation and action cards only when the expanded controller has no messages; live messages replace that starter state. Restyle the existing panel, message list, and composer rather than introducing a new surface or controller state.

**Tech Stack:** React 19, TypeScript, lucide-react, Vitest with Testing Library, Playwright, CSS custom properties, Go embedded web assets.

## Global Constraints

- Preserve `ContextualAssistantController` and all AI request/API contracts unchanged.
- Keep greeting and guidance content display-only; never add it to `controller.messages` or submit it.
- Retain the compact quick popover and its existing text, controls, and request behavior.
- Hide expanded-panel suggestions after the first live conversation message.
- Preserve desktop complementary semantics, mobile dialog semantics, live status, error alert, close behavior, and keyboard submission.
- Do not make the decorative add, microphone, or expanded-view visual affordances perform an unavailable action.
- Regenerate `internal/webassets` after web-source changes before running Go-runtime browser coverage.

---

## File Structure

- Create: `apps/web/src/features/ai-assistant/assistant-actions.ts` — shared theory/practice action metadata and selector.
- Create: `apps/web/src/features/ai-assistant/assistant-actions.test.ts` — catalog request-kind/prompt regression tests.
- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx` — consume the shared catalog without changing compact behavior.
- Modify: `apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx` — render the starter state, shared suggestion cards, full mockup header, and composer adornments.
- Modify: `apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx` — cover empty starter state, action submission, and live-message replacement.
- Modify: `apps/web/src/application.css` — widen and restyle only the expanded panel and its responsive layout.
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts` — assert expanded-panel semantics, starter cards, and widened desktop geometry.
- Regenerate: `internal/webassets/dist/**`, `internal/webassets/inventory.json` — checked-in Go runtime assets produced by `go:stage-web`.

### Task 1: Centralize contextual action metadata

**Files:**
- Create: `apps/web/src/features/ai-assistant/assistant-actions.ts`
- Create: `apps/web/src/features/ai-assistant/assistant-actions.test.ts`
- Modify: `apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx:1-94`

**Interfaces:**
- Consumes: `AssistantInvocation` from `contextual-assistant-model.ts` and `AiRequestKind` from `@synaploom/ai-contracts`.
- Produces: `AssistantAction` and `assistantActionsForInvocation(invocation: AssistantInvocation): readonly AssistantAction[]` for both assistant surfaces.

- [ ] **Step 1: Write the failing catalog test**

```ts
import { describe, expect, it } from 'vitest';
import { assistantActionsForInvocation } from '#src/features/ai-assistant/assistant-actions';

describe('assistantActionsForInvocation', () => {
  it('returns the approved theory labels and request payloads', () => {
    const actions = assistantActionsForInvocation({
      source: 'theory',
      sectionTitle: 'Dòng chảy thuật toán',
      anchor: new DOMRect(),
    });

    expect(actions.map(({ label }) => label)).toEqual(['Giải thích', 'Cho ví dụ', 'Tóm tắt']);
    expect(actions.map(({ kind, prompt }) => [kind, prompt])).toEqual([
      ['explain', 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.'],
      ['explain', 'Cho một ví dụ cụ thể về nội dung này.'],
      ['summarize', 'Tóm tắt các ý chính của nội dung này.'],
    ]);
  });
});
```

- [ ] **Step 2: Run the catalog test to verify it fails**

Run: `pnpm test -- apps/web/src/features/ai-assistant/assistant-actions.test.ts`

Expected: FAIL because `assistant-actions` does not exist.

- [ ] **Step 3: Add the shared catalog and consume it from the quick popover**

```ts
// apps/web/src/features/ai-assistant/assistant-actions.ts
import type { AiRequestKind } from '@synaploom/ai-contracts';
import { Code2, Lightbulb, NotebookPen, type LucideIcon } from 'lucide-react';
import type { AssistantInvocation } from '#src/features/ai-assistant/contextual-assistant-model';

export type AssistantAction = {
  readonly label: string;
  readonly description: string;
  readonly kind: AiRequestKind;
  readonly prompt: string;
  readonly icon: LucideIcon;
  readonly tone: 'blue' | 'green' | 'violet';
};

const theoryActions: readonly AssistantAction[] = [
  { label: 'Giải thích', description: 'Giải thích khái niệm', kind: 'explain', prompt: 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.', icon: Lightbulb, tone: 'blue' },
  { label: 'Cho ví dụ', description: 'Ví dụ minh hoạ', kind: 'explain', prompt: 'Cho một ví dụ cụ thể về nội dung này.', icon: Code2, tone: 'green' },
  { label: 'Tóm tắt', description: 'Tóm tắt nội dung', kind: 'summarize', prompt: 'Tóm tắt các ý chính của nội dung này.', icon: NotebookPen, tone: 'violet' },
];

const practiceActions: readonly AssistantAction[] = [
  { label: 'Gợi ý', description: 'Gợi ý bước tiếp theo', kind: 'hint', prompt: 'Cho một gợi ý tiếp theo nhưng không đưa đáp án hoàn chỉnh.', icon: Lightbulb, tone: 'blue' },
  { label: 'Giải thích lỗi', description: 'Giải thích điểm cần xem lại', kind: 'explain-check-failure', prompt: 'Giải thích lỗi trong cách làm hiện tại.', icon: Code2, tone: 'green' },
  { label: 'Kiểm tra cách làm', description: 'Kiểm tra hướng làm', kind: 'explain', prompt: 'Kiểm tra hướng làm hiện tại và nêu điểm cần xem lại.', icon: NotebookPen, tone: 'violet' },
];

export function assistantActionsForInvocation(
  invocation: AssistantInvocation,
): readonly AssistantAction[] {
  return invocation.source === 'theory' ? theoryActions : practiceActions;
}
```

Delete the two local action arrays and now-unused `AiRequestKind`, `Code2`,
`Lightbulb`, `NotebookPen`, and `LucideIcon` imports from
`AssistantQuickPopover.tsx`. Replace the popover's local action selection with:

```ts
const actions = assistantActionsForInvocation(invocation);
```

- [ ] **Step 4: Run focused assistant component tests**

Run: `pnpm test -- apps/web/src/features/ai-assistant/assistant-actions.test.ts apps/web/src/features/ai-assistant/AssistantQuickPopover.test.tsx`

Expected: PASS; the catalog test proves theory payloads, and existing compact-popover tests prove the extraction preserved its behavior.

- [ ] **Step 5: Commit the shared catalog**

```bash
git add apps/web/src/features/ai-assistant/assistant-actions.ts \
  apps/web/src/features/ai-assistant/assistant-actions.test.ts \
  apps/web/src/features/ai-assistant/AssistantQuickPopover.tsx
git commit -m "refactor: share contextual AI actions"
```

### Task 2: Render the expanded starter conversation and contextual suggestions

**Files:**
- Modify: `apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx:1-109`
- Modify: `apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx:6-113`

**Interfaces:**
- Consumes: `assistantActionsForInvocation(invocation)`, `ContextualAssistantController.submit(kind, promptOverride?)`, and `controller.messages`.
- Produces: `data-testid="assistant-expanded-actions"` only while `controller.messages.length === 0`; all action buttons invoke `submit(action.kind, action.prompt)`.

- [ ] **Step 1: Write failing empty-state and live-state tests**

Extend the test helper so it accepts `Partial<ContextualAssistantController>` overrides, then add:

```tsx
function expandedController(
  overrides: Partial<ContextualAssistantController> = {},
): {
  readonly controller: ContextualAssistantController;
  readonly close: ReturnType<typeof vi.fn>;
  readonly setPrompt: ReturnType<typeof vi.fn>;
  readonly submit: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const setPrompt = vi.fn();
  const submit = vi.fn(() => Promise.resolve());
  return {
    close,
    setPrompt,
    submit,
    controller: {
      target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
      state: { kind: 'expanded', invocation: { source: 'practice', activityId: 'ordering', activityTitle: 'Sắp xếp thuật toán', anchor: new DOMRect(10, 10, 20, 20) } },
      prompt: 'Giải thích bước này',
      messages: [
        { id: 'user-1', role: 'user', content: 'Vì sao bước này sai?', source: 'practice', contextLabel: 'Bài tập · Sắp xếp thuật toán' },
        { id: 'assistant-1', role: 'assistant', content: 'Cần tính trước khi hiển thị.', source: 'practice', contextLabel: 'Bài tập · Sắp xếp thuật toán' },
      ],
      response: null,
      status: 'idle',
      error: null,
      openQuick: vi.fn(),
      expand: vi.fn(),
      close,
      setPrompt,
      submit,
      ...overrides,
    },
  };
}

it('renders the display-only starter conversation and submits its contextual suggestion', () => {
  const { controller, submit } = expandedController({
    prompt: '',
    messages: [],
    state: {
      kind: 'expanded',
      invocation: { source: 'theory', sectionTitle: 'Dòng chảy thuật toán', anchor: new DOMRect() },
    },
  });
  render(<AssistantConversationPanel controller={controller} mobile={false} compact={false} />);

  expect(screen.getByText('Mình có thể giúp gì cho bạn? 👋')).toBeVisible();
  expect(
    screen.getByText('Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo ngữ cảnh hiện tại.'),
  ).toBeVisible();
  expect(screen.getByTestId('assistant-expanded-actions')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích' }));
  expect(submit).toHaveBeenCalledWith(
    'explain',
    'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
  );
});

it('replaces starter content with live messages and hides suggestions', () => {
  const { controller } = expandedController();
  render(<AssistantConversationPanel controller={controller} mobile={false} compact={false} />);

  expect(screen.getByText('Vì sao bước này sai?')).toBeVisible();
  expect(screen.queryByTestId('assistant-expanded-actions')).not.toBeInTheDocument();
  expect(screen.queryByText('Mình có thể giúp gì cho bạn? 👋')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the panel test to verify it fails**

Run: `pnpm test -- apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx`

Expected: FAIL because the panel currently renders only the empty paragraph and has no expanded action group.

- [ ] **Step 3: Implement semantic expanded-panel markup**

Use `Bot`, `ChevronRight`, `Maximize2`, `Mic`, `Plus`, `SendHorizontal`, and
`X` from `lucide-react`. Add the assistant identity block and visual-only
expanded-view affordance to the header; keep the existing close button and
`AssistantContextBadge`.

Render the message area as follows:

```tsx
const isStarterState = controller.messages.length === 0;
const actions = assistantActionsForInvocation(controller.state.invocation);

const liveMessages = controller.messages.map((message) => (
  <article key={message.id} data-role={message.role}>
    <span>{message.contextLabel}</span>
    <p>{message.content}</p>
  </article>
));

{isStarterState ? (
  <>
    <p className="syn-contextual-assistant-panel__assistant-label">Trợ lý AI</p>
    <div className="syn-contextual-assistant-panel__starter" aria-label="Lời chào Trợ lý AI">
      <span className="syn-contextual-assistant-panel__message-avatar" aria-hidden="true">
        <Bot size={22} />
      </span>
      <article data-role="assistant" data-variant="greeting">
        <p>Mình có thể giúp gì cho bạn? 👋</p>
        <time dateTime="">10:24</time>
      </article>
      <article data-role="assistant" data-variant="guidance">
        <p>Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo ngữ cảnh hiện tại.</p>
        <time dateTime="">10:24</time>
      </article>
    </div>
    <section className="syn-contextual-assistant-panel__suggestions" aria-labelledby="assistant-suggestions-heading">
      <h2 id="assistant-suggestions-heading">Gợi ý cho bạn</h2>
      <div data-testid="assistant-expanded-actions" className="syn-contextual-assistant-panel__actions">
        {actions.map(({ label, description, kind, prompt, icon: Icon, tone }) => (
          <button key={label} type="button" data-tone={tone} disabled={pending}
            aria-label={label} onClick={() => void controller.submit(kind, prompt)}>
            <span aria-hidden="true"><Icon size={24} /></span>
            <span><strong>{label}</strong><small>{description}</small></span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        ))}
      </div>
    </section>
  </>
) : liveMessages}
```

Keep `data-role`, live status, error alert, label, textarea value/onChange,
and `controller.submit('explain')` for the composer. Replace its text submit
control with an accessible `aria-label="Gửi"` paper-plane icon. Add
`aria-hidden` add and microphone spans around the existing textarea; they are
visual only because the controller has no attachment or speech interface.
Render the exact disclaimer copy `AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.` below the composer row.

- [ ] **Step 4: Run the panel test to verify it passes**

Run: `pnpm test -- apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx`

Expected: PASS; both display-only starter content and real-message replacement are covered.

- [ ] **Step 5: Commit the semantic panel state**

```bash
git add apps/web/src/features/ai-assistant/AssistantConversationPanel.tsx \
  apps/web/src/features/ai-assistant/AssistantConversationPanel.test.tsx
git commit -m "feat: add expanded AI panel starter state"
```

### Task 3: Apply the reference layout and verify the Go-runtime surface

**Files:**
- Modify: `apps/web/src/application.css:2741-2838`
- Modify: `tests/e2e/single-active-workspace-go-runtime.spec.ts:467-486`
- Regenerate: `internal/webassets/dist/**`, `internal/webassets/inventory.json`

**Interfaces:**
- Consumes: the class names and `data-tone` attributes produced in Task 2.
- Produces: a desktop expanded panel that fits three horizontal suggestion cards and a mobile dialog whose content remains reachable and scrollable.

- [ ] **Step 1: Add failing browser assertions for the approved expanded panel**

Replace the current `expandedBox.width <= 361` assertion with resilient visual
and semantic checks after opening `assistant-expanded-panel`:

```ts
await expect(expanded.getByText('Mình có thể giúp gì cho bạn? 👋')).toBeVisible();
await expect(expanded.getByTestId('assistant-expanded-actions')).toBeVisible();
await expect(expanded.getByTestId('assistant-expanded-actions').getByRole('button')).toHaveCount(3);
await expect(expanded.getByLabel('Gửi')).toBeDisabled();
expect(expandedBox.width).toBeGreaterThan(560);
expect(expandedBox.width).toBeLessThanOrEqual(before.workspace.width);
expect(Math.abs(expandedBox.x + expandedBox.width - before.workspace.x - before.workspace.width)).toBeLessThanOrEqual(1);
```

Retain the workspace-zero-footprint and mobile-dialog assertions. In the mobile
section, also assert the three starter suggestion buttons are visible before
closing the dialog.

- [ ] **Step 2: Stage web assets and run the focused browser test to verify it fails**

Run: `pnpm go:stage-web && pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'`

Expected: FAIL because the current panel remains narrow and lacks the starter action group.

- [ ] **Step 3: Restyle the expanded panel and composer**

Replace the expanded-panel CSS block with a panel-specific design. Its required
rules are:

```css
.syn-contextual-assistant-panel {
  width: clamp(36rem, 42vw, 46rem);
  border: 1px solid var(--syn-color-border-strong);
  border-radius: 1.25rem 0 0 1.25rem;
}

.syn-contextual-assistant-panel__header {
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  padding: 2rem 2.25rem;
}

.syn-contextual-assistant-panel__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.syn-contextual-assistant-panel__composer-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  border: 1px solid var(--syn-color-border-strong);
  border-radius: 1.25rem;
}
```

Use panel-only avatar, message, timestamp, greeting, guidance, suggestion,
and composer classes to create the soft blue greeting, white outlined guidance
bubble, blue/green/violet suggestion accents, round blue send button, and
muted disclaimer from the reference. Keep colors derived from existing tokens
with `color-mix` where a dedicated token does not exist. Set the messages area
to `overflow: auto` and its starter content to `align-content: start` so the
composer remains pinned at the bottom. Use a mobile media rule to remove the
desktop left radius, reduce horizontal padding, and make action cards one
column or a scroll-safe layout without changing `.syn-contextual-assistant-panel--mobile` dialog semantics.

- [ ] **Step 4: Regenerate assets and run the focused browser test**

Run: `pnpm go:stage-web && pnpm test:e2e --project=go-runtime --grep 'keeps contextual AI zero-footprint'`

Expected: PASS; desktop panel is wider, actions are semantic and visible, mobile remains a modal, and the workspace geometry remains unchanged.

- [ ] **Step 5: Run complete static and unit verification**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: PASS with no lint/type/test failures.

- [ ] **Step 6: Commit source, tests, and generated Go assets**

```bash
git add apps/web/src/application.css \
  tests/e2e/single-active-workspace-go-runtime.spec.ts \
  internal/webassets/dist internal/webassets/inventory.json
git commit -m "style: match expanded AI panel mockup"
```

## Self-review

- **Spec coverage:** Task 2 provides the display-only greeting/guidance and real-message replacement; Task 1 and Task 2 preserve contextual request payloads; Task 3 supplies header, three-card layout, pinned composer, disclaimer, desktop width, mobile adaptation, and browser verification. Existing panel tests retain close, error, prompt, and dialog semantics.
- **Placeholder scan:** The plan contains no unfinished implementation markers or generic test instructions; every code step names exact files, APIs, or assertions.
- **Type consistency:** `AssistantAction`, `assistantActionsForInvocation`, `data-testid="assistant-expanded-actions"`, and `ContextualAssistantController.submit(kind, prompt)` use the same names throughout every task.
