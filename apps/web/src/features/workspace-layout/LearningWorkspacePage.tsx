import type {
  ActivityOwner,
  CanonicalLessonPayload,
  PublicActivitySetPayload,
  CompletionPayload,
  LessonPayload,
  NextActionPayload,
} from '@synaploom/protocol';
import { AppHeader, ScrollArea, StatusBadge, WorkspaceShell } from '@synaploom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { navigateToAssessment, navigateToLesson } from '#src/app/router/lesson-route';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import { AssistantPanel } from '#src/features/ai-assistant/AssistantPanel';
import { AssessmentWorkspaceContent } from '#src/features/chapter-assessment/AssessmentWorkspaceContent';
import { LessonActivities } from '#src/features/lesson-content/LessonActivities';
import { LessonRequirementFooter } from '#src/features/lesson-progress/LessonRequirementFooter';
import { LearningTopNavigation } from '#src/features/learning-progress/LearningTopNavigation';
import { buildLearningProgressSummary } from '#src/features/learning-progress/progress-summary';
import { PracticePanel } from '#src/features/practice-runner/PracticePanel';
import { resolveWorkspaceLayout } from '#src/features/workspace-layout/activity-layout';
import { CompletionBar } from '#src/features/progression/CompletionBar';
import type { NavigationViewTarget } from '#src/shared/api/client';

export type LearningWorkspaceRoute =
  | {
      readonly kind: 'lesson';
      readonly courseId?: string;
      readonly chapterId?: string;
      readonly lessonId: string | null;
    }
  | {
      readonly kind: 'assessment';
      readonly courseId: string;
      readonly chapterId: string;
      readonly assessmentId: string;
    };

