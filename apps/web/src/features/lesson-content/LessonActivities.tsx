import type { LessonBlock } from '@synaploom/contracts';
import type { ActivityOwner, ActivityStatusPayload } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { InlineActivitySlot } from '#src/features/learning-workspace/InlineActivitySlot';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import {
  findActivityStatus,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';
import { LessonContent } from '#src/features/lesson-content/LessonContent';

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

interface LessonActivitiesProps {
  readonly blocks: readonly LessonBlock[];
  readonly owner: ActivityOwner;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly controller: LearningWorkspaceController;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
}

export function LessonActivities({
  blocks,
  owner,
  activities,
  statuses,
  focusedActivityId,
  controller,
  onProgressChanged,
  renderHost,
}: LessonActivitiesProps): ReactNode {
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
  if (missing)
    return <p role="alert">Không tìm thấy hoạt động “{missing}” trong activity set của bài học.</p>;

  const embedded = new Set(embeddedIds);
  const openPractice = async (activityId: string): Promise<void> => {
    if (activityId === focusedActivityId) {
      if (controller.state.paneMode === 'collapsed') await controller.restoreSplitPane();
      return;
    }
    await controller.focusActivity(activityId);
  };
  const renderItem = (item: ResolvedWorkspaceActivity): ReactNode => (
    <InlineActivitySlot
      item={item}
      owner={owner}
      focused={item.activity.id === focusedActivityId}
      paneMode={controller.state.paneMode}
      status={findActivityStatus(statuses, item.activity.id)}
      onOpenPractice={openPractice}
      onProgressChanged={onProgressChanged}
      onPersistenceHandleChange={controller.registerPersistenceHandle}
      {...(renderHost ? { renderHost } : {})}
    />
  );
  const renderActivity = (activityId: string): ReactNode => {
    const item = byId.get(activityId);
    return item ? renderItem(item) : null;
  };
  const remaining = activities.filter((item) => !embedded.has(item.activity.id));

  return (
    <>
      <LessonContent blocks={blocks} renderActivity={renderActivity} />
      {remaining.length > 0 ? (
        <section className="syn-lesson-activities" aria-label="Hoạt động thực hành">
          {remaining.map((item) => (
            <div key={`${item.setId}-${item.activity.id}`}>{renderItem(item)}</div>
          ))}
        </section>
      ) : null}
    </>
  );
}
