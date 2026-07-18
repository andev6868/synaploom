import type { ActivityAnswer, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityAttempt, ActivityOwner, ActivityPublicView } from '@synaploom/protocol';

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

export interface ActivityHostProps {
  readonly owner: ActivityOwner;
  readonly activity: ActivityPublicView;
  readonly policy: ActivitySetPolicy;
  readonly onProgressChanged: () => Promise<void> | void;
}

export interface ActivityRendererProps {
  readonly activity: ActivityPublicView;
  readonly answer: ActivityAnswer | null;
  readonly disabled: boolean;
  readonly onChange: (answer: ActivityAnswer) => void;
  readonly onSubmit: () => Promise<void>;
  readonly onSaveDraft: () => Promise<void>;
}

export interface ActivityAttemptController {
  readonly state: ActivityInteractionState;
  readonly answer: ActivityAnswer | null;
  readonly attempt: ActivityAttempt | null;
  readonly error: Error | null;
  readonly disabled: boolean;
  readonly setAnswer: (answer: ActivityAnswer) => void;
  readonly saveDraft: () => Promise<void>;
  readonly submit: () => Promise<void>;
}
