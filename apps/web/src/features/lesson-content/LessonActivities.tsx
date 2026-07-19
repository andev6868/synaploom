import type { LessonBlock } from '@synaploom/contracts';
import type {
  ActivityOwner,
  PublicActivityReferencePayload,
  PublicActivitySetPayload,
} from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { LessonContent } from '#src/features/lesson-content/LessonContent';

interface ResolvedActivity extends PublicActivityReferencePayload {
  readonly setId: string;
  readonly policy: PublicActivitySetPayload['policy'];
}

function nestedBlocks(block: LessonBlock): readonly LessonBlock[] {
  switch (block.type) {
    case 'blockquote':
    case 'callout':
    case 'details':
    case 'definition':
    case 'theorem':
    case 'proof':
    case 'worked-example':
    case 'summary':
      return block.blocks;
    case 'list':
      return block.items.flatMap((item) => item.blocks);
    case 'tabs':
      return block.tabs.flatMap((tab) => tab.blocks);
    case 'vocabulary':
      return block.items.flatMap((item) => item.definition);
    case 'compare':
      return block.columns.flatMap((column) => column.blocks);
    case 'walkthrough':
      return block.steps.flatMap((step) => step.blocks);
    case 'audio':
    case 'video':
      return block.transcript;
    case 'heading':
    case 'paragraph':
    case 'code':
    case 'thematic-break':
    case 'table':
    case 'footnote-definition':
    case 'math':
    case 'objectives':
    case 'activity':
    case 'figure':
    case 'attachment':
      return [];
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

export function collectEmbeddedActivityIds(blocks: readonly LessonBlock[]): readonly string[] {
  const ids: string[] = [];
  const visit = (items: readonly LessonBlock[]): void => {
    for (const block of items) {
      if (block.type === 'activity') ids.push(block.activityId);
      visit(nestedBlocks(block));
    }
  };
  visit(blocks);
  return ids;
}

function resolveActivities(
  activitySets: readonly PublicActivitySetPayload[],
): readonly ResolvedActivity[] {
  return activitySets.flatMap((set) =>
    set.activities.map((reference) => ({
      ...reference,
      setId: set.id,
      policy: set.policy,
    })),
  );
}

export function LessonActivities({
  blocks,
  owner,
  activitySets,
  onProgressChanged,
  excludedActivityIds = [],
  renderHost = (props) => <ActivityHost {...props} />,
}: {
  readonly blocks: readonly LessonBlock[];
  readonly owner: ActivityOwner;
  readonly activitySets: readonly PublicActivitySetPayload[];
  readonly onProgressChanged: () => Promise<void> | void;
  readonly excludedActivityIds?: readonly string[];
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
}): ReactNode {
  const activities = resolveActivities(activitySets);
  const embeddedIds = collectEmbeddedActivityIds(blocks);
  const duplicates = embeddedIds.filter((id, index) => embeddedIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    return (
      <p role="alert">
        Hoạt động “{duplicates[0]}” được nhúng nhiều hơn một lần trong cùng bài học.
      </p>
    );
  }

  const byId = new Map(activities.map((item) => [item.activity.id, item]));
  const missing = embeddedIds.find((id) => !byId.has(id));
  if (missing) {
    return <p role="alert">Không tìm thấy hoạt động “{missing}” trong activity set của bài học.</p>;
  }

  const embedded = new Set(embeddedIds);
  const excluded = new Set(excludedActivityIds);
  const renderActivity = (activityId: string): ReactNode => {
    if (excluded.has(activityId)) return null;
    const item = byId.get(activityId);
    if (!item) return null;
    return renderHost({
      owner,
      activity: item.activity,
      policy: item.policy,
      onProgressChanged,
    });
  };
  const remaining = activities.filter(
    (item) => !embedded.has(item.activity.id) && !excluded.has(item.activity.id),
  );

  return (
    <>
      <LessonContent blocks={blocks} renderActivity={renderActivity} />
      {remaining.length > 0 ? (
        <section className="syn-lesson-activities" aria-label="Hoạt động thực hành">
          {remaining.map((item) => (
            <div key={`${item.setId}-${item.activity.id}`} data-activity-id={item.activity.id}>
              {renderHost({
                owner,
                activity: item.activity,
                policy: item.policy,
                onProgressChanged,
              })}
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
