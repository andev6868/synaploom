import type { ActivityPublicView, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityOwner } from '@synaploom/protocol';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { ActivityFeedback } from '#src/features/activity-engine/ActivityFeedback';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { SynaploomApiClient } from '#src/shared/api/client';

const owner: ActivityOwner = { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' };
const policy: ActivitySetPolicy = {
  purpose: 'practice',
  maxAttempts: null,
  feedbackMode: 'immediate',
  revealAnswers: 'never',
  scoring: 'points',
  passingScore: null,
};
const base: ActivityPublicView = {
  id: 'quiz',
  kind: 'single-choice',
  title: 'Question',
  prompt: { blocks: [] },
  config: {
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
  },
  evaluation: { mode: 'automatic', points: 1 },
  completion: { required: true },
  presentation: {
    defaultSurface: 'inline',
    allowInline: true,
    allowPractice: true,
    preferredWidth: 'compact',
    supportsFullscreen: false,
  },
};

function api(): SynaploomApiClient {
  return {
    getCurrentActivityAttempt: () => Promise.resolve(null),
  } as unknown as SynaploomApiClient;
}

describe('ActivityHost', () => {
  it('dispatches a known activity kind', async () => {
    render(
      <AppProviders api={api()}>
        <ActivityHost owner={owner} activity={base} policy={policy} onProgressChanged={vi.fn()} />
      </AppProviders>,
    );
    expect(await screen.findByRole('group', { name: 'Question' })).toBeVisible();
  });

  it('fails closed for an unknown activity kind', async () => {
    render(
      <AppProviders api={api()}>
        <ActivityHost
          owner={owner}
          activity={{ ...base, kind: 'unknown' as never }}
          policy={policy}
          onProgressChanged={vi.fn()}
        />
      </AppProviders>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Loại hoạt động này chưa được hỗ trợ',
    );
  });

  it('moves focus to new feedback so screen-reader users hear the result', async () => {
    render(
      <ActivityFeedback
        feedback={{
          summary: 'Đúng',
          details: [],
          nextAction: 'continue',
        }}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'Kết quả' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('renders the typed rich prompt before the activity controls', async () => {
    render(
      <AppProviders api={api()}>
        <ActivityHost
          owner={owner}
          activity={{
            ...base,
            prompt: {
              blocks: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Chọn mô tả chính xác nhất.' }],
                },
              ],
            },
          }}
          policy={policy}
          onProgressChanged={vi.fn()}
        />
      </AppProviders>,
    );

    expect(await screen.findByText('Chọn mô tả chính xác nhất.')).toBeVisible();
  });
});
