import type { ReactNode } from 'react';
import { ActivityFeedback } from '#src/features/activity-engine/ActivityFeedback';
import { ChoiceActivity } from '#src/features/activity-engine/renderers/ChoiceActivity';
import { CodingActivity } from '#src/features/activity-engine/renderers/CodingActivity';
import { FillBlanksActivity } from '#src/features/activity-engine/renderers/FillBlanksActivity';
import { MatchingActivity } from '#src/features/activity-engine/renderers/MatchingActivity';
import { NumericActivity } from '#src/features/activity-engine/renderers/NumericActivity';
import { OrderingActivity } from '#src/features/activity-engine/renderers/OrderingActivity';
import { ShortAnswerActivity } from '#src/features/activity-engine/renderers/ShortAnswerActivity';
import { TrueFalseActivity } from '#src/features/activity-engine/renderers/TrueFalseActivity';
import { WritingActivity } from '#src/features/activity-engine/renderers/WritingActivity';
import type { ActivityHostProps, ActivityRendererProps } from '#src/features/activity-engine/types';
import { useActivityAttempt } from '#src/features/activity-engine/useActivityAttempt';
import { LessonContent } from '#src/features/lesson-content/LessonContent';

function renderKnownActivity(props: ActivityRendererProps): ReactNode {
  switch (props.activity.kind) {
    case 'single-choice':
    case 'multiple-choice':
      return <ChoiceActivity {...props} />;
    case 'true-false':
      return <TrueFalseActivity {...props} />;
    case 'short-answer':
      return <ShortAnswerActivity {...props} />;
    case 'fill-blanks':
      return <FillBlanksActivity {...props} />;
    case 'ordering':
      return <OrderingActivity {...props} />;
    case 'matching':
      return <MatchingActivity {...props} />;
    case 'numeric':
      return <NumericActivity {...props} />;
    case 'writing':
      return <WritingActivity {...props} />;
    case 'coding':
      return <div role="alert">Không gian lập trình không thể render trong activity form.</div>;
    default:
      return <div role="alert">Loại hoạt động này chưa được hỗ trợ.</div>;
  }
}

function AttemptActivityHost({
  owner,
  activity,
  policy,
  onProgressChanged,
}: ActivityHostProps): ReactNode {
  const controller = useActivityAttempt({
    owner,
    activityId: activity.id,
    policy,
    onProgressChanged,
  });
  const rendererProps: ActivityRendererProps = {
    activity,
    answer: controller.answer,
    disabled: controller.disabled,
    onChange: controller.setAnswer,
    onSaveDraft: controller.saveDraft,
    onSubmit: controller.submit,
  };

  return (
    <section
      className="syn-activity-host"
      data-state={controller.state}
      aria-busy={controller.state === 'loading' || controller.state === 'submitting'}
    >
      <fieldset disabled={controller.disabled} aria-label={activity.title}>
        <legend>{activity.title}</legend>
        {activity.prompt.blocks.length > 0 ? (
          <div className="syn-activity-host__prompt">
            <LessonContent blocks={activity.prompt.blocks} />
          </div>
        ) : null}
        {renderKnownActivity(rendererProps)}
      </fieldset>
      {controller.state === 'loading' ? (
        <p className="syn-activity-host__state">Đang tải hoạt động…</p>
      ) : null}
      {controller.state === 'saving' ? (
        <p className="syn-activity-host__state" role="status">
          Đang lưu bản nháp…
        </p>
      ) : null}
      {controller.state === 'submitting' ? (
        <p className="syn-activity-host__state" role="status">
          Đang kiểm tra câu trả lời…
        </p>
      ) : null}
      {controller.state === 'draft' ? (
        <p className="syn-activity-host__state" role="status">
          Đã lưu bản nháp.
        </p>
      ) : null}
      {controller.state === 'error' && controller.error ? (
        <p role="alert">{controller.error.message}</p>
      ) : null}
      {controller.state === 'max-attempt' ? (
        <p role="alert">Bạn đã sử dụng hết số lần làm bài.</p>
      ) : null}
      {controller.attempt?.feedback ? (
        <ActivityFeedback feedback={controller.attempt.feedback} />
      ) : null}
    </section>
  );
}

export function ActivityHost(props: ActivityHostProps): ReactNode {
  if (props.activity.kind === 'coding') {
    return (
      <CodingActivity
        owner={props.owner}
        activity={props.activity}
        onProgressChanged={props.onProgressChanged}
      />
    );
  }
  return <AttemptActivityHost {...props} />;
}
