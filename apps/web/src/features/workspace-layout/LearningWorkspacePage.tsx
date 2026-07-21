import type {
  ActivityOwner,
  CanonicalLessonPayload,
  ChapterAssessmentPayload,
  CourseNavigationPayload,
  ActivityStatusPayload,
  PublicActivitySetPayload,
  WorkspacePresentationState,
  CompletionPayload,
  LessonPayload,
  NextActionPayload,
} from '@synaploom/protocol';
import { AppHeader, ScrollArea, StatusBadge } from '@synaploom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { navigateToAssessment, navigateToLesson } from '#src/app/router/lesson-route';
import { AssistantSelectionToolbar } from '#src/features/ai-assistant/AssistantSelectionToolbar';
import { AssistantTrigger } from '#src/features/ai-assistant/AssistantTrigger';
import { ContextualAssistantLayer } from '#src/features/ai-assistant/ContextualAssistantLayer';
import { useContextualAssistant } from '#src/features/ai-assistant/useContextualAssistant';
import { useTheoryAssistantSelection } from '#src/features/ai-assistant/useTheoryAssistantSelection';
import { AssessmentWorkspaceContent } from '#src/features/chapter-assessment/AssessmentWorkspaceContent';
import { LessonActivities } from '#src/features/lesson-content/LessonActivities';
import { LearningWorkspaceShell } from '#src/features/learning-workspace/LearningWorkspaceShell';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
import { PracticePane } from '#src/features/learning-workspace/PracticePane';
import {
  activityStatusesKey,
  useLearningWorkspaceController,
  workspacePresentationKey,
} from '#src/features/learning-workspace/useLearningWorkspaceController';
import { flattenWorkspaceActivities } from '#src/features/learning-workspace/workspace-model';
import { WorkspacePaneRail } from '#src/features/learning-workspace/WorkspacePaneRail';
import { LessonRequirementFooter } from '#src/features/lesson-progress/LessonRequirementFooter';
import { LearningTopNavigation } from '#src/features/learning-progress/LearningTopNavigation';
import { buildLearningProgressSummary } from '#src/features/learning-progress/progress-summary';
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

