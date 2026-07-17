import type { AiRequestKind } from '@synaploom/ai-contracts';
import { AssistantDock, type AssistantMode } from '@synaploom/ui';
import { useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';

const kinds: Readonly<Record<AssistantMode, AiRequestKind>> = {
  hint: 'hint',
  explain: 'explain',
  summarize: 'summarize',
};

/** Connects the optional design-system assistant dock to the daemon AI boundary. */
export function AssistantPanel(): ReactNode {
  const api = useApi();
  const [message, setMessage] = useState<string>();
  const request = async (mode: AssistantMode): Promise<void> => {
    const response = await api.requestAi({
      kind: kinds[mode],
      prompt: `Hỗ trợ người học theo chế độ ${mode}.`,
    });
    setMessage(response.status === 'ok' ? response.content : response.message);
  };
  return (
    <AssistantDock
      {...(message === undefined ? {} : { message })}
      onRequest={(mode) => void request(mode)}
    />
  );
}
