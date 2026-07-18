import type { LessonBlock } from '@synaploom/contracts';
import type { ReactNode } from 'react';
import { LessonDocumentRenderer } from '#src/features/lesson-content/LessonDocumentRenderer';

/** Renders only the inert typed document produced by the Go lesson parser. */
export function LessonContent({
  blocks,
  renderActivity,
}: {
  readonly blocks: readonly LessonBlock[];
  readonly renderActivity?: (activityId: string) => ReactNode;
}): ReactNode {
  return (
    <LessonDocumentRenderer
      document={{
        id: 'lesson-content',
        courseId: 'current-course',
        position: 1,
        title: 'Lesson content',
        type: 'theory',
        blocks,
      }}
      {...(renderActivity === undefined ? {} : { renderActivity })}
    />
  );
}