function LessonWorkspaceComposition({
  owner,
  chapterId,
  lesson,
  activitySets,
  presentation,
  statuses,
  heading,
  renderFooter,
  onNavigationAction,
  onProgressChanged,
}: {
  readonly owner: ActivityOwner;
  readonly chapterId?: string;
  readonly lesson: LessonPayload;
  readonly activitySets: readonly PublicActivitySetPayload[];
  readonly presentation: WorkspacePresentationState;
  readonly statuses: readonly ActivityStatusPayload[];
  readonly heading: (assistantTrigger: ReactNode) => ReactNode;
  readonly renderFooter: (onAction: (action: NextActionPayload) => void) => ReactNode;
  readonly onNavigationAction: (action: NextActionPayload) => void;
  readonly onProgressChanged: () => Promise<void>;
}): ReactNode {
  const activities = flattenWorkspaceActivities(activitySets);
  const controller = useLearningWorkspaceController({
    owner,
    initialState: presentation,
    activities,
  });
  const assistant = useContextualAssistant({
    target: {
      courseId: owner.courseId,
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      ...(chapterId ? { chapterId } : {}),
    },
  });
  const theoryContainerRef = useRef<HTMLElement | null>(null);
  const theorySelection = useTheoryAssistantSelection(theoryContainerRef);
  const askAboutTheorySelection = (anchor: DOMRect): void => {
    const selected = theorySelection.selection;
    if (!selected) return;
    assistant.openQuick({
      source: 'theory',
      sectionTitle: lesson.title,
      selectedText: selected.text,
      anchor,
    });
    theorySelection.clearToolbar();
    window.getSelection()?.removeAllRanges();
  };
  const onAction = (action: NextActionPayload): void => {
    if (action.type === 'START_REQUIRED_PRACTICE' || action.type === 'RETRY_REQUIRED_PRACTICE') {
      const direct = activities.find((item) => item.activity.id === action.practiceId);
      const bySet = activities.find((item) => item.setId === action.practiceId && item.required);
      const target = direct ?? bySet;
      if (target) void controller.focusActivity(target.activity.id).catch(() => undefined);
      return;
    }
    onNavigationAction(action);
  };
  const theory = (
    <section className="syn-lesson-panel">
      <ScrollArea className="syn-lesson-panel__scroll">
        <article
          ref={theoryContainerRef}
          className="syn-lesson-panel__article"
          data-theory-reading-column
        >
          {heading(
            <AssistantTrigger
              source="theory"
              onInvoke={(anchor) =>
                assistant.openQuick({ source: 'theory', sectionTitle: lesson.title, anchor })
              }
            />,
          )}
          {theorySelection.selection ? (
            <AssistantSelectionToolbar
              selection={theorySelection.selection}
              onAsk={askAboutTheorySelection}
            />
          ) : null}
          <LessonActivities
            blocks={lesson.blocks}
            activities={activities}
            statuses={statuses}
            focusedActivityId={controller.state.focusedActivityId}
            controller={controller}
          />
          {renderFooter(onAction)}
        </article>
      </ScrollArea>
    </section>
  );
  const practice = (
    <PracticePane
      owner={owner}
      activities={activities}
      statuses={statuses}
      controller={controller}
      onProgressChanged={onProgressChanged}
      onAskPractice={(invocation) => assistant.openQuick(invocation)}
    />
  );
  const practiceRail = (
    <WorkspacePaneRail
      activities={activities}
      statuses={statuses}
      focusedActivity={controller.focusedActivity}
      controller={controller}
    />
  );
  const navigator = (
    <PracticeActivityNavigator
      activities={activities}
      statuses={statuses}
      focusedActivityId={controller.state.focusedActivityId}
      onSelectActivity={(activityId) => controller.focusActivity(activityId)}
    />
  );
  const theoryRail = (
    <aside className="syn-theory-pane-rail">
      <button
        type="button"
        onClick={() => {
          void controller.restoreSplitPane().catch(() => undefined);
        }}
      >
        Mở lại lý thuyết
      </button>
    </aside>
  );
  return (
    <LearningWorkspaceShell
      mode={controller.state.paneMode}
      splitRatio={controller.state.splitRatio}
      theory={theory}
      practice={practice}
      practiceRail={practiceRail}
      theoryRail={theoryRail}
      navigator={navigator}
      overlay={<ContextualAssistantLayer controller={assistant} />}
      practiceTitle={controller.focusedActivity?.activity.title ?? 'Khu vực thực hành'}
      onSplitRatioCommit={(ratio) => controller.setSplitRatio(ratio)}
      onCloseMobilePractice={() => controller.collapsePracticePane()}
      eventOwner={owner}
    />
  );
}

