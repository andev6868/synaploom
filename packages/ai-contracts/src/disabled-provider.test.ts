import { describe, expect, it } from 'vitest';
import { DisabledAiProvider } from '#src/disabled-provider';

describe('DisabledAiProvider', () => {
  it('reports disabled without performing generation', async () => {
    const provider = new DisabledAiProvider();
    expect(provider.id).toBe('disabled');
    await expect(
      provider.generate(
        {
          kind: 'hint',
          lessonId: 'event-loop',
          prompt: 'Help',
          context: { lessonText: '' },
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      status: 'disabled',
      message: 'AI assistance is not configured.',
    });
  });
});