export function LearningWorkspacePage({
  route,
}: {
  readonly route: LearningWorkspaceRoute;
}): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionPayload | null>(null);
  const lessonRoute = route.kind === 'lesson' ? route : null;
  const canonicalLesson = Boolean(
    lessonRoute?.courseId && lessonRoute.chapterId && lessonRoute.lessonId,
  );

  const courseQuery = useQuery({ queryKey: ['course'], queryFn: () => api.getCourse() });
  const navigationCourseId = route.courseId ?? courseQuery.data?.id;
  const navigationView: NavigationViewTarget | undefined =
    route.kind === 'assessment'
      ? {
          kind: 'assessment',
          id: route.assessmentId,
          chapterId: route.chapterId,
        }
      : route.lessonId
        ? {
            kind: 'lesson',
            id: route.lessonId,
            ...(route.chapterId ? { chapterId: route.chapterId } : {}),
          }
        : undefined;
  const navigationQuery = useQuery({
    queryKey: [
      'course-navigation',
      navigationCourseId,
      navigationView?.kind,
      navigationView?.chapterId,
      navigationView?.id,
    ],
    queryFn: () => api.getNavigation(navigationCourseId as string, navigationView),
    enabled: Boolean(navigationCourseId),
  });
  const canonicalLessonQuery = useQuery({
    queryKey: ['lesson-view', lessonRoute?.courseId, lessonRoute?.chapterId, lessonRoute?.lessonId],
    queryFn: () =>
      api.getLessonView(
        lessonRoute?.courseId as string,
        lessonRoute?.chapterId as string,
        lessonRoute?.lessonId as string,
      ),
    enabled: route.kind === 'lesson' && canonicalLesson,
  });
  const legacyLessonQuery = useQuery({
    queryKey: ['lesson', lessonRoute?.lessonId ?? 'current'],
    queryFn: () =>
      lessonRoute?.lessonId ? api.getLesson(lessonRoute.lessonId) : api.getCurrentLesson(),
    enabled: route.kind === 'lesson' && !canonicalLesson,
  });
  const paneQuery = useQuery({
    queryKey: ['pane-ratio'],
    queryFn: () => api.getPaneRatio(),
    enabled: route.kind === 'lesson',
  });
  const loadedLessonId =
    route.kind === 'lesson'
      ? ((canonicalLessonQuery.data as CanonicalLessonPayload | undefined)?.lesson.id ??
        legacyLessonQuery.data?.id ??
        lessonRoute?.lessonId)
      : null;
  const activityCourseId = navigationCourseId ?? courseQuery.data?.id;
  const lessonActivityOwner: ActivityOwner | null =
    route.kind === 'lesson' && activityCourseId && loadedLessonId
      ? { courseId: activityCourseId, ownerKind: 'lessons', ownerId: loadedLessonId }
      : null;
  const activitySetsQuery = useQuery({
    queryKey: [
      'activity-sets',
      lessonActivityOwner?.courseId,
      lessonActivityOwner?.ownerKind,
      lessonActivityOwner?.ownerId,
    ],
    queryFn: () => api.getActivitySets(lessonActivityOwner as ActivityOwner),
    enabled: lessonActivityOwner !== null,
  });

  const invalidate = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson-view'] }),
      queryClient.invalidateQueries({ queryKey: ['course-navigation'] }),
      queryClient.invalidateQueries({ queryKey: ['chapter-assessment'] }),
      queryClient.invalidateQueries({ queryKey: ['activity-sets'] }),
    ]);
  }, [queryClient]);
  const reading = useMutation({
    mutationFn: (lessonId: string) => api.acknowledgeReading(lessonId),
    onSuccess: invalidate,
  });
  const complete = useMutation({
    mutationFn: (lessonId: string) => api.completeLesson(lessonId),
    onSuccess: async (value) => {
      setCompletion(value);
      await invalidate();
    },
  });

  const lessonLoading =
    route.kind === 'lesson' &&
    (canonicalLesson ? canonicalLessonQuery.isLoading : legacyLessonQuery.isLoading);
  const activitySetsLoading = lessonActivityOwner !== null && activitySetsQuery.isLoading;
  const loading =
    courseQuery.isLoading || navigationQuery.isLoading || lessonLoading || activitySetsLoading;
  if (loading) return <main className="syn-loading">Đang tải không gian học…</main>;

  const lessonError =
    route.kind === 'lesson'
      ? canonicalLesson
        ? canonicalLessonQuery.error
        : legacyLessonQuery.error
      : null;
  const error =
    courseQuery.error ?? navigationQuery.error ?? lessonError ?? activitySetsQuery.error;
  if (error)
    return (
      <main className="syn-error">
        <h1>
          {route.kind === 'assessment' ? 'Không thể mở đánh giá chương' : 'Không thể mở bài học'}
        </h1>
        <p>{error instanceof Error ? error.message : 'Lỗi không xác định'}</p>
      </main>
    );

  const course = courseQuery.data;
  const navigation = navigationQuery.data;
  if (!course || !navigation) return null;

  const onNextAction = (action: NextActionPayload): void => {
    switch (action.type) {
      case 'ACKNOWLEDGE_READING':
        reading.mutate(action.lessonId);
        break;
      case 'START_REQUIRED_PRACTICE':
      case 'RETRY_REQUIRED_PRACTICE':
        document.querySelector('.syn-practice-panel')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'CONTINUE_TO_LESSON':
      case 'RETURN_TO_CURRENT_LESSON':
        navigateToLesson(course.id, action.chapterId, action.lessonId);
        break;
      case 'START_CHAPTER_ASSESSMENT':
      case 'RETRY_CHAPTER_ASSESSMENT':
        navigateToAssessment(course.id, action.chapterId, action.assessmentId);
        break;
      case 'CONTINUE_TO_CHAPTER': {
        const chapter = navigation.chapters.find((item) => item.id === action.chapterId);
        const lessonTarget = chapter?.lessons.find((item) => item.status !== 'LOCKED');
        if (lessonTarget) {
          navigateToLesson(course.id, action.chapterId, lessonTarget.id);
          break;
        }
        const assessmentTarget = chapter?.assessments.find((item) => item.status !== 'LOCKED');
        if (assessmentTarget)
          navigateToAssessment(course.id, action.chapterId, assessmentTarget.id);
        break;
      }
      case 'VIEW_COURSE_SUMMARY':
      case 'NONE':
        break;
    }
  };

  const viewedItemId =
    route.kind === 'assessment'
      ? route.assessmentId
      : ((canonicalLessonQuery.data as CanonicalLessonPayload | undefined)?.lesson.id ??
        legacyLessonQuery.data?.id ??
        navigation.viewedItemId);

  const header = (
    <AppHeader
      courseTitle={course.title}
      navigation={
        <LearningTopNavigation
          navigation={navigation}
          viewedItemId={viewedItemId}
          onOpenLesson={(chapterId, lessonId) => navigateToLesson(course.id, chapterId, lessonId)}
          onOpenAssessment={(chapterId, assessmentId) =>
            navigateToAssessment(course.id, chapterId, assessmentId)
          }
        />
      }
      trailing={<StatusBadge status="passed">Local</StatusBadge>}
    />
  );

  if (route.kind === 'assessment') {
    return (
      <div className="syn-learning-app">
        {header}
        <main className="syn-assessment-workspace">
          <section className="syn-lesson-panel">
            <ScrollArea className="syn-lesson-panel__scroll">
              <AssessmentWorkspaceContent
                courseId={course.id}
                chapterId={route.chapterId}
                assessmentId={route.assessmentId}
                navigation={navigation}
                onAction={onNextAction}
              />
            </ScrollArea>
            <AssistantPanel />
          </section>
        </main>
      </div>
    );
  }

  const canonicalPayload = canonicalLessonQuery.data as CanonicalLessonPayload | undefined;
  const lesson = (canonicalLesson ? canonicalPayload?.lesson : legacyLessonQuery.data) as
    LessonPayload | undefined;
  if (!lesson) return null;

  const context = canonicalPayload?.context;
  const busy = reading.isPending || complete.isPending;
  const progressSummary = buildLearningProgressSummary(course, lesson, navigation);
  const lessonStatusLabel =
    context?.viewMode === 'REVIEW'
      ? 'Đang xem lại'
      : lesson.status === 'COMPLETED'
        ? 'Hoàn thành'
        : 'Đang học';
  const activitySets = (activitySetsQuery.data ?? []) as readonly PublicActivitySetPayload[];
  const activityReferences = activitySets.flatMap((set) =>
    set.activities.map((reference) => ({ ...reference, policy: set.policy })),
  );
  const codingActivity = activityReferences.find(
    (reference) => reference.activity.kind === 'coding',
  );
  const inlineKinds = activityReferences
    .filter((reference) => reference.activity.kind !== 'coding')
    .map((reference) => reference.activity.kind);
  const workspaceLayout = resolveWorkspaceLayout({
    hasDocument: lesson.blocks.length > 0,
    embeddedKinds: inlineKinds,
    focusedKind: codingActivity ? 'coding' : null,
  });
  const lessonPanel = (
    <section className="syn-lesson-panel">
      <ScrollArea className="syn-lesson-panel__scroll">
        <article className="syn-lesson-panel__article">
          <div className="syn-lesson-panel__heading">
            <div>
              <StatusBadge status={lesson.status === 'COMPLETED' ? 'passed' : 'active'}>
                {lessonStatusLabel}
              </StatusBadge>
              <h1>{lesson.title}</h1>
            </div>
            <div className="syn-learning-progress-summary" aria-label="Tiến độ bài học">
              <strong>{progressSummary.positionLabel}</strong>
              <span>{progressSummary.completionLabel}</span>
            </div>
          </div>
          <LessonActivities
            blocks={lesson.blocks}
            owner={lessonActivityOwner as ActivityOwner}
            activitySets={(activitySetsQuery.data ?? []) as readonly PublicActivitySetPayload[]}
            excludedActivityIds={codingActivity ? [codingActivity.activity.id] : []}
            onProgressChanged={invalidate}
          />
          {context ? (
            <LessonRequirementFooter
              context={context}
              navigation={navigation}
              busy={busy}
              onAction={onNextAction}
            />
          ) : (
            <CompletionBar
              lesson={lesson}
              completion={completion}
              busy={busy}
              onAcknowledge={() => reading.mutate(lesson.id)}
              onComplete={() => complete.mutate(lesson.id)}
              onNext={(nextId) => {
                setCompletion(null);
                navigateToLesson(course.id, nextId);
              }}
            />
          )}
        </article>
      </ScrollArea>
      <AssistantPanel />
    </section>
  );
  const practicePanel = lesson.exercise ? (
    <PracticePanel lesson={lesson} onActionComplete={() => void invalidate()} />
  ) : codingActivity && lessonActivityOwner ? (
    <div className="syn-focused-activity-workspace">
      <ActivityHost
        owner={lessonActivityOwner}
        activity={codingActivity.activity}
        policy={codingActivity.policy}
        onProgressChanged={invalidate}
      />
    </div>
  ) : null;

  return (
    <div className="syn-learning-app">
      {header}
      {workspaceLayout === 'split-coding' && practicePanel ? (
        <WorkspaceShell
          defaultLessonSize={Math.round((paneQuery.data ?? 0.48) * 100)}
          lesson={lessonPanel}
          practice={practicePanel}
          onLessonSizeChange={(percentage) => void api.setPaneRatio(percentage / 100)}
        />
      ) : (
        <main className="syn-reading-workspace" data-layout={workspaceLayout}>
          {lessonPanel}
        </main>
      )}
    </div>
  );
}
