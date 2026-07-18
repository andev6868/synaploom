import { describe, expect, it } from 'vitest';
import { externalLinkProps, isLessonDocument } from '#src/index';

describe('lesson renderer helpers', () => {
  it('recognizes typed lesson documents without parsing Markdown', () => {
    expect(
      isLessonDocument({
        id: 'lesson',
        courseId: 'course',
        position: 1,
        title: 'Lesson',
        type: 'theory',
        blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Body' }] }],
      }),
    ).toBe(true);
    expect(isLessonDocument({ id: 'lesson', blocks: [] })).toBe(false);
  });

  it('opens only external links in a new browsing context', () => {
    expect(externalLinkProps('https://example.com')).toEqual({
      target: '_blank',
      rel: 'noreferrer noopener',
    });
    expect(externalLinkProps('#section')).toEqual({});
    expect(externalLinkProps('/assets/file.pdf')).toEqual({});
  });
});
