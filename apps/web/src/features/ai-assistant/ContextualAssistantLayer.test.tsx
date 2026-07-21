import { render, screen } from '@testing-library/react';
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

function controller(kind: 'quick' | 'expanded'): ContextualAssistantController {
  return {
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
    close: vi.fn(),
    setPrompt: vi.fn(),
    submit: vi.fn(() => Promise.resolve()),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('ContextualAssistantLayer', () => {
  it('renders the Quick Ask surface without a permanent wrapper', () => {
    viewport('wide-three');
    render(<ContextualAssistantLayer controller={controller('quick')} />);
    expect(screen.getByTestId('assistant-quick-popover')).toBeVisible();
  });

  it('renders the expanded conversation surface for mobile', () => {
    viewport('mobile');
    render(<ContextualAssistantLayer controller={controller('expanded')} />);
    expect(screen.getByTestId('assistant-expanded-panel')).toHaveAttribute(
      'data-assistant-mobile',
      'true',
    );
  });
});
