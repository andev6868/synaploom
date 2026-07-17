import { BrainCircuit } from 'lucide-react';
import type { ReactNode } from 'react';

/** Public properties for the focused learning header. */
export interface AppHeaderProps {
  readonly courseTitle?: string;
  readonly lessonPosition?: number;
  readonly lessonCount?: number;
  readonly trailing?: ReactNode;
}

/** Renders the thin product header used inside the learner workspace. */
export function AppHeader({
  courseTitle,
  lessonCount,
  lessonPosition,
  trailing,
}: AppHeaderProps): ReactNode {
  return (
    <header className="syn-app-header">
      <div className="syn-app-header__brand">
        <span className="syn-app-header__mark" aria-hidden="true">
          <BrainCircuit size={20} />
        </span>
        <strong>Synaploom</strong>
      </div>
      <div className="syn-app-header__context">
        {courseTitle ? <span>{courseTitle}</span> : null}
        {lessonPosition && lessonCount ? (
          <span className="syn-app-header__position">
            Bài {lessonPosition}/{lessonCount}
          </span>
        ) : null}
      </div>
      <div className="syn-app-header__trailing">{trailing}</div>
    </header>
  );
}
