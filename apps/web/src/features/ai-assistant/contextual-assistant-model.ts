import type { AiRequestKind, AiWorkspaceTarget } from '@synaploom/ai-contracts';

export type AssistantInvocation =
  | {
      readonly source: 'theory';
      readonly sectionTitle?: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    }
  | {
      readonly source: 'practice';
      readonly activityId: string;
      readonly activityTitle: string;
      readonly selectedText?: string;
      readonly anchor: HTMLElement | DOMRect;
    };

export type AssistantSurfaceState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'quick'; readonly invocation: AssistantInvocation }
  | { readonly kind: 'expanded'; readonly invocation: AssistantInvocation };

export interface AssistantMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly source: AssistantInvocation['source'];
  readonly contextLabel: string;
}

export interface ContextualAssistantController {
  readonly target: AiWorkspaceTarget;
  readonly state: AssistantSurfaceState;
  readonly prompt: string;
  readonly messages: readonly AssistantMessage[];
  readonly response: string | null;
  readonly status: 'idle' | 'submitting' | 'disabled' | 'error';
  readonly error: string | null;
  openQuick(invocation: AssistantInvocation): void;
  expand(): void;
  close(): void;
  setPrompt(value: string): void;
  submit(kind: AiRequestKind, promptOverride?: string): Promise<void>;
}
