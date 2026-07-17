import type { CompletionPayload, LessonPayload } from '@synaploom/protocol';
import { AppHeader, LessonProgress, ScrollArea, StatusBadge, WorkspaceShell } from '@synaploom/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { navigateToLesson } from '#src/app/router/lesson-route';
import { AssistantPanel } from '#src/features/ai-assistant/AssistantPanel';
import { LessonContent } from '#src/features/lesson-content/LessonContent';
import { PracticePanel } from '#src/features/practice-runner/PracticePanel';
import { CompletionBar } from '#src/features/progression/CompletionBar';
import { SynaploomApiError } from '#src/shared/api/client';

/** Primary focused learner workspace. */
export function LearningWorkspacePage({
  requestedLessonId,
}: {
  readonly requestedLessonId: string | null;
}): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const [completion, setCompletion] = useState<CompletionPayload | null>(null);
  const courseQuery = useQuery({ queryKey: ['course'], queryFn: () => api.getCourse() });
  const lessonQuery = useQuery({
    queryKey: ['lesson', requestedLessonId ?? 'current'],
    queryFn: () => (requestedLessonId ? api.getLesson(requestedLessonId) : api.getCurrentLesson()),
  });
  const paneQuery = useQuery({ queryKey: ['pane-ratio'], queryFn: () => api.getPaneRatio() });

  useEffect(() => {
    const error = lessonQuery.error;
    const course = courseQuery.data;
    if (
      error instanceof SynaploomApiError &&
      error.code === 'LESSON_LOCKED' &&
      error.currentLessonId &&
      course
    ) {
      navigateToLesson(course.id, error.currentLessonId, true);
    }
  }, [courseQuery.data, lessonQuery.error]);

  const invalidate = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({ queryKey: ['lesson'] }),
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

  if (courseQuery.isLoading || lessonQuery.isLoading)
    return <main className="syn-loading">Đang tải không gian học…</main>;
  if (courseQuery.error || lessonQuery.error)
    return (
      <main className="syn-error">
        <h1>Không thể mở bài học</h1>
        <p>
          {String(
            (courseQuery.error ?? lessonQuery.error) instanceof Error
              ? (courseQuery.error ?? (lessonQuery.error as Error)).message
              : 'Lỗi không xác định',
          )}
        </p>
      </main>
    );
  const course = courseQuery.data;
  const lesson = lessonQuery.data as LessonPayload;
  if (!course || !lesson) return null;

  const busy = reading.isPending || complete.isPending;
  const completedLessons = course.lessons.filter((item) => item.status === 'COMPLETED').length;

  const lessonPanel = (
    <section className="syn-lesson-panel">
      <ScrollArea className="syn-lesson-panel__scroll">
        <article className="syn-lesson-panel__article">
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
        </article>
      </ScrollArea>
      <AssistantPanel />
    </section>
  );

  const practicePanel = (
    <PracticePanel lesson={lesson} onActionComplete={() => void invalidate()} />
  );
  const defaultRatio = Math.round((paneQuery.data ?? 0.48) * 100);

  return (
    <div className="syn-learning-app">
      <AppHeader
        courseTitle={course.title}
        lessonPosition={lesson.position}
        lessonCount={course.lessons.length}
        trailing={<StatusBadge status="passed">Local</StatusBadge>}
      />
      <WorkspaceShell
        defaultLessonSize={defaultRatio}
        lesson={lessonPanel}
        practice={practicePanel}
        onLessonSizeChange={(percentage) => void api.setPaneRatio(percentage / 100)}
      />
    </div>
  );
}
