import type { CompletionPayload, LessonPayload } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import type { ReactNode } from 'react';

/** Returns the optimistic UI state only; the daemon revalidates every completion request. */
export function canRequestCompletion(lesson: LessonPayload): boolean {
  if (!lesson.readingAcknowledged) return false;
  if (lesson.type === 'theory') return true;
  const required = lesson.latestCheck?.checks.filter((check) => check.required) ?? [];
  return required.length > 0 && required.every((check) => check.passed);
}

/** Completion actions displayed below lesson content. */
export function CompletionBar({
  lesson,
  completion,
  busy,
  onAcknowledge,
  onComplete,
  onNext,
}: {
  readonly lesson: LessonPayload;
  readonly completion: CompletionPayload | null;
  readonly busy: boolean;
  readonly onAcknowledge: () => void;
  readonly onComplete: () => void;
  readonly onNext: (lessonId: string) => void;
}): ReactNode {
  const nextLesson = completion?.nextLesson;
  if (nextLesson)
    return (
      <div className="syn-completion-bar">
        <p>Bài học đã hoàn thành.</p>
        <Button onClick={() => onNext(nextLesson.id)}>Bài tiếp theo</Button>
      </div>
    );
  if (completion?.courseCompleted)
    return (
      <div className="syn-completion-bar">
        <strong>Hoàn thành khóa học</strong>
      </div>
    );
  return (
    <div className="syn-completion-bar">
      {!lesson.readingAcknowledged ? (
        <Button variant="secondary" disabled={busy} onClick={onAcknowledge}>
          Hoàn thành phần đọc
        </Button>
      ) : null}
      <Button disabled={busy || !canRequestCompletion(lesson)} onClick={onComplete}>
        Hoàn thành bài học
      </Button>
    </div>
  );
}
