import type {
  ActivityOwner,
  ActivitySetProgress,
  CourseNavigationPayload,
  LessonViewContext,
  NextActionPayload,
  PublicActivitySetPayload,
} from '@synaploom/protocol';
import { StatusBadge } from '@synaploom/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import { LessonRequirementFooter } from '#src/features/lesson-progress/LessonRequirementFooter';

interface Props {
  readonly courseId: string;
  readonly chapterId: string;
  readonly assessmentId: string;
  readonly navigation: CourseNavigationPayload;
  readonly onAction: (action: NextActionPayload) => void;
}

interface AssessmentSetProps {
  readonly owner: ActivityOwner;
  readonly set: PublicActivitySetPayload;
  readonly onProgressChanged: () => Promise<void>;
}

function progressLabel(progress: ActivitySetProgress): string {
  return `${progress.completedRequiredActivities}/${progress.requiredActivities} hoạt động bắt buộc đã hoàn thành`;
}

function scoreLabel(progress: ActivitySetProgress): string | null {
  if (progress.score === null || progress.maxScore === null) return null;
  return `Điểm hiện tại: ${progress.score}/${progress.maxScore}`;
}

function thresholdLabel(
  progress: ActivitySetProgress,
  set: PublicActivitySetPayload,
): string | null {
  const threshold = set.policy.passingScore;
  if (threshold === null) return null;
  if (progress.passed === true) return `Đã đạt ngưỡng ${threshold} điểm`;
  return `Chưa đạt ngưỡng ${threshold} điểm`;
}

function AssessmentActivitySet({ owner, set, onProgressChanged }: AssessmentSetProps): ReactNode {
  const api = useApi();
  const progressQuery = useQuery({
    queryKey: ['activity-set-progress', owner.courseId, owner.ownerKind, owner.ownerId, set.id],
    queryFn: () => api.getActivitySetProgress(owner, set.id),
  });
  const progress = progressQuery.data;
  const score = progress ? scoreLabel(progress) : null;
  const threshold = progress ? thresholdLabel(progress, set) : null;

  return (
    <section className="syn-assessment-workspace__set" aria-labelledby={`assessment-set-${set.id}`}>
      <header className="syn-assessment-workspace__set-heading">
        <div>
          <h2 id={`assessment-set-${set.id}`}>{set.title ?? 'Nội dung đánh giá'}</h2>
          {set.policy.maxAttempts === null ? null : (
            <p>Tối đa {set.policy.maxAttempts} lần cho mỗi hoạt động.</p>
          )}
        </div>
        {progress?.passed === true ? <StatusBadge status="passed">Đạt</StatusBadge> : null}
      </header>

      {progressQuery.isLoading ? (
        <p className="syn-assessment-workspace__state">Đang tải tiến độ đánh giá…</p>
      ) : progressQuery.error ? (
        <p className="syn-error" role="alert">
          Không thể tải tiến độ đánh giá.
        </p>
      ) : progress ? (
        <div className="syn-assessment-workspace__result" aria-live="polite">
          <p>{progressLabel(progress)}</p>
          {score ? <p>{score}</p> : null}
          {threshold ? <p>{threshold}</p> : null}
        </div>
      ) : null}

      <div className="syn-assessment-workspace__set-activities">
        {set.activities.map((reference) => (
          <ActivityHost
            key={`${set.id}-${reference.activity.id}`}
            owner={owner}
            activity={reference.activity}
            policy={set.policy}
            onProgressChanged={onProgressChanged}
          />
        ))}
      </div>
    </section>
  );
}

export function AssessmentWorkspaceContent({
  courseId,
  chapterId,
  assessmentId,
  navigation,
  onAction,
}: Props): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const owner: ActivityOwner = {
    courseId,
    ownerKind: 'assessments',
    ownerId: assessmentId,
  };
  const assessmentQuery = useQuery({
    queryKey: ['chapter-assessment', courseId, chapterId, assessmentId],
    queryFn: () => api.getChapterAssessment(chapterId, assessmentId),
  });
  const activitySetsQuery = useQuery({
    queryKey: ['activity-sets', courseId, owner.ownerKind, assessmentId],
    queryFn: () => api.getActivitySets(owner),
  });
  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['chapter-assessment', courseId, chapterId, assessmentId],
      }),
      queryClient.invalidateQueries({ queryKey: ['course-navigation', courseId] }),
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({
        queryKey: ['activity-sets', courseId, owner.ownerKind, assessmentId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['activity-set-progress', courseId, owner.ownerKind, assessmentId],
      }),
    ]);
  };

  if (assessmentQuery.isLoading || activitySetsQuery.isLoading)
    return <div className="syn-assessment-workspace__state">Đang tải đánh giá chương…</div>;
  if (assessmentQuery.error || activitySetsQuery.error)
    return (
      <div className="syn-assessment-workspace__state syn-error" role="alert">
        <h1>Không thể mở đánh giá chương</h1>
        <p>
          {assessmentQuery.error instanceof Error
            ? assessmentQuery.error.message
            : activitySetsQuery.error instanceof Error
              ? activitySetsQuery.error.message
              : 'Lỗi không xác định'}
        </p>
      </div>
    );
  const assessment = assessmentQuery.data;
  if (!assessment) return null;

  const activitySets = activitySetsQuery.data ?? [];
  const hasActivities = activitySets.some((set) => set.activities.length > 0);
  const statusLabel = assessment.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang đánh giá';
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
    <article
      className="syn-assessment-workspace__article"
      data-layout={hasActivities ? 'focused-activity' : 'reading'}
    >
      <div className="syn-assessment-workspace__heading">
        <div>
          <StatusBadge status={assessment.status === 'COMPLETED' ? 'passed' : 'active'}>
            {statusLabel}
          </StatusBadge>
          <p className="syn-assessment-workspace__kicker">Đánh giá chương</p>
          <h1>{assessment.title}</h1>
        </div>
      </div>

      {hasActivities ? (
        <section className="syn-assessment-workspace__activities" aria-label="Nội dung đánh giá">
          {activitySets.map((set) => (
            <AssessmentActivitySet
              key={set.id}
              owner={owner}
              set={set}
              onProgressChanged={invalidate}
            />
          ))}
        </section>
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
