import { useLocationPath } from '#src/shared/hooks/useLocationPath';
import { parseLearningRoute } from '#src/app/router/lesson-route';
import { LearningWorkspacePage } from '#src/features/workspace-layout/LearningWorkspacePage';
import type { ReactNode } from 'react';

/** Root application component for the local course player. */
export function App(): ReactNode {
  const route = parseLearningRoute(useLocationPath());
  if (route.kind === 'assessment')
    return (
      <LearningWorkspacePage
        route={{
          kind: 'assessment',
          courseId: route.courseId,
          chapterId: route.chapterId,
          assessmentId: route.assessmentId,
        }}
      />
    );
  if (route.kind === 'lesson')
    return (
      <LearningWorkspacePage
        route={{
          kind: 'lesson',
          courseId: route.courseId,
          chapterId: route.chapterId,
          lessonId: route.lessonId,
        }}
      />
    );
  if (route.kind === 'legacy-lesson')
    return (
      <LearningWorkspacePage
        route={{ kind: 'lesson', courseId: route.courseId, lessonId: route.lessonId }}
      />
    );
  return <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />;
}
