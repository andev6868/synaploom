import type { AiRequestKind } from '@synaploom/ai-contracts';
import { Code2, Lightbulb, NotebookPen, type LucideIcon } from 'lucide-react';
import type { AssistantInvocation } from '#src/features/ai-assistant/contextual-assistant-model';

export type AssistantAction = {
  readonly label: string;
  readonly description: string;
  readonly kind: AiRequestKind;
  readonly prompt: string;
  readonly icon: LucideIcon;
  readonly tone: 'blue' | 'green' | 'violet';
};

const theoryActions: readonly AssistantAction[] = [
  {
    label: 'Giải thích',
    description: 'Giải thích khái niệm',
    kind: 'explain',
    prompt: 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
    icon: Lightbulb,
    tone: 'blue',
  },
  {
    label: 'Cho ví dụ',
    description: 'Ví dụ minh hoạ',
    kind: 'explain',
    prompt: 'Cho một ví dụ cụ thể về nội dung này.',
    icon: Code2,
    tone: 'green',
  },
  {
    label: 'Tóm tắt',
    description: 'Tóm tắt nội dung',
    kind: 'summarize',
    prompt: 'Tóm tắt các ý chính của nội dung này.',
    icon: NotebookPen,
    tone: 'violet',
  },
];

const practiceActions: readonly AssistantAction[] = [
  {
    label: 'Gợi ý',
    description: 'Gợi ý bước tiếp theo',
    kind: 'hint',
    prompt: 'Cho một gợi ý tiếp theo nhưng không đưa đáp án hoàn chỉnh.',
    icon: Lightbulb,
    tone: 'blue',
  },
  {
    label: 'Giải thích lỗi',
    description: 'Giải thích điểm cần xem lại',
    kind: 'explain-check-failure',
    prompt: 'Giải thích lỗi trong cách làm hiện tại.',
    icon: Code2,
    tone: 'green',
  },
  {
    label: 'Kiểm tra cách làm',
    description: 'Kiểm tra hướng làm',
    kind: 'explain',
    prompt: 'Kiểm tra hướng làm hiện tại và nêu điểm cần xem lại.',
    icon: NotebookPen,
    tone: 'violet',
  },
];

export function assistantActionsForInvocation(
  invocation: AssistantInvocation,
): readonly AssistantAction[] {
  return invocation.source === 'theory' ? theoryActions : practiceActions;
}
