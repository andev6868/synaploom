import type { ReactNode } from 'react';

/** Public properties for linear lesson progress. */
export interface LessonProgressProps {
  readonly current: number;
  readonly total: number;
}

/** Displays linear progress while keeping exact position available to assistive technology. */
export function LessonProgress({ current, total }: LessonProgressProps): ReactNode {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(0, current), safeTotal);
  return (
    <div className="syn-lesson-progress">
      <progress
        aria-label={`Tiến độ bài học ${safeCurrent} trên ${safeTotal}`}
        max={safeTotal}
        value={safeCurrent}
      />
      <span>
        {safeCurrent}/{safeTotal}
      </span>
    </div>
  );
}
