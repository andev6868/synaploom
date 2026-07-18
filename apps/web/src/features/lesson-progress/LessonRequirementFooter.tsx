import type { LessonViewContext, NextActionPayload, RequirementView } from '@synaploom/protocol';
import type { ReactNode } from 'react';

type Props = {
  readonly context: LessonViewContext;
  readonly busy?: boolean;
  readonly onAction: (action: NextActionPayload) => void;
};

const labels: Record<NextActionPayload['type'], string | null> = {
  ACKNOWLEDGE_READING: 'Hoàn thành bài học',
  START_REQUIRED_PRACTICE: 'Đi đến bài thực hành',
  RETRY_REQUIRED_PRACTICE: 'Thử lại bài thực hành',
  CONTINUE_TO_LESSON: 'Tiếp tục bài tiếp theo',
  START_CHAPTER_ASSESSMENT: 'Bắt đầu đánh giá chương',
  RETRY_CHAPTER_ASSESSMENT: 'Thử lại đánh giá chương',
  CONTINUE_TO_CHAPTER: 'Tiếp tục chương tiếp theo',
  RETURN_TO_CURRENT_LESSON: 'Quay lại bài đang học',
  VIEW_COURSE_SUMMARY: 'Xem tổng kết khóa học',
  NONE: null,
};

function humanizeIdentifier(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function requirementLabel(requirement: RequirementView): string {
  if (requirement.kind === 'reading') return 'Đọc nội dung bài học';

  const title = humanizeIdentifier(requirement.id);
  if (requirement.kind === 'practice') return `Hoàn thành bài thực hành “${title}”`;
  if (requirement.kind === 'assessment') return `Hoàn thành đánh giá “${title}”`;
  return `Hoàn thành bài học “${title}”`;
}

function actionLabel(context: LessonViewContext): string | null {
  if (context.nextAction.type === 'RETURN_TO_CURRENT_LESSON') {
    const destination =
      context.returnTarget?.label ?? humanizeIdentifier(context.nextAction.lessonId);
    return `Quay lại bài ${destination}`;
  }
  return labels[context.nextAction.type];
}

export function LessonRequirementFooter({ context, busy = false, onAction }: Props): ReactNode {
  const label = actionLabel(context);
  const required = context.requirements.filter((requirement) => requirement.required);
  const optional = context.requirements.filter((requirement) => !requirement.required);

  return (
    <footer className="syn-requirement-footer">
      <section aria-labelledby="lesson-requirements-title">
        <h2 id="lesson-requirements-title">Yêu cầu hoàn thành bài học</h2>
        <ul className="syn-requirement-footer__list">
          {[...required, ...optional].map((requirement) => (
            <li
              key={`${requirement.kind}:${requirement.id}`}
              className="syn-requirement-footer__item"
              data-required={requirement.required}
              data-satisfied={requirement.satisfied}
            >
              <span aria-hidden="true" className="syn-requirement-footer__status">
                {requirement.satisfied ? '✓' : '○'}
              </span>
              <span>{requirementLabel(requirement)}</span>
              {!requirement.required ? (
                <span className="syn-requirement-footer__optional">Tùy chọn</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {label ? (
        <button
          className="syn-requirement-footer__action"
          type="button"
          disabled={busy}
          onClick={() => onAction(context.nextAction)}
        >
          {label}
        </button>
      ) : null}
    </footer>
  );
}
