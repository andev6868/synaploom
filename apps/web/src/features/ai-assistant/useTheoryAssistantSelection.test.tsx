import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeTheorySelection,
  useTheoryAssistantSelection,
} from '#src/features/ai-assistant/useTheoryAssistantSelection';

function stubSelection({
  startContainer,
  endContainer = startContainer,
  text,
  collapsed = false,
}: {
  readonly startContainer: Node;
  readonly endContainer?: Node;
  readonly text: string;
  readonly collapsed?: boolean;
}): void {
  const range = {
    startContainer,
    endContainer,
    getBoundingClientRect: () => new DOMRect(80, 120, 160, 24),
  } as unknown as Range;
  vi.spyOn(window, 'getSelection').mockReturnValue({
    rangeCount: 1,
    isCollapsed: collapsed,
    getRangeAt: () => range,
    toString: () => text,
  } as unknown as Selection);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('normalizeTheorySelection', () => {
  it('normalizes line endings and surrounding whitespace', () => {
    expect(normalizeTheorySelection('  thuật toán\r\n  hữu hạn  ')).toBe('thuật toán\nhữu hạn');
  });

  it('rejects whitespace-only and selections above 2,000 Unicode code points', () => {
    expect(normalizeTheorySelection('  \n  ')).toBeNull();
    expect(normalizeTheorySelection('🙂'.repeat(2001))).toBeNull();
    expect(normalizeTheorySelection('🙂'.repeat(2000))).toHaveLength(4000);
  });
});

describe('useTheoryAssistantSelection', () => {
  it('accepts only a bounded selection fully inside the Theory zone', async () => {
    const container = document.createElement('article');
    const inside = document.createTextNode('thuật toán hữu hạn');
    const outside = document.createTextNode('outside');
    container.append(inside);
    document.body.append(container, outside);
    const containerRef = createRef<HTMLElement>();
    containerRef.current = container;

    const { result } = renderHook(() => useTheoryAssistantSelection(containerRef));

    stubSelection({ startContainer: inside, text: '  thuật toán\r\n  hữu hạn  ' });
    await act(() => document.dispatchEvent(new Event('selectionchange')));

    expect(result.current.selection).toEqual({
      text: 'thuật toán\nhữu hạn',
      rect: expect.any(DOMRect),
    });

    stubSelection({ startContainer: outside, text: 'outside' });
    await act(() => document.dispatchEvent(new Event('selectionchange')));
    expect(result.current.selection).toBeNull();
  });

  it('clears the toolbar with Escape', async () => {
    const container = document.createElement('article');
    const inside = document.createTextNode('selected');
    container.append(inside);
    document.body.append(container);
    const containerRef = createRef<HTMLElement>();
    containerRef.current = container;
    const { result } = renderHook(() => useTheoryAssistantSelection(containerRef));

    stubSelection({ startContainer: inside, text: 'selected' });
    await act(() => document.dispatchEvent(new Event('selectionchange')));
    expect(result.current.selection).not.toBeNull();

    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(result.current.selection).toBeNull();
  });
});
