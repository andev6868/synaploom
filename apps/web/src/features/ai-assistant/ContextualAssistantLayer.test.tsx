import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';
import { ContextualAssistantLayer } from '#src/features/ai-assistant/ContextualAssistantLayer';

function viewport(kind: 'wide-three' | 'compact' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches:
      kind === 'wide-three'
        ? query.includes('1440')
        : kind === 'compact'
          ? query.includes('720')
          : false,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
}

function controller(kind: 'quick' | 'expanded'): {
  readonly controller: ContextualAssistantController;
  readonly close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  return {
    close,
    controller: {
      target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
      state: {
        kind,
        invocation: {
          source: 'theory',
          sectionTitle: 'Thuật toán',
          anchor: new DOMRect(10, 10, 10, 10),
        },
      },
      prompt: '',
      messages: [],
      response: null,
      status: 'idle',
      error: null,
      openQuick: vi.fn(),
      expand: vi.fn(),
      close,
      setPrompt: vi.fn(),
      submit: vi.fn(() => Promise.resolve()),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('ContextualAssistantLayer', () => {
  it('renders the Quick Ask surface without a permanent wrapper', () => {
    viewport('wide-three');
    render(<ContextualAssistantLayer controller={controller('quick').controller} />);
    expect(screen.getByTestId('assistant-quick-popover')).toBeVisible();
  });

  it('renders the expanded conversation surface for mobile', () => {
    viewport('mobile');
    render(<ContextualAssistantLayer controller={controller('expanded').controller} />);
    expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toHaveAttribute('aria-modal', 'true');
  });

  it('consumes Escape before the parent Practice dialog can close', () => {
    viewport('mobile');
    const active = controller('expanded');
    render(<ContextualAssistantLayer controller={active.controller} />);
    const parentEscapeHandler = vi.fn();
    document.addEventListener('keydown', parentEscapeHandler);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(active.close).toHaveBeenCalledTimes(1);
    expect(parentEscapeHandler).not.toHaveBeenCalled();
    document.removeEventListener('keydown', parentEscapeHandler);
  });

  it('closes the topmost assistant surface with Escape', () => {
    viewport('wide-three');
    const active = controller('quick');
    render(<ContextualAssistantLayer controller={active.controller} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(active.close).toHaveBeenCalledTimes(1);
  });
});
