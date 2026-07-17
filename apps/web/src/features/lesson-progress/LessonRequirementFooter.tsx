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
  START_CHAPTER_ASSESSMENT: 'Bắt đầu thực hành của chương',
  RETRY_CHAPTER_ASSESSMENT: 'Thử lại thực hành của chương',
  CONTINUE_TO_CHAPTER: 'Tiếp tục chương tiếp theo',
  RETURN_TO_CURRENT_LESSON: 'Quay lại bài đang học',
  VIEW_COURSE_SUMMARY: 'Xem tổng kết khóa học',
  NONE: null,
};

function requirementLabel(requirement: RequirementView): string {
  const kind = requirement.kind === 'reading' ? 'Phần đọc' : requirement.kind === 'practice' ? 'Bài thực hành' : requirement.kind === 'assessment' ? 'Thực hành chương' : 'Bài học';
  return `${requirement.satisfied ? '✓' : '○'} ${kind}: ${requirement.id}${requirement.required ? ' · Bắt buộc' : ' · Tùy chọn'}`;
}

export function LessonRequirementFooter({ context, busy = false, onAction }: Props): ReactNode {
  const label = labels[context.nextAction.type];
  return (
    <footer className="syn-requirement-footer">
      <section aria-label="Yêu cầu hoàn thành">
        <h2>Yêu cầu hoàn thành</h2>
        <ul>
          {context.requirements.map((requirement) => (
            <li key={`${requirement.kind}:${requirement.id}`} data-required={requirement.required}>
              {requirementLabel(requirement)}
            </li>
          ))}
        </ul>
      </section>
      {label ? <button type="button" disabled={busy} onClick={() => onAction(context.nextAction)}>{label}</button> : null}
    </footer>
  );
}
