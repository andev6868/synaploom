import type { AiResponse, AiWorkspaceTarget } from '@synaploom/ai-contracts';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import type { AssistantInvocation } from '#src/features/ai-assistant/contextual-assistant-model';
import { useContextualAssistant } from '#src/features/ai-assistant/useContextualAssistant';
import { SynaploomApiError, type SynaploomApiClient } from '#src/shared/api/client';

const target: AiWorkspaceTarget = {
  courseId: 'course',
  ownerKind: 'lessons',
  ownerId: 'lesson',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function apiWith(requestAi: SynaploomApiClient['requestAi']): SynaploomApiClient {
  return { requestAi } as SynaploomApiClient;
}

function wrapper(api: SynaploomApiClient) {
  return ({ children }: { readonly children: ReactNode }) => (
    <AppProviders api={api}>{children}</AppProviders>
  );
}

function theoryInvocation(anchor: HTMLElement): AssistantInvocation {
  return { source: 'theory', sectionTitle: 'Thuật toán', anchor };
}

function practiceInvocation(anchor: HTMLElement): AssistantInvocation {
  return {
    source: 'practice',
    activityId: 'ordering',
    activityTitle: 'Sắp xếp thuật toán',
    anchor,
  };
}

describe('useContextualAssistant', () => {
  it('submits owner-qualified theory context and clears the source draft', async () => {
    const requestAi = vi.fn(() =>
      Promise.resolve({ status: 'ok' as const, content: 'Giải thích' }),
    );
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(requestAi)),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.setPrompt('Giải thích'));
    await act(() => result.current.submit('explain'));

    expect(requestAi).toHaveBeenCalledWith(target, {
      kind: 'explain',
      prompt: 'Giải thích',
      source: 'theory',
    });
    expect(result.current.prompt).toBe('');
    expect(result.current.messages).toHaveLength(2);
  });

  it('ignores a response after invocation changes', async () => {
    const first = deferred<AiResponse>();
    const requestAi = vi.fn().mockReturnValueOnce(first.promise);
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(requestAi)),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.setPrompt('Giải thích'));
    let submission!: Promise<void>;
    act(() => {
      submission = result.current.submit('explain');
    });
    act(() => result.current.openQuick(practiceInvocation(trigger)));
    await act(async () => {
      first.resolve({ status: 'ok', content: 'stale' });
      await submission;
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.state.kind).toBe('quick');
    expect(result.current.state.kind === 'quick' && result.current.state.invocation.source).toBe(
      'practice',
    );
  });

  it('preserves drafts independently by source and expands in place', () => {
    const trigger = document.createElement('button');
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(vi.fn())),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.setPrompt('Lý thuyết'));
    act(() => result.current.openQuick(practiceInvocation(trigger)));
    act(() => result.current.setPrompt('Bài tập'));
    act(() => result.current.openQuick(theoryInvocation(trigger)));
    expect(result.current.prompt).toBe('Lý thuyết');
    act(() => result.current.expand());
    expect(result.current.state.kind).toBe('expanded');
  });

  it('restores focus after closing', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(vi.fn())),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.close());
    await act(async () => Promise.resolve());

    expect(trigger).toHaveFocus();
  });

  it('localizes disabled state and preserves the unsent prompt', async () => {
    const requestAi = vi.fn(() =>
      Promise.resolve({ status: 'disabled' as const, message: 'AI assistance is not configured.' }),
    );
    const trigger = document.createElement('button');
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(requestAi)),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.setPrompt('Câu hỏi chưa gửi được'));
    await act(() => result.current.submit('explain'));

    expect(result.current.status).toBe('disabled');
    expect(result.current.response).toBe('Trợ lý AI chưa được cấu hình.');
    expect(result.current.prompt).toBe('Câu hỏi chưa gửi được');
  });

  it('localizes invalid context and network failures without clearing the prompt', async () => {
    const requestAi = vi
      .fn()
      .mockRejectedValueOnce(new SynaploomApiError('AI_CONTEXT_INVALID', 'invalid'))
      .mockRejectedValueOnce(new Error('offline'));
    const trigger = document.createElement('button');
    const { result } = renderHook(() => useContextualAssistant({ target }), {
      wrapper: wrapper(apiWith(requestAi)),
    });

    act(() => result.current.openQuick(theoryInvocation(trigger)));
    act(() => result.current.setPrompt('Câu hỏi chưa gửi được'));
    await act(() => result.current.submit('explain'));
    expect(result.current.error).toBe('Ngữ cảnh câu hỏi không hợp lệ. Hãy chọn lại nội dung.');
    expect(result.current.prompt).toBe('Câu hỏi chưa gửi được');

    await act(() => result.current.submit('explain'));
    expect(result.current.error).toBe('Không thể gửi câu hỏi. Hãy thử lại.');
    expect(result.current.prompt).toBe('Câu hỏi chưa gửi được');
  });

});