function AssessmentWorkspaceComposition({
  owner,
  chapterId,
  assessment,
  navigation,
  activitySets,
  presentation,
  statuses,
  onAction,
  onProgressChanged,
}: {
  readonly owner: ActivityOwner;
  readonly chapterId: string;
  readonly assessment: ChapterAssessmentPayload;
  readonly navigation: CourseNavigationPayload;
  readonly activitySets: readonly PublicActivitySetPayload[];
  readonly presentation: WorkspacePresentationState;
  readonly statuses: readonly ActivityStatusPayload[];
  readonly onAction: (action: NextActionPayload) => void;
  readonly onProgressChanged: () => Promise<void>;
}): ReactNode {
  const activities = flattenWorkspaceActivities(activitySets);
  const controller = useLearningWorkspaceController({
    owner,
    initialState: presentation,
    activities,
  });
  const assistant = useContextualAssistant({
    target: {
      courseId: owner.courseId,
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      chapterId,
    },
  });
  const theoryContainerRef = useRef<HTMLElement | null>(null);
  const theorySelection = useTheoryAssistantSelection(theoryContainerRef);
  const askAboutTheorySelection = (anchor: DOMRect): void => {
    const selected = theorySelection.selection;
    if (!selected) return;
    assistant.openQuick({
      source: 'theory',
      sectionTitle: assessment.title,
      selectedText: selected.text,
      anchor,
    });
    theorySelection.clearToolbar();
    window.getSelection()?.removeAllRanges();
  };
  const theory = (
    <section className="syn-lesson-panel">
      <ScrollArea className="syn-lesson-panel__scroll">
        <article
          ref={theoryContainerRef}
          className="syn-lesson-panel__article"
          data-theory-reading-column
        >
          <div className="syn-theory-assistant-entry">
            <AssistantTrigger
              source="theory"
              onInvoke={(anchor) =>
                assistant.openQuick({ source: 'theory', sectionTitle: assessment.title, anchor })
              }
            />
          </div>
          {theorySelection.selection ? (
            <AssistantSelectionToolbar
              selection={theorySelection.selection}
              onAsk={askAboutTheorySelection}
            />
          ) : null}
          <AssessmentWorkspaceContent
            chapterId={chapterId}
            assessment={assessment}
            navigation={navigation}
            activities={activities}
            statuses={statuses}
            focusedActivityId={controller.state.focusedActivityId}
            controller={controller}
            onAction={onAction}
          />
        </article>
      </ScrollArea>
    </section>
  );
  const practice = (
    <PracticePane
      owner={owner}
      activities={activities}
      statuses={statuses}
      controller={controller}
      onProgressChanged={onProgressChanged}
      onAskPractice={(invocation) => assistant.openQuick(invocation)}
    />
  );
  const practiceRail = (
    <WorkspacePaneRail
      activities={activities}
      statuses={statuses}
      focusedActivity={controller.focusedActivity}
      controller={controller}
    />
  );
  const navigator = (
    <PracticeActivityNavigator
      activities={activities}
      statuses={statuses}
      focusedActivityId={controller.state.focusedActivityId}
      onSelectActivity={(activityId) => controller.focusActivity(activityId)}
    />
  );
  const theoryRail = (
    <aside className="syn-theory-pane-rail">
      <button
        type="button"
        onClick={() => {
          void controller.restoreSplitPane().catch(() => undefined);
        }}
      >
        Mở lại nội dung đánh giá
      </button>
    </aside>
  );
  return (
    <LearningWorkspaceShell
      mode={controller.state.paneMode}
      splitRatio={controller.state.splitRatio}
      theory={theory}
      practice={practice}
      practiceRail={practiceRail}
      theoryRail={theoryRail}
      navigator={navigator}
      overlay={<ContextualAssistantLayer controller={assistant} />}
      practiceTitle={controller.focusedActivity?.activity.title ?? 'Khu vực thực hành'}
      onSplitRatioCommit={(ratio) => controller.setSplitRatio(ratio)}
      onCloseMobilePractice={() => controller.collapsePracticePane()}
      eventOwner={owner}
    />
  );
}

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
  const assessmentQuery = useQuery({
    queryKey: [
      'chapter-assessment',
      route.kind === 'assessment' ? route.courseId : undefined,
      route.kind === 'assessment' ? route.chapterId : undefined,
      route.kind === 'assessment' ? route.assessmentId : undefined,
    ],
    queryFn: () =>
      api.getChapterAssessment(
        route.kind === 'assessment' ? route.chapterId : '',
        route.kind === 'assessment' ? route.assessmentId : '',
      ),
    enabled: route.kind === 'assessment',
  });
  const loadedLessonId =
    route.kind === 'lesson'
      ? ((canonicalLessonQuery.data as CanonicalLessonPayload | undefined)?.lesson.id ??
        legacyLessonQuery.data?.id ??
        lessonRoute?.lessonId)
      : null;
  const activityCourseId = navigationCourseId ?? courseQuery.data?.id;
  const activityOwner: ActivityOwner | null =
    route.kind === 'assessment' && activityCourseId
      ? {
          courseId: activityCourseId,
          ownerKind: 'assessments',
          ownerId: route.assessmentId,
        }
      : route.kind === 'lesson' && activityCourseId && loadedLessonId
        ? { courseId: activityCourseId, ownerKind: 'lessons', ownerId: loadedLessonId }
        : null;
  const activitySetsQuery = useQuery({
    queryKey: [
      'activity-sets',
      activityOwner?.courseId,
      activityOwner?.ownerKind,
      activityOwner?.ownerId,
    ],
    queryFn: () => api.getActivitySets(activityOwner as ActivityOwner),
    enabled: activityOwner !== null,
  });
  const presentationQuery = useQuery({
    queryKey: activityOwner ? workspacePresentationKey(activityOwner) : ['workspace-presentation'],
    queryFn: () => api.getWorkspacePresentation(activityOwner as ActivityOwner),
    enabled: activityOwner !== null,
  });
  const statusesQuery = useQuery({
    queryKey: activityOwner ? activityStatusesKey(activityOwner) : ['activity-statuses'],
    queryFn: () => api.getActivityStatuses(activityOwner as ActivityOwner),
    enabled: activityOwner !== null,
  });

  const invalidate = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson-view'] }),
      queryClient.invalidateQueries({ queryKey: ['course-navigation'] }),
      queryClient.invalidateQueries({ queryKey: ['chapter-assessment'] }),
      queryClient.invalidateQueries({ queryKey: ['activity-sets'] }),
      queryClient.invalidateQueries({ queryKey: ['activity-statuses'] }),
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
  const assessmentLoading = route.kind === 'assessment' && assessmentQuery.isLoading;
  const activitySetsLoading =
    activityOwner !== null &&
    (activitySetsQuery.isLoading || presentationQuery.isLoading || statusesQuery.isLoading);
  const loading =
    courseQuery.isLoading ||
    navigationQuery.isLoading ||
    lessonLoading ||
    assessmentLoading ||
    activitySetsLoading;
  if (loading) return <main className="syn-loading">Đang tải không gian học…</main>;

  const lessonError =
    route.kind === 'lesson'
      ? canonicalLesson
        ? canonicalLessonQuery.error
        : legacyLessonQuery.error
      : null;
  const error =
    courseQuery.error ??
    navigationQuery.error ??
    lessonError ??
    assessmentQuery.error ??
    activitySetsQuery.error ??
    presentationQuery.error ??
    statusesQuery.error;
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
      trailing={
        <div className="syn-learning-header-trailing">
          <StatusBadge status="passed">Local</StatusBadge>
          <span className="syn-learning-profile" aria-label="Hồ sơ người học">
            N
          </span>
        </div>
      }
    />
  );

  if (route.kind === 'assessment') {
    const assessment = assessmentQuery.data;
    const presentation = presentationQuery.data;
    if (!assessment || !activityOwner || !presentation) return null;
    return (
      <div className="syn-learning-app">
        {header}
        <AssessmentWorkspaceComposition
          owner={activityOwner}
          chapterId={route.chapterId}
          assessment={assessment}
          navigation={navigation}
          activitySets={(activitySetsQuery.data ?? []) as readonly PublicActivitySetPayload[]}
          presentation={presentation}
          statuses={statusesQuery.data ?? []}
          onAction={onNextAction}
          onProgressChanged={invalidate}
        />
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
  const presentation = presentationQuery.data;
  if (activityOwner?.ownerKind !== 'lessons' || !presentation) return null;
  const heading = (assistantTrigger: ReactNode): ReactNode => (
    <div className="syn-lesson-panel__heading">
      <div>
        <div className="syn-lesson-panel__status-row">
          <StatusBadge status={lesson.status === 'COMPLETED' ? 'passed' : 'active'}>
            {lessonStatusLabel}
          </StatusBadge>
          {assistantTrigger}
        </div>
        <h1>{lesson.title}</h1>
      </div>
      <div
        className="syn-learning-progress-summary"
        aria-label="Tiến độ bài học"
        data-lesson-progress-card
      >
        <div className="syn-learning-progress-summary__copy">
          <strong>{progressSummary.positionLabel}</strong>
          <span>{progressSummary.completionLabel}</span>
        </div>
        <div className="syn-learning-progress-summary__meter">
          <progress
            aria-label="Tiến độ bài học"
            max={Math.max(1, progressSummary.requiredTotal)}
            value={progressSummary.completedRequired}
          />
          {progressSummary.complete ? (
            <CheckCircle2
              aria-label="Đã hoàn thành toàn bộ bài bắt buộc"
              data-testid="lesson-progress-complete-icon"
              size={20}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="syn-learning-app">
      {header}
      <LessonWorkspaceComposition
        owner={activityOwner}
        {...(route.chapterId ? { chapterId: route.chapterId } : {})}
        lesson={lesson}
        activitySets={activitySets}
        presentation={presentation}
        statuses={statusesQuery.data ?? []}
        heading={heading}
        onNavigationAction={onNextAction}
        onProgressChanged={invalidate}
        renderFooter={(handleAction) =>
          context ? (
            <LessonRequirementFooter
              context={context}
              navigation={navigation}
              busy={busy}
              onAction={handleAction}
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
          )
        }
      />
    </div>
  );
}
