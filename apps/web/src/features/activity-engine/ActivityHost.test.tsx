import type { ActivityPublicView, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityOwner } from '@synaploom/protocol';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMemo, useState, type ReactNode } from 'react';
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

  it('projects generic actions into the contained Practice footer', async () => {
    function Harness(): ReactNode {
      const [actions, setActions] = useState<ReactNode>(null);
      const actionOutlet = useMemo(() => ({ setActions }), []);
      return (
        <>
          <ActivityHost
            owner={owner}
            activity={base}
            policy={policy}
            onProgressChanged={vi.fn()}
            surface="practice-contained"
            actionOutlet={actionOutlet}
          />
          <footer data-testid="footer-actions">{actions}</footer>
        </>
      );
    }
    render(
      <AppProviders api={api()}>
        <Harness />
      </AppProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Lưu bản nháp' })).toBeVisible();
    expect(screen.getByTestId('footer-actions')).toContainElement(
      screen.getByRole('button', { name: 'Kiểm tra đáp án' }),
    );
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
  it('keeps the activity mounted and retries when loading the attempt fails', async () => {
    const getAttempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('attempt unavailable'))
      .mockResolvedValueOnce(null);
    render(
      <AppProviders
        api={{ getCurrentActivityAttempt: getAttempt } as unknown as SynaploomApiClient}
      >
        <ActivityHost owner={owner} activity={base} policy={policy} onProgressChanged={vi.fn()} />
      </AppProviders>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('attempt unavailable');
    expect(screen.getByRole('group', { name: 'Question' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    await waitFor(() => expect(getAttempt).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Thử tải lại' })).not.toBeInTheDocument(),
    );
  });
  it('forwards item-level AI actions to supported renderers', async () => {
    const onAskAIAboutItem = vi.fn();
    const ordering: ActivityPublicView = {
      ...base,
      id: 'ordering',
      kind: 'ordering',
      title: 'Ordering',
      config: {
        items: [
          { id: 'read', label: 'Đọc dữ liệu' },
          { id: 'show', label: 'Hiển thị kết quả' },
        ],
        evaluationMode: 'exact',
      },
    };

    render(
      <AppProviders api={api()}>
        <ActivityHost
          owner={owner}
          activity={ordering}
          policy={policy}
          onProgressChanged={vi.fn()}
          onAskAIAboutItem={onAskAIAboutItem}
        />
      </AppProviders>,
    );

    const askButton = await screen.findByRole('button', {
      name: 'Hỏi AI về bước Hiển thị kết quả',
    });
    await waitFor(() => expect(askButton).toBeEnabled());
    fireEvent.click(askButton);
    expect(onAskAIAboutItem).toHaveBeenCalledWith(
      { label: 'Hiển thị kết quả', selectedText: 'Hiển thị kết quả' },
      expect.any(HTMLButtonElement),
    );
  });

});
