import { BookOpenText, Lightbulb, List, Send, Sparkles } from 'lucide-react';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { Button } from '#ui/primitives/button/button';

/** Assistant interaction modes exposed by the optional AI boundary. */
export type AssistantMode = 'hint' | 'explain' | 'summarize';

/** Public properties for the compact AI learning assistant. */
export interface AssistantDockProps {
  readonly contextLabel?: string;
  readonly disabled?: boolean;
  readonly message?: string;
  readonly onRequest?: (mode: AssistantMode) => void;
  readonly onSubmit?: (prompt: string) => void;
  readonly placeholder?: string;
}

/**
 * Renders optional AI help without placing AI on the completion path.
 *
 * Disabled state is intentionally informative: every course remains usable without a provider.
 */
export function AssistantDock({
  contextLabel,
  disabled = false,
  message,
  onRequest,
  onSubmit,
  placeholder = 'Đặt câu hỏi về bài học này…',
}: AssistantDockProps): ReactNode {
  const [prompt, setPrompt] = useState('');
  const trimmedPrompt = prompt.trim();
  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    if (disabled || trimmedPrompt.length === 0) {
      return;
    }
    onSubmit?.(trimmedPrompt);
  };

  return (
    <aside className="syn-assistant-dock" aria-label="Trợ lý AI">
      <div className="syn-assistant-dock__identity">
        <div className="syn-assistant-dock__title">
          <Sparkles aria-hidden="true" size={17} />
          <strong>Trợ lý AI</strong>
        </div>
        {contextLabel ? <span className="syn-assistant-dock__context">{contextLabel}</span> : null}
      </div>

      <form className="syn-assistant-dock__prompt" onSubmit={submit}>
        <input
          aria-label="Câu hỏi cho Trợ lý AI"
          disabled={disabled}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          placeholder={placeholder}
          type="text"
          value={prompt}
        />
        {message ? (
          <span className="syn-assistant-dock__message" role="status" title={message}>
            {message}
          </span>
        ) : null}
        <Button
          aria-label="Gửi câu hỏi"
          className="syn-assistant-dock__send"
          disabled={disabled || trimmedPrompt.length === 0}
          size="sm"
          type="submit"
        >
          <Send aria-hidden="true" size={16} />
          <span className="syn-visually-hidden">Gửi câu hỏi</span>
        </Button>
      </form>

      <div className="syn-assistant-dock__modes" aria-label="Chế độ trợ lý">
        <Button
          disabled={disabled}
          leadingIcon={<Lightbulb size={15} />}
          onClick={() => onRequest?.('hint')}
          size="sm"
          variant="ghost"
        >
          Gợi ý
        </Button>
        <Button
          disabled={disabled}
          leadingIcon={<BookOpenText size={15} />}
          onClick={() => onRequest?.('explain')}
          size="sm"
          variant="ghost"
        >
          Giải thích
        </Button>
        <Button
          disabled={disabled}
          leadingIcon={<List size={15} />}
          onClick={() => onRequest?.('summarize')}
          size="sm"
          variant="ghost"
        >
          Tóm tắt
        </Button>
      </div>
    </aside>
  );
}
