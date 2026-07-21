import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface TheoryAssistantSelection {
  readonly text: string;
  readonly rect: DOMRect;
}

export function normalizeTheorySelection(value: string): string | null {
  const text = value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
  if (text === '' || Array.from(text).length > 2000) return null;
  return text;
}

export function useTheoryAssistantSelection(
  containerRef: RefObject<HTMLElement | null>,
): {
  readonly selection: TheoryAssistantSelection | null;
  readonly clearToolbar: () => void;
} {
  const [selection, setSelection] = useState<TheoryAssistantSelection | null>(null);
  const clearToolbar = useCallback((): void => setSelection(null), []);

  useEffect(() => {
    const update = (): void => {
      const container = containerRef.current;
      const browserSelection = window.getSelection();
      if (
        !container ||
        browserSelection?.rangeCount !== 1 ||
        browserSelection.isCollapsed
      ) {
        setSelection(null);
        return;
      }
      const range = browserSelection.getRangeAt(0);
      if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
        setSelection(null);
        return;
      }
      const text = normalizeTheorySelection(browserSelection.toString());
      if (!text) {
        setSelection(null);
        return;
      }
      setSelection({ text, rect: range.getBoundingClientRect() });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelection(null);
    };
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (containerRef.current?.contains(target)) return;
      if (target.closest('[data-assistant-selection-toolbar]')) return;
      setSelection(null);
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [containerRef]);

  return { selection, clearToolbar };
}
