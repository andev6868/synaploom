import type { ActivitySetPolicy } from '@synaploom/contracts';
import type {
  ActivityPublicView,
  ActivityStatusPayload,
  PublicActivitySetPayload,
} from '@synaploom/protocol';

export interface ResolvedWorkspaceActivity {
  readonly setId: string;
  readonly required: boolean;
  readonly policy: ActivitySetPolicy;
  readonly activity: ActivityPublicView;
}

export function flattenWorkspaceActivities(
  sets: readonly PublicActivitySetPayload[],
): readonly ResolvedWorkspaceActivity[] {
  return sets.flatMap((set) =>
    set.activities.map((reference) => ({
      setId: set.id,
      required: reference.required,
      policy: set.policy,
      activity: reference.activity,
    })),
  );
}

export function findWorkspaceActivity(
  activities: readonly ResolvedWorkspaceActivity[],
  activityId: string | null,
): ResolvedWorkspaceActivity | null {
  if (!activityId) return null;
  return activities.find((item) => item.activity.id === activityId) ?? null;
}

export function findNextActivityId(
  activities: readonly ResolvedWorkspaceActivity[],
  activityId: string,
): string | null {
  const index = activities.findIndex((item) => item.activity.id === activityId);
  return index >= 0 ? (activities[index + 1]?.activity.id ?? null) : null;
}

export function findActivityStatus(
  statuses: readonly ActivityStatusPayload[],
  activityId: string,
): ActivityStatusPayload | null {
  return statuses.find((status) => status.activityId === activityId) ?? null;
}
