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
