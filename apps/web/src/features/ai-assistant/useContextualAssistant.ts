import type { AiRequestKind, AiResponse, AiWorkspaceTarget } from '@synaploom/ai-contracts';
import { useCallback, useRef, useState } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import type {
  AssistantInvocation,
  AssistantMessage,
  AssistantSurfaceState,
  ContextualAssistantController,
} from '#src/features/ai-assistant/contextual-assistant-model';
import { SynaploomApiError } from '#src/shared/api/client';

const assistantDisabledMessage = 'Trợ lý AI chưa được cấu hình.';

function localizedAssistantError(error: unknown): string {
  return error instanceof SynaploomApiError && error.code === 'AI_CONTEXT_INVALID'
    ? 'Ngữ cảnh câu hỏi không hợp lệ. Hãy chọn lại nội dung.'
    : 'Không thể gửi câu hỏi. Hãy thử lại.';
}

export function assistantContextLabel(invocation: AssistantInvocation): string {
  if (invocation.source === 'theory') {
    return invocation.selectedText
      ? 'Đoạn được chọn'
      : `Lý thuyết${invocation.sectionTitle ? ` · ${invocation.sectionTitle}` : ''}`;
  }
  return invocation.selectedText
    ? `Bước được chọn · ${invocation.activityTitle}`
    : `Bài tập · ${invocation.activityTitle}`;
}

function sameInvocation(left: AssistantInvocation, right: AssistantInvocation): boolean {
  return (
    left.source === right.source &&
    left.selectedText === right.selectedText &&
    (left.source === 'theory'
      ? right.source === 'theory' && left.sectionTitle === right.sectionTitle
      : right.source === 'practice' && left.activityId === right.activityId)
  );
}

export function useContextualAssistant({
  target,
}: {
  readonly target: AiWorkspaceTarget;
}): ContextualAssistantController {
  const api = useApi();
  const [state, setState] = useState<AssistantSurfaceState>({ kind: 'closed' });
  const [prompt, setPromptState] = useState('');
  const [messages, setMessages] = useState<readonly AssistantMessage[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<ContextualAssistantController['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const promptRef = useRef(prompt);
  const statusRef = useRef(status);
  const requestIdentityRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const draftsRef = useRef<Record<'theory' | 'practice', string>>({ theory: '', practice: '' });

  const replaceState = useCallback((next: AssistantSurfaceState): void => {
    stateRef.current = next;
    setState(next);
  }, []);

  const replaceStatus = useCallback((next: ContextualAssistantController['status']): void => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const replacePrompt = useCallback((value: string): void => {
    promptRef.current = value;
    setPromptState(value);
  }, []);

  const setPrompt = useCallback(
    (value: string): void => {
      replacePrompt(value);
      const current = stateRef.current;
      if (current.kind !== 'closed') draftsRef.current[current.invocation.source] = value;
    },
    [replacePrompt],
  );

  const openQuick = useCallback(
    (invocation: AssistantInvocation): void => {
      const current = stateRef.current;
      if (current.kind !== 'closed') {
        draftsRef.current[current.invocation.source] = promptRef.current;
      }
      requestIdentityRef.current += 1;
      if (invocation.anchor instanceof HTMLElement) returnFocusRef.current = invocation.anchor;
      replacePrompt(draftsRef.current[invocation.source]);
      setResponse(null);
      setError(null);
      replaceStatus('idle');
      replaceState({ kind: 'quick', invocation });
    },
    [replacePrompt, replaceState, replaceStatus],
  );

  const expand = useCallback((): void => {
    const current = stateRef.current;
    if (current.kind === 'quick') {
      replaceState({ kind: 'expanded', invocation: current.invocation });
    }
  }, [replaceState]);

  const close = useCallback((): void => {
    const current = stateRef.current;
    if (current.kind !== 'closed') draftsRef.current[current.invocation.source] = promptRef.current;
    requestIdentityRef.current += 1;
    replaceState({ kind: 'closed' });
    setResponse(null);
    setError(null);
    replaceStatus('idle');
    queueMicrotask(() => returnFocusRef.current?.focus());
  }, [replaceState, replaceStatus]);

  const submit = useCallback(
    async (kind: AiRequestKind, promptOverride?: string): Promise<void> => {
      const current = stateRef.current;
      const submittedPrompt = (promptOverride ?? promptRef.current).trim();
      if (
        current.kind === 'closed' ||
        statusRef.current === 'submitting' ||
        submittedPrompt === ''
      ) {
        return;
      }
      const invocation = current.invocation;
      const requestId = requestIdentityRef.current + 1;
      requestIdentityRef.current = requestId;
      replaceStatus('submitting');
      setError(null);
      const command = {
        kind,
        prompt: submittedPrompt,
        source: invocation.source,
        ...(invocation.source === 'practice' ? { activityId: invocation.activityId } : {}),
        ...(invocation.selectedText ? { selectedText: invocation.selectedText } : {}),
      } as const;
      try {
        const result: AiResponse = await api.requestAi(target, command);
        const active = stateRef.current;
        if (
          requestIdentityRef.current !== requestId ||
          active.kind === 'closed' ||
          !sameInvocation(active.invocation, invocation)
        ) {
          return;
        }
        if (result.status === 'disabled') {
          replaceStatus('disabled');
          setResponse(assistantDisabledMessage);
          return;
        }
        const label = assistantContextLabel(invocation);
        const stamp = `${requestId}`;
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: `user-${stamp}`,
            role: 'user',
            content: submittedPrompt,
            source: invocation.source,
            contextLabel: label,
          },
          {
            id: `assistant-${stamp}`,
            role: 'assistant',
            content: result.content,
            source: invocation.source,
            contextLabel: label,
          },
        ]);
        draftsRef.current[invocation.source] = '';
        replacePrompt('');
        setResponse(result.content);
        replaceStatus('idle');
      } catch (caught) {
        if (requestIdentityRef.current !== requestId) return;
        replaceStatus('error');
        setError(localizedAssistantError(caught));
      }
    },
    [api, replacePrompt, replaceStatus, target],
  );

  return {
    target,
    state,
    prompt,
    messages,
    response,
    status,
    error,
    openQuick,
    expand,
    close,
    setPrompt,
    submit,
  };
}
