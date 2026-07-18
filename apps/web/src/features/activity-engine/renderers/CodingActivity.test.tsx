import type { ActivityPublicView } from '@synaploom/contracts';
import type { ActivityOwner, LessonPayload } from '@synaploom/protocol';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import type { SynaploomApiClient } from '#src/shared/api/client';
import { CodingActivity } from './CodingActivity';

const owner: ActivityOwner = {
  courseId: 'course',
  ownerKind: 'lessons',
  ownerId: 'coding-lesson',
};

const activity: ActivityPublicView = {
  id: 'coding-lab',
  kind: 'coding',
  title: 'Coding Lab',
  prompt: { blocks: [] },
  config: {
    schemaVersion: '1.0',
    id: 'coding-lab',
    title: 'Coding Lab',
    runtime: { kind: 'local', requires: ['node'] },
    workspace: { starter: 'starter', editable: ['index.js'] },
    actions: {
      run: {
        label: 'Chạy chương trình',
        executable: 'node',
        args: ['index.js'],
        timeoutMs: 1000,
      },
      check: {
        label: 'Kiểm tra kết quả',
        executable: 'node',
        args: ['checks/check.mjs'],
        timeoutMs: 1000,
      },
    },
    checks: [{ id: 'output', title: 'Output chính xác', required: true }],
    completion: { requireAllRequiredChecks: true },
  },
  evaluation: { mode: 'coding', points: 1 },
  completion: { required: true },
};

const lesson: LessonPayload = {
  id: 'coding-lesson',
  title: 'Coding Lesson',
  position: 1,
  type: 'mixed',
  estimatedMinutes: 20,
  blocks: [],
  status: 'IN_PROGRESS',
  readingAcknowledged: true,
  latestCheck: null,
  exercise: null,
};

const legacyListFiles = vi.fn(() => Promise.reject(new Error('legacy workspace must not be used')));
const activityListFiles = vi.fn(() => Promise.resolve(['index.js']));

function api(): SynaploomApiClient {
  return {
    getLesson: () => Promise.resolve(lesson),
    listFiles: legacyListFiles,
    readFile: vi.fn(() => Promise.reject(new Error('legacy workspace must not be used'))),
    listActivityFiles: activityListFiles,
    readActivityFile: vi.fn(() =>
      Promise.resolve({ path: 'index.js', content: 'console.log("ok")' }),
    ),
  } as unknown as SynaploomApiClient;
}

describe('CodingActivity', () => {
  it('reuses the existing editor through the activity-scoped workspace API', async () => {
    const client = api();
    render(
      <AppProviders api={client}>
        <CodingActivity owner={owner} activity={activity} onProgressChanged={vi.fn()} />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Coding Lab' })).toBeVisible();
    expect(await screen.findByRole('tab', { name: 'index.js' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Chạy chương trình' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kiểm tra kết quả' })).toBeVisible();
    expect(screen.getByText('Output chính xác')).toBeVisible();
    expect(activityListFiles).toHaveBeenCalledWith({
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'coding-lesson',
      activityId: 'coding-lab',
    });
    expect(legacyListFiles).not.toHaveBeenCalled();
  });

  it('reuses the trusted coding workspace for an assessment owner', async () => {
    render(
      <AppProviders api={api()}>
        <CodingActivity
          owner={{ ...owner, ownerKind: 'assessments', ownerId: 'runtime-checkpoint' }}
          activity={activity}
          onProgressChanged={vi.fn()}
        />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Coding Lab' })).toBeVisible();
    expect(activityListFiles).toHaveBeenCalledWith({
      courseId: 'course',
      ownerKind: 'assessments',
      ownerId: 'runtime-checkpoint',
      activityId: 'coding-lab',
    });
  });
});
