/** AI assistance intents supported by the MVP. */
export type AiRequestKind = 'explain' | 'hint' | 'summarize' | 'explain-check-failure';

/** Daemon-owned request passed to a configured AI provider. */
export interface AiRequest {
  readonly kind: AiRequestKind;
  readonly lessonId: string;
  readonly prompt: string;
  readonly context: {
    readonly lessonText: string;
    readonly selectedText?: string;
    readonly editableFiles?: readonly { readonly path: string; readonly content: string }[];
    readonly latestCheckMessage?: string;
  };
}

/** Provider response. Disabled is a normal optional-feature state. */
export type AiResponse =
  | { readonly status: 'ok'; readonly content: string }
  | { readonly status: 'disabled'; readonly message: string };

/** Provider-neutral generation interface. */
export interface AiProvider {
  readonly id: string;
  generate(request: AiRequest, signal: AbortSignal): Promise<AiResponse>;
}

/** Browser command. Context is intentionally generated only by the daemon. */
export interface AiGenerateCommand {
  readonly kind: AiRequestKind;
  readonly prompt: string;
  readonly selectedText?: string;
}

export { DisabledAiProvider } from '#src/disabled-provider';
