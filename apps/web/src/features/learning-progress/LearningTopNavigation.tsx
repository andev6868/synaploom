import type {
  AssessmentNavigationItem,
  CourseNavigationPayload,
  LessonNavigationItem,
  RequirementView,
} from '@synaploom/protocol';
import { ChevronLeft, ChevronRight, ListTree, LockKeyhole } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { requirementLabel } from '#src/features/learning-progress/SynLessonProgress';

interface FlatLearningItem {
  readonly chapterId: string;
  readonly kind: 'lesson' | 'assessment';
  readonly item: LessonNavigationItem | AssessmentNavigationItem;
}

export interface LearningTopNavigationProps {
  readonly navigation: CourseNavigationPayload;
  readonly viewedItemId: string;
  readonly onOpenLesson: (chapterId: string, lessonId: string) => void;
  readonly onOpenAssessment: (chapterId: string, assessmentId: string) => void;
  readonly onLockedItem?: (requirements: readonly RequirementView[]) => void;
}

function flattenNavigation(navigation: CourseNavigationPayload): readonly FlatLearningItem[] {
  return navigation.chapters.flatMap((chapter) => [
    ...chapter.lessons.map((item) => ({
      chapterId: chapter.id,
      kind: 'lesson' as const,
      item,
    })),
    ...chapter.assessments.map((item) => ({
      chapterId: chapter.id,
      kind: 'assessment' as const,
      item,
    })),
  ]);
}

function openItem(item: FlatLearningItem, props: LearningTopNavigationProps): void {
  if (item.item.status === 'LOCKED') {
    props.onLockedItem?.(item.item.blockingRequirements);
    return;
  }
  if (item.kind === 'lesson') props.onOpenLesson(item.chapterId, item.item.id);
  else props.onOpenAssessment(item.chapterId, item.item.id);
}

function itemLabel(item: FlatLearningItem): string {
  const optional = item.item.required ? '' : ' · Tùy chọn';
  const assessment = item.kind === 'assessment' ? 'Đánh giá · ' : '';
  return `${assessment}${item.item.title}${optional}`;
}

