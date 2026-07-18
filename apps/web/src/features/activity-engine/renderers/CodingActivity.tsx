import type { ActivityPublicView, ExerciseManifest } from '@synaploom/contracts';
import type { ActivityOwner, LessonPayload } from '@synaploom/protocol';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import { PracticePanel } from '#src/features/practice-runner/PracticePanel';

interface Props {
  readonly owner: ActivityOwner;
  readonly activity: ActivityPublicView;
  readonly onProgressChanged: () => Promise<void> | void;
}

function lessonExercise(config: ExerciseManifest): NonNullable<LessonPayload['exercise']> {
  return {
    id: config.id,
    title: config.title,
    editable: config.workspace.editable,
    actions: Object.entries(config.actions).map(([id, action]) => ({ id, label: action.label })),
    checks: config.checks.map((check) => ({
      id: check.id,
      title: check.title,
      required: check.required,
    })),
  };
}

export function CodingActivity({ owner, activity, onProgressChanged }: Props): ReactNode {
  const api = useApi();
  const queryClient = useQueryClient();
  const lessonQuery = useQuery({
    queryKey: ['lesson', owner.ownerId],
    queryFn: () => api.getLesson(owner.ownerId),
    enabled: owner.ownerKind === 'lessons',
  });
  const config = activity.config as ExerciseManifest;
  const exercise = useMemo(() => lessonExercise(config), [config]);
  const source = owner.ownerKind === 'lessons' ? lessonQuery.data : null;
  const lesson: LessonPayload = {
    id: owner.ownerId,
    title: source?.title ?? activity.title,
    position: source?.position ?? 1,
    type: source?.type ?? 'mixed',
    estimatedMinutes: source?.estimatedMinutes ?? null,
    blocks: source?.blocks ?? [],
    status: source?.status ?? 'IN_PROGRESS',
    readingAcknowledged: source?.readingAcknowledged ?? true,
    latestCheck: source?.latestCheck ?? null,
    exercise,
  };

  const refresh = async (): Promise<void> => {
    if (owner.ownerKind === 'lessons') {
      await queryClient.invalidateQueries({ queryKey: ['lesson', owner.ownerId] });
    }
    await onProgressChanged();
  };

  return (
    <PracticePanel
      lesson={lesson}
      workspaceTarget={{
        courseId: owner.courseId,
        ownerKind: owner.ownerKind,
        ownerId: owner.ownerId,
        activityId: activity.id,
      }}
      onActionComplete={() => void refresh()}
    />
  );
}
