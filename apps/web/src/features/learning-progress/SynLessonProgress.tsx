import type {
  AssessmentNavigationItem,
  ChapterNavigationItem,
  LessonNavigationItem,
  RequirementView,
} from '@synaploom/protocol';
import type { ReactNode } from 'react';
import type { SynLessonProgressProps } from '#src/features/learning-progress/types';

const statusLabel = {
  COMPLETED: 'Đã hoàn thành',
  LOCKED: 'Bị khóa',
  IN_PROGRESS: 'Đang học',
  AVAILABLE: 'Có thể học',
} as const;

const chapterStatusLabel: Record<ChapterNavigationItem['status'], string> = {
  LOCKED: 'Bị khóa',
  AVAILABLE: 'Có thể học',
  IN_PROGRESS: 'Đang học',
  ASSESSMENT_REQUIRED: 'Cần hoàn thành đánh giá',
  COMPLETED: 'Đã hoàn thành',
};

export function requirementLabel(requirement: RequirementView): string {
  switch (requirement.kind) {
    case 'reading':
      return 'Hoàn thành phần đọc';
    case 'practice':
      return `Hoàn thành bài thực hành ${requirement.id}`;
    case 'lesson':
      return `Hoàn thành bài học ${requirement.id}`;
    case 'assessment':
      return `Hoàn thành đánh giá ${requirement.id}`;
  }
}

function itemStateLabels(
  item: LessonNavigationItem | AssessmentNavigationItem,
  viewedItemId: string,
): readonly string[] {
  const labels: string[] = [statusLabel[item.status]];
  if ('current' in item && item.current) labels.push('Tiến trình hiện tại');
  if (item.id === viewedItemId && !('current' in item && item.current)) labels.push('Đang xem');
  return labels;
}

function activateItem(
  chapterId: string,
  item: LessonNavigationItem | AssessmentNavigationItem,
  kind: 'lesson' | 'assessment',
  props: SynLessonProgressProps,
): void {
  if (item.status === 'LOCKED') {
    props.onLockedItem(item.blockingRequirements);
    return;
  }
  if (kind === 'lesson') props.onOpenLesson(chapterId, item.id);
  else props.onOpenAssessment(chapterId, item.id);
}

export function SynLessonProgress(props: SynLessonProgressProps): ReactNode {
  const { navigation, viewedItemId } = props;

  return (
    <aside
      id="course-learning-navigation"
      className="syn-lesson-progress"
      aria-label="Nội dung khóa học"
    >
      <div className="syn-lesson-progress__chapters">
        {navigation.chapters.map((chapter, chapterIndex) => (
          <section key={chapter.id} className="syn-lesson-progress__chapter">
            <header className="syn-lesson-progress__chapter-header">
              <span className="syn-lesson-progress__chapter-index">Chương {chapterIndex + 1}</span>
              <div>
                <h2>{chapter.title}</h2>
                <p>{chapterStatusLabel[chapter.status]}</p>
              </div>
            </header>
            <div className="syn-lesson-progress__items">
              {chapter.lessons.map((lesson, lessonIndex) => {
                const labels = itemStateLabels(lesson, viewedItemId);
                const locked = lesson.status === 'LOCKED';
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    className="syn-lesson-progress__item"
                    data-status={lesson.status.toLowerCase()}
                    aria-current={lesson.id === viewedItemId ? 'step' : undefined}
                    aria-disabled={locked}
                    onClick={() => activateItem(chapter.id, lesson, 'lesson', props)}
                  >
                    <span className="syn-lesson-progress__marker" aria-hidden="true">
                      {lesson.status === 'COMPLETED' ? '✓' : lessonIndex + 1}
                    </span>
                    <span className="syn-lesson-progress__item-copy">
                      <span className="syn-lesson-progress__item-title">{lesson.title}</span>
                      <span className="syn-lesson-progress__item-meta">
                        {lesson.required ? 'Bắt buộc' : 'Tùy chọn'} · {labels.join(' · ')}
                      </span>
                    </span>
                  </button>
                );
              })}
              {chapter.assessments.map((assessment) => {
                const labels = itemStateLabels(assessment, viewedItemId);
                const locked = assessment.status === 'LOCKED';
                return (
                  <button
                    key={assessment.id}
                    type="button"
                    className="syn-lesson-progress__item syn-lesson-progress__item--assessment"
                    data-status={assessment.status.toLowerCase()}
                    aria-current={assessment.id === viewedItemId ? 'step' : undefined}
                    aria-disabled={locked}
                    onClick={() => activateItem(chapter.id, assessment, 'assessment', props)}
                  >
                    <span className="syn-lesson-progress__marker" aria-hidden="true">
                      {assessment.status === 'COMPLETED' ? '✓' : 'A'}
                    </span>
                    <span className="syn-lesson-progress__item-copy">
                      <span className="syn-lesson-progress__item-kicker">Đánh giá chương</span>
                      <span className="syn-lesson-progress__item-title">{assessment.title}</span>
                      <span className="syn-lesson-progress__item-meta">
                        {assessment.required ? 'Bắt buộc' : 'Tùy chọn'} · {labels.join(' · ')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

export type { SynLessonProgressProps } from '#src/features/learning-progress/types';
