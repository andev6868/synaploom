import { describe, expect, it, vi } from 'vitest';
import {
  emitWorkspaceEvent,
  sanitizeWorkspaceEvent,
} from '#src/features/learning-workspace/workspace-events';

describe('workspace events', () => {
  it('removes learner content and unknown keys', () => {
    const event = sanitizeWorkspaceEvent({
      name: 'workspace.activity.focused',
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'lesson',
      activityId: 'quiz',
      answer: 'secret',
      content: 'source code',
      feedback: 'private',
    } as never);
    expect(event).toEqual({
      name: 'workspace.activity.focused',
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'lesson',
      activityId: 'quiz',
    });
    expect(event).not.toHaveProperty('answer');
    expect(event).not.toHaveProperty('content');
  });

  it('dispatches a structured browser integration event', () => {
    const listener = vi.fn();
    window.addEventListener('synaploom:workspace-event', listener);
    emitWorkspaceEvent({
      name: 'workspace.pane.collapsed',
      courseId: 'course',
      ownerKind: 'lessons',
      ownerId: 'lesson',
      paneMode: 'collapsed',
      revision: 2,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const dispatched = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(dispatched.detail).toMatchObject({
      name: 'workspace.pane.collapsed',
      paneMode: 'collapsed',
      revision: 2,
    });
    window.removeEventListener('synaploom:workspace-event', listener);
  });
});
