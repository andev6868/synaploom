import { useMemo, useState, type ReactNode } from 'react';
import type {
  AssessmentNavigationItem,
  LessonNavigationItem,
  RequirementView,
} from '@synaploom/protocol';
import type { SynLessonProgressProps } from '#src/features/learning-progress/types';

function stateLabels(
  item: LessonNavigationItem | AssessmentNavigationItem,
  viewedItemId: string,
): readonly string[] {
  const labels: string[] = [];
  switch (item.status) {
    case 'COMPLETED':
      labels.push('Đã hoàn thành');
      break;
    case 'LOCKED':
      labels.push('Bị khóa');
      break;
    case 'IN_PROGRESS':
      labels.push('Bài đang học');
      break;
    case 'AVAILABLE':
      labels.push('Có thể học');
      break;
  }
  if (item.id === viewedItemId) labels.push('Đang xem lại');
  return labels;
}

function blockingReason(requirements: readonly RequirementView[]): string {
  const missing = requirements.filter(
    (requirement) => requirement.required && !requirement.satisfied,
  );
  if (missing.length === 0) return 'Mục này đang bị khóa.';
  return `Còn thiếu: ${missing.map((requirement) => requirement.id).join(', ')}.`;
}

export function SynLessonProgress({
  navigation,
  viewedItemId,
  onOpenLesson,
  onOpenAssessment,
  onLockedItem,
}: SynLessonProgressProps): ReactNode {
  const [expanded, setExpanded] = useState(true);
  const requiredProgress = useMemo(() => {
    const lessons = navigation.chapters
      .flatMap((chapter) => chapter.lessons)
      .filter((lesson) => lesson.required);
    return {
      completed: lessons.filter((lesson) => lesson.status === 'COMPLETED').length,
      total: lessons.length,
    };
  }, [navigation.chapters]);

  const activate = (
    chapterId: string,
    item: LessonNavigationItem | AssessmentNavigationItem,
    kind: 'lesson' | 'assessment',
  ): void => {
    if (item.status === 'LOCKED') {
      onLockedItem(item.blockingRequirements);
      return;
    }
    if (kind === 'lesson') onOpenLesson(chapterId, item.id);
    else onOpenAssessment(chapterId, item.id);
  };

  return (
    <aside className="syn-lesson-progress" aria-label="Tiến độ khóa học">
      <header className="syn-lesson-progress__header">
        <div>
          <strong>Tiến độ học tập</strong>
          <p>
            {requiredProgress.completed}/{requiredProgress.total} bài bắt buộc đã hoàn thành
          </p>
        </div>
        <button
          type="button"
          className="syn-lesson-progress__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Thu gọn tiến độ' : 'Mở rộng tiến độ'}
        </button>
      </header>

      {!expanded ? (
        <p className="syn-lesson-progress__current">
          Đang xem: <strong>{viewedItemId}</strong>
        </p>
      ) : (
        <div className="syn-lesson-progress__chapters">
          {navigation.chapters.map((chapter) => (
            <section key={chapter.id} className="syn-lesson-progress__chapter">
              <h2>{chapter.title}</h2>
              <div className="syn-lesson-progress__items">
                {chapter.lessons.map((lesson) => {
                  const labels = stateLabels(lesson, viewedItemId);
                  const locked = lesson.status === 'LOCKED';
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className="syn-lesson-progress__item"
                      aria-current={lesson.id === viewedItemId ? 'step' : undefined}
                      aria-disabled={locked}
                      title={locked ? blockingReason(lesson.blockingRequirements) : undefined}
                      onClick={() => activate(chapter.id, lesson, 'lesson')}
                    >
                      <span className="syn-lesson-progress__item-title">{lesson.title}</span>
                      <span className="syn-lesson-progress__item-meta">
                        {labels.join(' · ')}
                        {lesson.required ? ' · Bắt buộc' : ' · Tùy chọn'}
                      </span>
                    </button>
                  );
                })}
                {chapter.assessments.map((assessment) => {
                  const labels = stateLabels(assessment, viewedItemId);
                  const locked = assessment.status === 'LOCKED';
                  return (
                    <button
                      key={assessment.id}
                      type="button"
                      className="syn-lesson-progress__item syn-lesson-progress__item--assessment"
                      aria-current={assessment.id === viewedItemId ? 'step' : undefined}
                      aria-disabled={locked}
                      title={locked ? blockingReason(assessment.blockingRequirements) : undefined}
                      onClick={() => activate(chapter.id, assessment, 'assessment')}
                    >
                      <span className="syn-lesson-progress__item-kicker">Thực hành chương</span>
                      <span className="syn-lesson-progress__item-title">{assessment.title}</span>
                      <span className="syn-lesson-progress__item-meta">
                        {assessment.required ? 'Bắt buộc' : 'Tùy chọn'} · {labels.join(' · ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

export type { SynLessonProgressProps } from '#src/features/learning-progress/types';
