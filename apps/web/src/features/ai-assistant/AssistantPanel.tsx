import type { AiRequestKind } from '@synaploom/ai-contracts';
import { AssistantDock, type AssistantMode } from '@synaploom/ui';
import { useState, type ReactNode } from 'react';
import { useApi } from '#src/app/providers/AppProviders';

const kinds: Readonly<Record<AssistantMode, AiRequestKind>> = {
  hint: 'hint',
  explain: 'explain',
  summarize: 'summarize',
};

export interface AssistantPanelProps {
  readonly lessonTitle: string;
  readonly activityTitle?: string;
}

/** Connects the optional design-system assistant dock to the daemon AI boundary. */
export function AssistantPanel({ lessonTitle, activityTitle }: AssistantPanelProps): ReactNode {
  const api = useApi();
  const [message, setMessage] = useState<string>();
  const context = activityTitle ? `Hoạt động: ${activityTitle}` : `Bài học: ${lessonTitle}`;
  const request = async (mode: AssistantMode, customPrompt?: string): Promise<void> => {
    const response = await api.requestAi({
      kind: kinds[mode],
      prompt: customPrompt
        ? `${context}. ${customPrompt}`
        : `${context}. Hỗ trợ người học theo chế độ ${mode}.`,
    });
    setMessage(response.status === 'ok' ? response.content : response.message);
  };
  return (
    <section className="syn-assistant-context" aria-label="Trợ lý AI" data-assistant-dock-surface>
      <AssistantDock
        contextLabel={context}
        {...(message === undefined ? {} : { message })}
        onRequest={(mode) => void request(mode)}
        onSubmit={(prompt) => void request('explain', prompt)}
        placeholder={
          activityTitle ? 'Đặt câu hỏi về hoạt động này…' : 'Đặt câu hỏi về bài học này…'
        }
      />
    </section>
  );
}
