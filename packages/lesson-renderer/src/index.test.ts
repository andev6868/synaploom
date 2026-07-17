import { describe, expect, it } from 'vitest';
import { parseLessonMarkdown } from '#src/index';

describe('parseLessonMarkdown', () => {
  it('parses supported Markdown into typed blocks', () => {
    expect(
      parseLessonMarkdown(
        '# Event Loop\n\n- Task queue\n- Microtask queue\n\n```js\nalert(1)\n```',
      ),
    ).toEqual([
      { type: 'heading', level: 1, text: 'Event Loop' },
      { type: 'list', ordered: false, items: ['Task queue', 'Microtask queue'] },
      { type: 'code', language: 'js', code: 'alert(1)' },
    ]);
  });

  it('keeps raw HTML inert and removes unsafe links', () => {
    const blocks = parseLessonMarkdown(
      '<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n[safe](https://example.com)',
    );
    expect(blocks.map((block) => block.type)).not.toContain('html');
    expect(JSON.stringify(blocks)).not.toContain('"href":"javascript:');
    expect(blocks).toContainEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '<script>alert(1)</script>' }],
    });
  });
});
