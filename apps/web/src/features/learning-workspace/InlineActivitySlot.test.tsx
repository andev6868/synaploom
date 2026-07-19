import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { InlineActivitySlot } from '#src/features/learning-workspace/InlineActivitySlot';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

const item: ResolvedWorkspaceActivity = {
  setId: 'set',
  required: true,
  policy: {
    purpose: 'practice',
    maxAttempts: null,
    feedbackMode: 'immediate',
    revealAnswers: 'never',
    scoring: 'points',
    passingScore: null,
  },
  activity: {
    id: 'quiz',
    kind: 'short-answer',
    title: 'Quiz',
    prompt: { blocks: [] },
    config: {},
    evaluation: { mode: 'automatic', points: 1 },
    completion: { required: true },
    presentation: {
      defaultSurface: 'inline',
      allowInline: true,
      allowPractice: true,
      preferredWidth: 'compact',
      supportsFullscreen: false,
    },
  },
};
const owner = { courseId: 'course', ownerKind: 'lessons' as const, ownerId: 'lesson' };

it('never mounts an editable activity host', () => {
  const open = vi.fn(() => Promise.resolve());
  render(
    <InlineActivitySlot
      item={item}
      owner={owner}
      focused={false}
      paneMode="collapsed"
      status={null}
      onOpenPractice={open}
      onProgressChanged={vi.fn()}
      onPersistenceHandleChange={vi.fn()}
      renderHost={() => <input aria-label="editor" />}
    />,
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thực hành bài này' }));
  expect(open).toHaveBeenCalledWith('quiz');
});

it('renders a read-only summary rather than a duplicate editor while focused', () => {
  render(
    <InlineActivitySlot
      item={item}
      owner={owner}
      focused
      paneMode="split"
      status={{
        activityId: 'quiz',
        status: 'DRAFT',
        attemptNumber: 1,
        score: null,
        maxScore: null,
        passed: null,
      }}
      onOpenPractice={vi.fn()}
      onProgressChanged={vi.fn()}
      onPersistenceHandleChange={vi.fn()}
      renderHost={() => <input aria-label="editor" />}
    />,
  );
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText('Activity đang mở trong khu vực thực hành.')).toBeVisible();
  expect(screen.getByText('Đang làm · Đã lưu bản nháp')).toBeVisible();
});
