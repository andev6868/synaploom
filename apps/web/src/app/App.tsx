import { useLocationPath } from '#src/shared/hooks/useLocationPath';
import { parseLessonRoute } from '#src/app/router/lesson-route';
import { LearningWorkspacePage } from '#src/features/workspace-layout/LearningWorkspacePage';
import type { ReactNode } from 'react';

/** Root application component for the local course player. */
export function App(): ReactNode {
  const route = parseLessonRoute(useLocationPath());
  return <LearningWorkspacePage requestedLessonId={route.lessonId} />;
}
