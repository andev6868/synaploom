import type {
  ActivityOwner,
  ActivityStatusPayload,
  ChapterAssessmentPayload,
  CourseNavigationPayload,
  LessonViewContext,
  NextActionPayload,
} from '@synaploom/protocol';
import { StatusBadge } from '@synaploom/ui';
import type { ReactNode } from 'react';
import { InlineActivitySlot } from '#src/features/learning-workspace/InlineActivitySlot';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import {
  findActivityStatus,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';
import { LessonRequirementFooter } from '#src/features/lesson-progress/LessonRequirementFooter';

interface AssessmentWorkspaceContentProps {
  readonly chapterId: string;
  readonly assessment: ChapterAssessmentPayload;
  readonly navigation: CourseNavigationPayload;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly controller: LearningWorkspaceController;
  readonly onAction: (action: NextActionPayload) => void;
  readonly onProgressChanged: () => Promise<void>;
}

function requiredProgress(
  activities: readonly ResolvedWorkspaceActivity[],
  statuses: readonly ActivityStatusPayload[],
): { readonly completed: number; readonly required: number } {
  const requiredActivities = activities.filter((item) => item.required);
  return {
    completed: requiredActivities.filter(
      (item) => findActivityStatus(statuses, item.activity.id)?.status === 'PASSED',
    ).length,
    required: requiredActivities.length,
  };
}

function scoreProgress(
  activities: readonly ResolvedWorkspaceActivity[],
  statuses: readonly ActivityStatusPayload[],
): { readonly score: number; readonly maxScore: number } {
  return activities.reduce(
    (total, item) => {
      const status = findActivityStatus(statuses, item.activity.id);
      return {
        score: total.score + (status?.score ?? 0),
        maxScore: total.maxScore + (status?.maxScore ?? item.activity.evaluation.points),
      };
    },
    { score: 0, maxScore: 0 },
  );
}

export function AssessmentWorkspaceContent({
  chapterId,
  assessment,
  navigation,
  activities,
  statuses,
  focusedActivityId,
  controller,
  onAction,
  onProgressChanged,
}: AssessmentWorkspaceContentProps): ReactNode {
  const owner: ActivityOwner = {
    courseId: navigation.courseId,
    ownerKind: 'assessments',
    ownerId: assessment.id,
  };
  const progress = requiredProgress(activities, statuses);
  const score = scoreProgress(activities, statuses);
  const maxAttempts = activities.find((item) => item.policy.maxAttempts !== null)?.policy
    .maxAttempts;
  const passingScore = activities.find((item) => item.policy.passingScore !== null)?.policy
    .passingScore;
  const context: LessonViewContext = {
    chapterId,
    status: assessment.status,
    required: assessment.required,
    readingCompleted: true,
    requirements: assessment.requirements,
    viewMode: navigation.viewMode,
    currentLessonId: navigation.currentLessonId,
    returnTarget: navigation.returnTarget,
    nextAction: navigation.nextAction,
  };

  return (
    <article className="syn-assessment-workspace__article">
      <div className="syn-assessment-workspace__heading">
        <div>
          <StatusBadge status={assessment.status === 'COMPLETED' ? 'passed' : 'active'}>
            {assessment.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang đánh giá'}
          </StatusBadge>
          <p className="syn-assessment-workspace__kicker">Đánh giá chương</p>
          <h1>{assessment.title}</h1>
        </div>
      </div>

      {activities.length > 0 ? (
        <>
          <section className="syn-assessment-workspace__result" aria-label="Tiến độ đánh giá">
            {maxAttempts === undefined ? null : <p>Tối đa {maxAttempts} lần cho mỗi hoạt động.</p>}
            <p>
              {progress.completed}/{progress.required} hoạt động bắt buộc đã hoàn thành
            </p>
            <p>
              Điểm hiện tại: {score.score}/{score.maxScore}
            </p>
            {passingScore == null ? null : (
              <p>
                {score.score >= passingScore ? 'Đã đạt' : 'Chưa đạt'} ngưỡng {passingScore} điểm
              </p>
            )}
          </section>
          <section className="syn-assessment-workspace__activities" aria-label="Nội dung đánh giá">
            {activities.map((item) => (
              <InlineActivitySlot
                key={`${item.setId}-${item.activity.id}`}
                item={item}
                owner={owner}
                focused={focusedActivityId === item.activity.id}
                paneMode={controller.state.paneMode}
                status={findActivityStatus(statuses, item.activity.id)}
                onOpenPractice={(activityId) => controller.focusActivity(activityId)}
                onProgressChanged={onProgressChanged}
                onPersistenceHandleChange={(activityId, handle) =>
                  controller.registerPersistenceHandle(activityId, handle)
                }
              />
            ))}
          </section>
        </>
      ) : (
        <p className="syn-error" role="alert">
          Đánh giá này chưa có nội dung hoạt động hợp lệ.
        </p>
      )}

      <LessonRequirementFooter
        context={context}
        navigation={navigation}
        heading="Yêu cầu hoàn thành đánh giá"
        busy={false}
        onAction={onAction}
      />
    </article>
  );
}
