import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#ui/primitives/tabs/tabs';

/** Assistant interaction modes exposed by the optional AI boundary. */
export type AssistantMode = 'hint' | 'explain' | 'summarize';

/** Public properties for the compact AI learning assistant. */
export interface AssistantDockProps {
  readonly disabled?: boolean;
  readonly message?: string;
  readonly onRequest?: (mode: AssistantMode) => void;
}

/**
 * Renders optional AI help without placing AI on the completion path.
 *
 * Disabled state is intentionally informative: every course remains usable without a provider.
 */
export function AssistantDock({
  disabled = false,
  message,
  onRequest,
}: AssistantDockProps): ReactNode {
  return (
    <aside className="syn-assistant-dock" aria-label="Trợ lý AI">
      <div className="syn-assistant-dock__title">
        <Sparkles aria-hidden="true" size={17} />
        <strong>Trợ lý AI</strong>
      </div>
      <Tabs defaultValue="hint">
        <TabsList aria-label="Chế độ trợ lý">
          <TabsTrigger value="hint" onClick={() => onRequest?.('hint')}>
            Gợi ý
          </TabsTrigger>
          <TabsTrigger value="explain" onClick={() => onRequest?.('explain')}>
            Giải thích
          </TabsTrigger>
          <TabsTrigger value="summarize" onClick={() => onRequest?.('summarize')}>
            Tóm tắt
          </TabsTrigger>
        </TabsList>
        <TabsContent value="hint">
          <p>
            {message ??
              (disabled
                ? 'AI đang tắt. Bài học và thực hành vẫn hoạt động đầy đủ.'
                : 'Chọn một chế độ để nhận hỗ trợ theo bài học hiện tại.')}
          </p>
        </TabsContent>
        <TabsContent value="explain">
          <p>{message ?? 'Yêu cầu AI giải thích khái niệm đang học.'}</p>
        </TabsContent>
        <TabsContent value="summarize">
          <p>{message ?? 'Yêu cầu AI tóm tắt nội dung bài học.'}</p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
