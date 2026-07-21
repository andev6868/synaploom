import { expect, it, vi } from 'vitest';
import { createApiClient } from '#src/shared/api/client';

it('posts bounded AI context to the owner-qualified route', async () => {
  const fetchImpl = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ status: 'ok', content: 'Giải thích' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const client = createApiClient(fetchImpl as typeof fetch);

  await client.requestAi(
    {
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'lesson-1',
      chapterId: 'chapter-1',
    },
    {
      kind: 'explain',
      prompt: 'Giải thích đoạn này',
      source: 'theory',
      selectedText: 'Đoạn được chọn',
    },
  );

  expect(fetchImpl).toHaveBeenCalledWith(
    '/api/v1/courses/course/lessons/lesson-1/ai/generate?chapterId=chapter-1',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        kind: 'explain',
        prompt: 'Giải thích đoạn này',
        source: 'theory',
        selectedText: 'Đoạn được chọn',
      }),
    }),
  );
});
