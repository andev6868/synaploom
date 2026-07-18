import type {
  CourseNavigationPayload,
  LessonViewContext,
  NextActionPayload,
  RequirementView,
} from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { resolveProgressionAction } from './progression-action';

type Props = {
  readonly context: LessonViewContext;
  readonly navigation?: CourseNavigationPayload;
  readonly busy?: boolean;
  readonly onAction: (action: NextActionPayload) => void;
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

export function LessonRequirementFooter({
  context,
  navigation,
  busy = false,
  onAction,
}: Props): ReactNode {
  const presentation = resolveProgressionAction(context.nextAction, navigation);
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
      {presentation.kind === 'button' ? (
        <button
          className="syn-requirement-footer__action"
          type="button"
          disabled={busy}
          onClick={() => onAction(presentation.action)}
        >
          {presentation.label}
        </button>
      ) : null}
      {presentation.kind === 'complete' ? (
        <p className="syn-requirement-footer__complete" role="status">
          ✓ {presentation.message}
        </p>
      ) : null}
    </footer>
  );
}
