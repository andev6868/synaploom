import type { CourseNavigationPayload, RequirementView } from '@synaploom/protocol';

export interface SynLessonProgressProps {
  readonly navigation: CourseNavigationPayload;
  readonly viewedItemId: string;
  readonly onOpenLesson: (chapterId: string, lessonId: string) => void;
  readonly onOpenAssessment: (chapterId: string, assessmentId: string) => void;
  readonly onLockedItem: (requirements: readonly RequirementView[]) => void;
}
