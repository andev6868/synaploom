import type { CourseNavigationPayload, NextActionPayload } from '@synaploom/protocol';

export type ProgressionActionPresentation =
  | {
      readonly kind: 'button';
      readonly label: string;
      readonly action: NextActionPayload;
    }
  | { readonly kind: 'complete'; readonly message: string }
  | { readonly kind: 'none' };

function lessonTitle(
  navigation: CourseNavigationPayload | undefined,
  chapterId: string,
  lessonId: string,
): string | undefined {
  const chapter = navigation?.chapters.find((item) => item.id === chapterId);
  return chapter?.lessons.find((item) => item.id === lessonId)?.title;
}

function assessmentTitle(
  navigation: CourseNavigationPayload | undefined,
  chapterId: string,
  assessmentId: string,
): string | undefined {
  const chapter = navigation?.chapters.find((item) => item.id === chapterId);
  return chapter?.assessments.find((item) => item.id === assessmentId)?.title;
}

function chapterTitle(
  navigation: CourseNavigationPayload | undefined,
  chapterId: string,
): string | undefined {
  return navigation?.chapters.find((item) => item.id === chapterId)?.title;
}

export function resolveProgressionAction(
  action: NextActionPayload,
  navigation?: CourseNavigationPayload,
): ProgressionActionPresentation {
  switch (action.type) {
    case 'ACKNOWLEDGE_READING':
      return { kind: 'button', label: 'Đánh dấu đã đọc', action };
    case 'START_REQUIRED_PRACTICE':
      return { kind: 'button', label: 'Mở bài thực hành', action };
    case 'RETRY_REQUIRED_PRACTICE':
      return { kind: 'button', label: 'Thử lại bài thực hành', action };
    case 'RETURN_TO_CURRENT_LESSON':
    case 'CONTINUE_TO_LESSON': {
      const title = lessonTitle(navigation, action.chapterId, action.lessonId);
      return {
        kind: 'button',
        label: title ? `Tiếp tục bài ${title}` : 'Tiếp tục bài học',
        action,
      };
    }
    case 'START_CHAPTER_ASSESSMENT': {
      const title = assessmentTitle(navigation, action.chapterId, action.assessmentId);
      return {
        kind: 'button',
        label: title ? `Bắt đầu đánh giá ${title}` : 'Bắt đầu đánh giá chương',
        action,
      };
    }
    case 'RETRY_CHAPTER_ASSESSMENT': {
      const title = assessmentTitle(navigation, action.chapterId, action.assessmentId);
      return {
        kind: 'button',
        label: title ? `Làm lại đánh giá ${title}` : 'Làm lại đánh giá chương',
        action,
      };
    }
    case 'CONTINUE_TO_CHAPTER': {
      const title = chapterTitle(navigation, action.chapterId);
      return {
        kind: 'button',
        label: title ? `Tiếp tục chương ${title}` : 'Tiếp tục chương tiếp theo',
        action,
      };
    }
    case 'VIEW_COURSE_SUMMARY':
      return { kind: 'complete', message: 'Bạn đã hoàn thành khóa học' };
    case 'NONE': {
      const requiredChapters = navigation?.chapters.filter((chapter) => chapter.required) ?? [];
      if (
        requiredChapters.length > 0 &&
        requiredChapters.every((chapter) => chapter.status === 'COMPLETED')
      ) {
        return { kind: 'complete', message: 'Bạn đã hoàn thành khóa học' };
      }
      return { kind: 'none' };
    }
  }
}
