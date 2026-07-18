import type { CourseNavigationPayload, CoursePayload, LessonPayload } from '@synaploom/protocol';

export interface LearningProgressSummary {
  readonly positionLabel: string;
  readonly completionLabel: string;
}

export function buildLearningProgressSummary(
  course: CoursePayload,
  lesson: LessonPayload,
  navigation?: CourseNavigationPayload,
): LearningProgressSummary {
  if (!navigation) {
    const completed = course.lessons.filter((item) => item.status === 'COMPLETED').length;
    return {
      positionLabel: `Bài ${lesson.position} trong ${course.lessons.length}`,
      completionLabel: `${completed}/${course.lessons.length} bài đã hoàn thành`,
    };
  }

  const lessons = navigation.chapters.flatMap((chapter) => chapter.lessons);
  const requiredLessons = lessons.filter((item) => item.required);
  const completedRequired = requiredLessons.filter((item) => item.status === 'COMPLETED').length;
  const viewedIndex = lessons.findIndex((item) => item.id === lesson.id);

  return {
    positionLabel:
      viewedIndex >= 0
        ? `Bài ${viewedIndex + 1} trong ${lessons.length}`
        : `Bài ${lesson.position} trong ${lessons.length}`,
    completionLabel: `${completedRequired}/${requiredLessons.length} bài bắt buộc đã hoàn thành`,
  };
}
