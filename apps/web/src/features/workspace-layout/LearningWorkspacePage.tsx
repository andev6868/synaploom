import type {
  CanonicalLessonPayload,
  CompletionPayload,
  LessonPayload,
  NextActionPayload,
} from '@synaploom/protocol';
import { AppHeader, LessonProgress, ScrollArea, StatusBadge, WorkspaceShell } from '@synaploom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { navigateToAssessment, navigateToLesson } from '#src/app/router/lesson-route';
import { AssistantPanel } from '#src/features/ai-assistant/AssistantPanel';
import { LessonContent } from '#src/features/lesson-content/LessonContent';
import { LessonRequirementFooter } from '#src/features/lesson-progress/LessonRequirementFooter';
import { SynLessonProgress } from '#src/features/learning-progress/SynLessonProgress';
import { PracticePanel } from '#src/features/practice-runner/PracticePanel';
import { CompletionBar } from '#src/features/progression/CompletionBar';
import { ReviewBanner } from '#src/features/review-mode/ReviewBanner';

export function LearningWorkspacePage({
  requestedLessonId,
  requestedCourseId,
  requestedChapterId,
}: {
  readonly requestedLessonId: string | null;
  readonly requestedCourseId?: string;
  readonly requestedChapterId?: string;
}): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionPayload | null>(null);
  const canonical = Boolean(requestedCourseId && requestedChapterId && requestedLessonId);
  const courseQuery = useQuery({ queryKey: ['course'], queryFn: () => api.getCourse() });
  const navigationQuery = useQuery({
    queryKey: ['course-navigation', requestedCourseId],
    queryFn: () => api.getNavigation(requestedCourseId as string),
    enabled: canonical,
  });
  const canonicalLessonQuery = useQuery({
    queryKey: ['lesson-view', requestedCourseId, requestedChapterId, requestedLessonId],
    queryFn: () =>
      api.getLessonView(
        requestedCourseId as string,
        requestedChapterId as string,
        requestedLessonId as string,
      ),
    enabled: canonical,
  });
  const legacyLessonQuery = useQuery({
    queryKey: ['lesson', requestedLessonId ?? 'current'],
    queryFn: () => (requestedLessonId ? api.getLesson(requestedLessonId) : api.getCurrentLesson()),
    enabled: !canonical,
  });
  const paneQuery = useQuery({ queryKey: ['pane-ratio'], queryFn: () => api.getPaneRatio() });

  const invalidate = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson-view'] }),
      queryClient.invalidateQueries({ queryKey: ['course-navigation'] }),
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

  const loading =
    courseQuery.isLoading ||
    (canonical
      ? canonicalLessonQuery.isLoading || navigationQuery.isLoading
      : legacyLessonQuery.isLoading);
  if (loading) return <main className="syn-loading">Đang tải không gian học…</main>;
  const error =
    courseQuery.error ??
    (canonical ? (canonicalLessonQuery.error ?? navigationQuery.error) : legacyLessonQuery.error);
  if (error)
    return (
      <main className="syn-error">
        <h1>Không thể mở bài học</h1>
        <p>{error instanceof Error ? error.message : 'Lỗi không xác định'}</p>
      </main>
    );
  const course = courseQuery.data;
  const canonicalPayload = canonicalLessonQuery.data as CanonicalLessonPayload | undefined;
  const lesson = (canonical ? canonicalPayload?.lesson : legacyLessonQuery.data) as
    LessonPayload | undefined;
  if (!course || !lesson) return null;

  const context = canonicalPayload?.context;
  const navigation = navigationQuery.data;
  const busy = reading.isPending || complete.isPending;
  const completedLessons = course.lessons.filter((item) => item.status === 'COMPLETED').length;
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
        navigateToLesson(requestedCourseId ?? course.id, action.chapterId, action.lessonId);
        break;
      case 'START_CHAPTER_ASSESSMENT':
      case 'RETRY_CHAPTER_ASSESSMENT':
        navigateToAssessment(requestedCourseId ?? course.id, action.chapterId, action.assessmentId);
        break;
      case 'CONTINUE_TO_CHAPTER': {
        const chapter = navigation?.chapters.find((item) => item.id === action.chapterId);
        const target = chapter?.lessons.find((item) => item.status !== 'LOCKED');
        if (target) navigateToLesson(requestedCourseId ?? course.id, action.chapterId, target.id);
        break;
      }
      case 'VIEW_COURSE_SUMMARY':
        window.location.hash = 'course-summary';
        break;
      case 'NONE':
        break;
    }
  };

  const lessonPanel = (
    <section className="syn-lesson-panel">
      <ScrollArea className="syn-lesson-panel__scroll">
        <article className="syn-lesson-panel__article">
          {navigation ? (
            <SynLessonProgress
              navigation={navigation}
              viewedItemId={lesson.id}
              onOpenLesson={(chapterId, lessonId) =>
                navigateToLesson(course.id, chapterId, lessonId)
              }
              onOpenAssessment={(chapterId, assessmentId) =>
                navigateToAssessment(course.id, chapterId, assessmentId)
              }
              onLockedItem={() => undefined}
            />
          ) : null}
          {context?.viewMode === 'REVIEW' && context.returnTarget ? (
            <ReviewBanner
              currentTitle={context.returnTarget.label}
              onReturn={() => {
                if (context.returnTarget?.chapterId)
                  navigateToLesson(
                    course.id,
                    context.returnTarget.chapterId,
                    context.returnTarget.id,
                  );
              }}
            />
          ) : null}
          <nav className="syn-breadcrumb" aria-label="Breadcrumb">
            {course.title} / Bài {lesson.position}
          </nav>
          <div className="syn-lesson-panel__heading">
            <div>
              <StatusBadge status={lesson.status === 'COMPLETED' ? 'passed' : 'active'}>
                {lesson.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang học'}
              </StatusBadge>
              <h1>{lesson.title}</h1>
            </div>
            <LessonProgress
              current={completedLessons + (lesson.status === 'COMPLETED' ? 0 : 1)}
              total={course.lessons.length}
            />
          </div>
          <LessonContent blocks={lesson.blocks} />
          {context ? (
            <LessonRequirementFooter context={context} busy={busy} onAction={onNextAction} />
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
  const practicePanel = (
    <PracticePanel lesson={lesson} onActionComplete={() => void invalidate()} />
  );
  return (
    <div className="syn-learning-app">
      <AppHeader
        courseTitle={course.title}
        lessonPosition={lesson.position}
        lessonCount={course.lessons.length}
        trailing={<StatusBadge status="passed">Local</StatusBadge>}
      />
      <WorkspaceShell
        defaultLessonSize={Math.round((paneQuery.data ?? 0.48) * 100)}
        lesson={lessonPanel}
        practice={practicePanel}
        onLessonSizeChange={(percentage) => void api.setPaneRatio(percentage / 100)}
      />
    </div>
  );
}
