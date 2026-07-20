import type { ActivityAnswer, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityAttempt, ActivityOwner, ActivityPublicView } from '@synaploom/protocol';
import type { ReactNode } from 'react';

export type ActivityHostSurface = 'practice-contained' | 'standalone';

export interface ActivityActionOutlet {
  readonly setActions: (actions: ReactNode | null) => void;
}

export type ActivityInteractionState =
  | 'loading'
  | 'not-started'
  | 'ready'
  | 'draft'
  | 'saving'
  | 'submitting'
  | 'evaluated'
  | 'max-attempt'
  | 'error';

export interface ActivityPersistenceHandle {
  isDirty(): boolean;
  saveIfDirty(): Promise<void>;
}

export interface ActivityHostProps {
  readonly owner: ActivityOwner;
  readonly activity: ActivityPublicView;
  readonly policy: ActivitySetPolicy;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly surface?: ActivityHostSurface;
  readonly actionOutlet?: ActivityActionOutlet;
  readonly onPersistenceHandleChange?: (
    activityId: string,
    handle: ActivityPersistenceHandle | null,
    removedHandle?: ActivityPersistenceHandle,
  ) => void;
}

export interface ActivityRendererProps {
  readonly activity: ActivityPublicView;
  readonly answer: ActivityAnswer | null;
  readonly disabled: boolean;
  readonly onChange: (answer: ActivityAnswer) => void;
  readonly onSubmit: () => Promise<void>;
  readonly onSaveDraft: () => Promise<void>;
  readonly surface?: ActivityHostSurface;
  readonly actionOutlet?: ActivityActionOutlet;
}

export interface ActivityAttemptController {
  readonly state: ActivityInteractionState;
  readonly answer: ActivityAnswer | null;
  readonly attempt: ActivityAttempt | null;
  readonly error: Error | null;
  readonly disabled: boolean;
  readonly isDirty: boolean;
  readonly loadFailed: boolean;
  readonly setAnswer: (answer: ActivityAnswer) => void;
  readonly saveDraft: () => Promise<void>;
  readonly saveIfDirty: () => Promise<void>;
  readonly submit: () => Promise<void>;
  readonly retryLoad: () => Promise<void>;
}
