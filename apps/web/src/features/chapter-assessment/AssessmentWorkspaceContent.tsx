import type {
  ActivityOwner,
  CourseNavigationPayload,
  LessonViewContext,
  NextActionPayload,
  PublicActivitySetPayload,
} from '@synaploom/protocol';
import { StatusBadge } from '@synaploom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

function stringField(value: Record<string, unknown> | null, key: string): string | null {
  const field = value?.[key];
  return typeof field === 'string' && field.trim() ? field : null;
}

function numberField(value: Record<string, unknown> | null, key: string): number | null {
  const field = value?.[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : null;
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
    ]);
  };
  const check = useMutation({
    mutationFn: () =>
      api.recordChapterAssessment(chapterId, assessmentId, {
        passed: true,
        summary: 'Completed from assessment workspace.',
      }),
    onSuccess: invalidate,
  });

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

  const activitySets = (activitySetsQuery.data ?? []) as readonly PublicActivitySetPayload[];
  const activityReferences = activitySets.flatMap((set) =>
    set.activities.map((reference) => ({ ...reference, policy: set.policy, setId: set.id })),
  );
  const hasActivities = activityReferences.length > 0;
  const latestSummary = stringField(assessment.latestResult, 'summary');
  const latestScore = numberField(assessment.latestResult, 'score');
  const bestScore = numberField(assessment.bestResult, 'score');
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

      {latestSummary || latestScore !== null || bestScore !== null ? (
        <section className="syn-assessment-workspace__result" aria-live="polite">
          <h2>Kết quả đánh giá</h2>
          {latestSummary ? <p>{latestSummary}</p> : null}
          {latestScore !== null ? <p>Điểm gần nhất: {latestScore}</p> : null}
          {bestScore !== null ? <p>Điểm cao nhất: {bestScore}</p> : null}
        </section>
      ) : null}

      {hasActivities ? (
        <section className="syn-assessment-workspace__activities" aria-label="Nội dung đánh giá">
          {activityReferences.map((reference) => (
            <ActivityHost
              key={`${reference.setId}-${reference.activity.id}`}
              owner={owner}
              activity={reference.activity}
              policy={reference.policy}
              onProgressChanged={invalidate}
            />
          ))}
        </section>
      ) : assessment.status !== 'COMPLETED' ? (
        <button
          className="syn-assessment-workspace__check"
          type="button"
          disabled={check.isPending || assessment.status === 'LOCKED'}
          onClick={() => check.mutate()}
        >
          {check.isPending
            ? 'Đang kiểm tra…'
            : (assessment.actions[0]?.label ?? 'Kiểm tra kết quả')}
        </button>
      ) : null}

      <LessonRequirementFooter
        context={context}
        navigation={navigation}
        heading="Yêu cầu hoàn thành đánh giá"
        busy={check.isPending}
        onAction={onAction}
      />
    </article>
  );
}
