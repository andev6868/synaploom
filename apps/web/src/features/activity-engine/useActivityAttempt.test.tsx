import type { ActivityAnswer, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityAttempt, ActivityOwner } from '@synaploom/protocol';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { useActivityAttempt } from '#src/features/activity-engine/useActivityAttempt';
import type { SynaploomApiClient } from '#src/shared/api/client';

const owner: ActivityOwner = { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' };
const policy: ActivitySetPolicy = {
  purpose: 'practice',
  maxAttempts: null,
  feedbackMode: 'immediate',
  revealAnswers: 'after-submit',
  scoring: 'points',
  passingScore: null,
};
const answer: ActivityAnswer = { kind: 'single-choice', optionId: 'a' };

function attempt(status: ActivityAttempt['status'], revision = 1): ActivityAttempt {
  return {
    id: 'attempt',
    courseId: 'course',
    courseVersion: '1',
    ownerKind: 'lesson',
    ownerId: 'lesson',
    activityId: 'quiz',
    attemptNumber: 1,
    status,
    answer,
    score: status === 'EVALUATED' ? 1 : null,
    maxScore: status === 'EVALUATED' ? 1 : null,
    passed: status === 'EVALUATED' ? true : null,
    feedback:
      status === 'EVALUATED' ? { summary: 'Đúng', details: [], nextAction: 'continue' } : null,
    startedAt: '2026-07-18T00:00:00Z',
    submittedAt: status === 'DRAFT' ? null : '2026-07-18T00:00:01Z',
    evaluatedAt: status === 'EVALUATED' ? '2026-07-18T00:00:02Z' : null,
    revision,
  };
}

function api(overrides: Partial<SynaploomApiClient> = {}): SynaploomApiClient {
  const unused = (): never => {
    throw new Error('not used');
  };
  return {
    getCourse: unused,
    getNavigation: unused,
    getLessonView: unused,
    getChapterAssessment: unused,
    recordChapterAssessment: unused,
    getActivitySets: () => Promise.resolve([]),
    getActivity: unused,
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.resolve(attempt('DRAFT')),
    submitActivityAttempt: () => Promise.resolve(attempt('EVALUATED')),
    getActivitySetProgress: unused,
    getCurrentLesson: unused,
    getLesson: unused,
    startLesson: unused,
    acknowledgeReading: unused,
    completeLesson: unused,
    listFiles: unused,
    readFile: unused,
    writeFile: unused,
    resetWorkspace: unused,
    runAction: unused,
    requestAi: unused,
    getPaneRatio: unused,
    setPaneRatio: unused,
    ...overrides,
  } as SynaploomApiClient;
}

function Harness({
  onProgressChanged = vi.fn(),
}: {
  readonly onProgressChanged?: () => void;
}): ReactNode {
  const state = useActivityAttempt({ owner, activityId: 'quiz', policy, onProgressChanged });
  return (
    <div>
      <output data-testid="state">{state.state}</output>
      <output data-testid="answer">{JSON.stringify(state.answer)}</output>
      <button type="button" onClick={() => state.setAnswer(answer)}>
        answer
      </button>
      <button type="button" onClick={() => void state.saveDraft()}>
        save
      </button>
      <button type="button" onClick={() => void state.submit()}>
        submit
      </button>
      {state.error ? <div role="alert">{state.error.message}</div> : null}
    </div>
  );
}

describe('useActivityAttempt', () => {
  it('moves through not-started, ready, draft and evaluated states', async () => {
    const save = vi.fn().mockResolvedValue(attempt('DRAFT', 2));
    const submit = vi.fn().mockResolvedValue(attempt('EVALUATED', 2));
    const progress = vi.fn();
    render(
      <AppProviders api={api({ saveActivityDraft: save, submitActivityAttempt: submit })}>
        <Harness onProgressChanged={progress} />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('not-started'));
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(screen.getByTestId('state')).toHaveTextContent('ready');
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('draft'));
    expect(save).toHaveBeenCalledWith(
      owner,
      'quiz',
      expect.objectContaining({ answer, revision: 0 }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('evaluated'));
    expect(submit).toHaveBeenCalledWith(
      owner,
      'quiz',
      expect.objectContaining({ answer, idempotencyKey: expect.any(String) }),
    );
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('shows submitting while a submission is in flight', async () => {
    let resolveSubmit!: (value: ActivityAttempt) => void;
    const submit = vi.fn().mockReturnValue(
      new Promise<ActivityAttempt>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    render(
      <AppProviders api={api({ submitActivityAttempt: submit })}>
        <Harness />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('not-started'));
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('submitting'));

    resolveSubmit(attempt('EVALUATED'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('evaluated'));
  });

  it('allows a failed evaluated attempt to move back to ready when retries remain', async () => {
    const failed = { ...attempt('EVALUATED'), passed: false, score: 0 } satisfies ActivityAttempt;
    render(
      <AppProviders api={api({ getCurrentActivityAttempt: () => Promise.resolve(failed) })}>
        <Harness />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('evaluated'));
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    expect(screen.getByTestId('state')).toHaveTextContent('ready');
  });

  it('reports max-attempt when a failed final attempt is loaded', async () => {
    const exhaustedPolicy = { ...policy, maxAttempts: 1 } satisfies ActivitySetPolicy;
    const failed = { ...attempt('EVALUATED'), passed: false, score: 0 } satisfies ActivityAttempt;

    function ExhaustedHarness(): ReactNode {
      const state = useActivityAttempt({
        owner,
        activityId: 'quiz',
        policy: exhaustedPolicy,
        onProgressChanged: vi.fn(),
      });
      return <output data-testid="state">{state.state}</output>;
    }

    render(
      <AppProviders api={api({ getCurrentActivityAttempt: () => Promise.resolve(failed) })}>
        <ExhaustedHarness />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('max-attempt'));
  });

  it('retains the learner answer after a network error', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('offline'));
    render(
      <AppProviders api={api({ submitActivityAttempt: submit })}>
        <Harness />
      </AppProviders>,
    );
    await screen.findByTestId('state');
    fireEvent.click(screen.getByRole('button', { name: 'answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.getByTestId('state')).toHaveTextContent('error');
    expect(screen.getByTestId('answer')).toHaveTextContent('single-choice');
  });

  it('does not replace a newer local revision with an older draft response', async () => {
    let resolveSave!: (value: ActivityAttempt) => void;
    const save = vi.fn().mockReturnValue(
      new Promise<ActivityAttempt>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(
      <AppProviders
        api={api({
          getCurrentActivityAttempt: () => Promise.resolve(attempt('DRAFT', 3)),
          saveActivityDraft: save,
        })}
      >
        <Harness />
      </AppProviders>,
    );
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('draft'));
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    resolveSave(attempt('DRAFT', 2));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.getByTestId('state')).toHaveTextContent('draft');
  });
});