export function LearningTopNavigation(props: LearningTopNavigationProps): ReactNode {
  const { navigation, viewedItemId } = props;
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [lockedRequirements, setLockedRequirements] = useState<readonly RequirementView[] | null>(
    null,
  );
  const courseItems = useMemo(() => flattenNavigation(navigation), [navigation]);
  const viewedIndex = Math.max(
    0,
    courseItems.findIndex((entry) => entry.item.id === viewedItemId),
  );
  const viewed = courseItems[viewedIndex];
  const chapter = navigation.chapters.find((entry) => entry.id === viewed?.chapterId);
  const chapterItems = useMemo(
    () => courseItems.filter((entry) => entry.chapterId === chapter?.id),
    [chapter?.id, courseItems],
  );
  const previous = courseItems[viewedIndex - 1];
  const next = courseItems[viewedIndex + 1];
  const completed = courseItems.filter((entry) => entry.item.status === 'COMPLETED').length;
  const chapterCompleted = chapterItems.filter((entry) => entry.item.status === 'COMPLETED').length;

  const activate = (entry: FlatLearningItem): void => {
    if (entry.item.status === 'LOCKED') {
      setCurriculumOpen(true);
      setLockedRequirements(entry.item.blockingRequirements);
      props.onLockedItem?.(entry.item.blockingRequirements);
      return;
    }
    setLockedRequirements(null);
    setCurriculumOpen(false);
    openItem(entry, props);
  };

  return (
    <nav className="syn-learning-top-nav" aria-label="Điều hướng khóa học">
      <div
        className="syn-learning-top-nav__steps"
        aria-label={`${chapterCompleted}/${chapterItems.length} mục trong chương đã hoàn thành`}
      >
        {chapterItems.map((entry) => (
          <span
            key={`${entry.kind}:${entry.item.id}`}
            className="syn-learning-top-nav__step"
            data-testid="chapter-step"
            data-status={entry.item.status.toLowerCase()}
            data-current={entry.item.id === viewedItemId || undefined}
            title={itemLabel(entry)}
          />
        ))}
      </div>

      <label className="syn-learning-top-nav__selector syn-learning-top-nav__selector--chapter">
        <span>Chương</span>
        <select
          aria-label="Chọn chương"
          value={chapter?.id ?? ''}
          onChange={(event) => {
            const target = courseItems.find(
              (entry) => entry.chapterId === event.target.value && entry.item.status !== 'LOCKED',
            );
            if (target) activate(target);
          }}
        >
          {navigation.chapters.map((entry, index) => (
            <option key={entry.id} value={entry.id} disabled={entry.status === 'LOCKED'}>
              Ch{index + 1}: {entry.title}
            </option>
          ))}
        </select>
      </label>

      <label className="syn-learning-top-nav__selector syn-learning-top-nav__selector--item">
        <span>Bài học</span>
        <select
          aria-label="Chọn bài học hoặc đánh giá"
          value={viewed?.item.id ?? ''}
          onChange={(event) => {
            const target = courseItems.find((entry) => entry.item.id === event.target.value);
            if (target) activate(target);
          }}
        >
          {chapterItems.map((entry) => (
            <option
              key={`${entry.kind}:${entry.item.id}`}
              value={entry.item.id}
              disabled={entry.item.status === 'LOCKED'}
            >
              {itemLabel(entry)}
            </option>
          ))}
        </select>
      </label>

      <div className="syn-learning-top-nav__actions">
        <button
          type="button"
          aria-label="Mục học trước"
          disabled={!previous}
          onClick={() => previous && activate(previous)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="Mục học tiếp theo"
          disabled={!next}
          aria-disabled={next?.item.status === 'LOCKED' || undefined}
          onClick={() => next && activate(next)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          className="syn-learning-top-nav__curriculum-trigger"
          aria-expanded={curriculumOpen}
          aria-controls="syn-learning-curriculum-popover"
          onClick={() => {
            setCurriculumOpen((open) => !open);
            setLockedRequirements(null);
          }}
        >
          <ListTree size={17} />
          <span>Nội dung</span>
        </button>
      </div>

      {curriculumOpen ? (
        <div id="syn-learning-curriculum-popover" className="syn-learning-curriculum-popover">
          <header>
            <strong>Nội dung khóa học</strong>
            <span>
              {completed}/{courseItems.length} mục đã hoàn thành
            </span>
          </header>
          <div className="syn-learning-curriculum-popover__body">
            {navigation.chapters.map((chapterEntry, chapterIndex) => (
              <section key={chapterEntry.id}>
                <h2>
                  Chương {chapterIndex + 1} · {chapterEntry.title}
                </h2>
                {courseItems
                  .filter((entry) => entry.chapterId === chapterEntry.id)
                  .map((entry) => (
                    <button
                      key={`${entry.kind}:${entry.item.id}`}
                      type="button"
                      data-current={entry.item.id === viewedItemId || undefined}
                      data-status={entry.item.status.toLowerCase()}
                      aria-current={entry.item.id === viewedItemId ? 'step' : undefined}
                      aria-disabled={entry.item.status === 'LOCKED'}
                      onClick={() => activate(entry)}
                    >
                      <span className="syn-learning-curriculum-popover__marker" aria-hidden="true">
                        {entry.item.status === 'COMPLETED' ? (
                          '✓'
                        ) : entry.item.status === 'LOCKED' ? (
                          <LockKeyhole size={13} />
                        ) : entry.kind === 'assessment' ? (
                          'A'
                        ) : (
                          '•'
                        )}
                      </span>
                      <span>
                        <strong>{entry.item.title}</strong>
                        <small>
                          {entry.kind === 'assessment'
                            ? 'Đánh giá chương'
                            : entry.item.required
                              ? 'Bắt buộc'
                              : 'Tùy chọn'}
                        </small>
                      </span>
                    </button>
                  ))}
              </section>
            ))}
          </div>
          {lockedRequirements ? (
            <div className="syn-learning-curriculum-popover__blockers" role="alert">
              <strong>Mục này chưa thể mở</strong>
              <ul>
                {lockedRequirements.filter(
                  (requirement) => requirement.required && !requirement.satisfied,
                ).length === 0 ? (
                  <li>Chưa đáp ứng điều kiện mở khóa.</li>
                ) : (
                  lockedRequirements
                    .filter((requirement) => requirement.required && !requirement.satisfied)
                    .map((requirement) => (
                      <li key={`${requirement.kind}:${requirement.id}`}>
                        {requirementLabel(requirement)}
                      </li>
                    ))
                )}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
