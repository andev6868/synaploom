import type { PublicActivitySetPayload } from '@synaploom/protocol';
import { describe, expect, it } from 'vitest';
import {
  findActivityStatus,
  findNextActivityId,
  flattenWorkspaceActivities,
} from '#src/features/learning-workspace/workspace-model';

const policy = {
  purpose: 'practice' as const,
  maxAttempts: null,
  feedbackMode: 'immediate' as const,
  revealAnswers: 'never' as const,
  scoring: 'points' as const,
  passingScore: null,
};

function activity(id: string) {
  return {
    id,
    kind: 'short-answer' as const,
    title: id,
    prompt: { blocks: [] },
    config: {},
    evaluation: { mode: 'automatic' as const, points: 1 },
    completion: { required: true },
    presentation: {
      defaultSurface: 'inline' as const,
      allowInline: true,
      allowPractice: true,
      preferredWidth: 'compact' as const,
      supportsFullscreen: false,
    },
  };
}

const sets: readonly PublicActivitySetPayload[] = [
  {
    id: 'set-a',
    policy,
    activities: [
      { required: true, activity: activity('quiz-a') },
      { required: true, activity: activity('coding-lab') },
    ],
  },
  {
    id: 'set-b',
    policy,
    activities: [{ required: false, activity: activity('reflection') }],
  },
];

describe('workspace model', () => {
  it('preserves authored set and activity order', () => {
    expect(flattenWorkspaceActivities(sets).map((item) => item.activity.id)).toEqual([
      'quiz-a',
      'coding-lab',
      'reflection',
    ]);
  });

  it('selects only the explicitly next authored activity', () => {
    const activities = flattenWorkspaceActivities(sets);
    expect(findNextActivityId(activities, 'coding-lab')).toBe('reflection');
    expect(findNextActivityId(activities, 'reflection')).toBeNull();
  });

  it('looks up status without synthesizing one', () => {
    expect(
      findActivityStatus(
        [
          {
            activityId: 'quiz-a',
            status: 'DRAFT',
            attemptNumber: 1,
            score: null,
            maxScore: null,
            passed: null,
          },
        ],
        'quiz-a',
      )?.status,
    ).toBe('DRAFT');
    expect(findActivityStatus([], 'missing')).toBeNull();
  });
});
