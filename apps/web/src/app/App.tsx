import { useLocationPath } from '#src/shared/hooks/useLocationPath';
import { parseLearningRoute } from '#src/app/router/lesson-route';
import { LearningWorkspacePage } from '#src/features/workspace-layout/LearningWorkspacePage';
import { ChapterAssessmentPage } from '#src/features/chapter-assessment/ChapterAssessmentPage';
import type { ReactNode } from 'react';

/** Root application component for the local course player. */
export function App(): ReactNode {
  const route = parseLearningRoute(useLocationPath());
  if (route.kind === 'assessment') return <ChapterAssessmentPage courseId={route.courseId} chapterId={route.chapterId} assessmentId={route.assessmentId} />;
  if (route.kind === 'lesson') return <LearningWorkspacePage requestedLessonId={route.lessonId} requestedCourseId={route.courseId} requestedChapterId={route.chapterId} />;
  return <LearningWorkspacePage requestedLessonId={route.kind === 'legacy-lesson' ? route.lessonId : null} />;
}
