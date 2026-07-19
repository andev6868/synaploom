import type { ActivityAnswer, ActivitySetPolicy } from '@synaploom/contracts';
import type { ActivityAttempt, ActivityOwner } from '@synaploom/protocol';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import type {
  ActivityAttemptController,
  ActivityInteractionState,
} from '#src/features/activity-engine/types';
import { SynaploomApiError } from '#src/shared/api/client';

interface Options {
  readonly owner: ActivityOwner;
  readonly activityId: string;
  readonly policy: ActivitySetPolicy;
  readonly onProgressChanged: () => Promise<void> | void;
}

function attemptKey(owner: ActivityOwner, activityId: string): readonly unknown[] {
  return ['activity-attempt', owner.courseId, owner.ownerKind, owner.ownerId, activityId];
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function seedFromAttempt(attempt: ActivityAttempt | null): number {
  const parsed = Number(attempt?.randomSeed ?? 0);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function useActivityAttempt({
  owner,
  activityId,
  policy,
  onProgressChanged,
}: Options): ActivityAttemptController {
  const api = useApi();
  const queryClient = useQueryClient();
  const [answer, setAnswerState] = useState<ActivityAnswer | null>(null);
  const [localAttempt, setLocalAttempt] = useState<ActivityAttempt | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isDirty, setDirty] = useState(false);
  const latestRevision = useRef(0);

  const attemptQuery = useQuery({
    queryKey: attemptKey(owner, activityId),
    queryFn: () => api.getCurrentActivityAttempt(owner, activityId),
  });

  useEffect(() => {
    const remote = attemptQuery.data ?? null;
    if (!remote) return;
    const revision = remote.revision ?? 0;
    if (revision < latestRevision.current || isDirty) return;
    latestRevision.current = revision;
    setLocalAttempt(remote);
    setAnswerState(remote.answer);
  }, [attemptQuery.data, isDirty]);

  const invalidateRelated = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: attemptKey(owner, activityId) }),
      queryClient.invalidateQueries({
        queryKey: ['activity-set-progress', owner.courseId, owner.ownerKind, owner.ownerId],
      }),
      queryClient.invalidateQueries({ queryKey: ['course-navigation', owner.courseId] }),
      queryClient.invalidateQueries({ queryKey: ['course'] }),
      queryClient.invalidateQueries({ queryKey: ['canonical-lesson', owner.courseId] }),
      queryClient.invalidateQueries({ queryKey: ['chapter-assessment', owner.courseId] }),
    ]);
  }, [activityId, owner, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (currentAnswer: ActivityAnswer) =>
      api.saveActivityDraft(owner, activityId, {
        answer: currentAnswer,
        revision: latestRevision.current,
        randomSeed: seedFromAttempt(localAttempt),
      }),
    onMutate: () => setError(null),
    onSuccess: (saved) => {
      const revision = saved.revision ?? 0;
      if (revision < latestRevision.current) return;
      latestRevision.current = revision;
      setDirty(false);
      setLocalAttempt(saved);
      setAnswerState(saved.answer);
      queryClient.setQueryData(attemptKey(owner, activityId), saved);
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause : new Error('Không thể lưu bản nháp.')),
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      currentAnswer,
      idempotencyKey,
    }: {
      readonly currentAnswer: ActivityAnswer;
      readonly idempotencyKey: string;
    }) =>
      api.submitActivityAttempt(owner, activityId, {
        answer: currentAnswer,
        idempotencyKey,
        randomSeed: seedFromAttempt(localAttempt),
      }),
    onMutate: () => setError(null),
    onSuccess: async (submitted) => {
      latestRevision.current = Math.max(latestRevision.current, submitted.revision ?? 0);
      setDirty(false);
      setLocalAttempt(submitted);
      setAnswerState(submitted.answer);
      queryClient.setQueryData(attemptKey(owner, activityId), submitted);
      await invalidateRelated();
      await onProgressChanged();
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause : new Error('Không thể nộp câu trả lời.')),
  });

  const setAnswer = useCallback((next: ActivityAnswer): void => {
    setDirty(true);
    setError(null);
    setAnswerState(next);
  }, []);

  const saveDraft = useCallback(async (): Promise<void> => {
    if (!answer || saveMutation.isPending) return;
    await saveMutation.mutateAsync(answer);
  }, [answer, saveMutation]);

  const saveIfDirty = useCallback(async (): Promise<void> => {
    if (!isDirty) return;
    if (!answer) throw new Error('Không có bản nháp hợp lệ để lưu.');
    await saveMutation.mutateAsync(answer);
  }, [answer, isDirty, saveMutation]);

  const submit = useCallback(async (): Promise<void> => {
    if (!answer || submitMutation.isPending) return;
    try {
      await submitMutation.mutateAsync({
        currentAnswer: answer,
        idempotencyKey: createIdempotencyKey(),
      });
    } catch {
      // Mutation state exposes the error while preserving the learner answer.
    }
  }, [answer, submitMutation]);

  const loadError = useMemo(
    () =>
      attemptQuery.error instanceof Error
        ? attemptQuery.error
        : attemptQuery.error
          ? new Error('Không thể tải hoạt động.')
          : null,
    [attemptQuery.error],
  );
  const retryLoad = useCallback(async (): Promise<void> => {
    await attemptQuery.refetch();
  }, [attemptQuery]);
  const attempt = localAttempt ?? attemptQuery.data ?? null;
  const state = useMemo<ActivityInteractionState>(() => {
    if (attemptQuery.isLoading || attemptQuery.isFetching) return 'loading';
    if (loadError) return 'error';
    if (submitMutation.isPending) return 'submitting';
    if (saveMutation.isPending) return 'saving';
    if (error instanceof SynaploomApiError && error.code === 'ACTIVITY_MAX_ATTEMPTS_REACHED') {
      return 'max-attempt';
    }
    if (error) return 'error';
    if (isDirty && answer) return 'ready';
    if (attempt?.status === 'EVALUATED') return 'evaluated';
    if (attempt?.status === 'DRAFT') return 'draft';
    if (answer) return 'ready';
    return 'not-started';
  }, [
    answer,
    attempt,
    attemptQuery.isFetching,
    attemptQuery.isLoading,
    loadError,
    error,
    isDirty,
    saveMutation.isPending,
    submitMutation.isPending,
  ]);

  const attemptsExhausted =
    policy.maxAttempts !== null &&
    attempt !== null &&
    attempt.attemptNumber >= policy.maxAttempts &&
    attempt.status === 'EVALUATED' &&
    attempt.passed !== true;

  return {
    state: attemptsExhausted ? 'max-attempt' : state,
    answer,
    attempt,
    error: error ?? loadError,
    disabled:
      attemptQuery.isFetching ||
      loadError !== null ||
      saveMutation.isPending ||
      submitMutation.isPending ||
      attemptsExhausted,
    isDirty,
    loadFailed: loadError !== null,
    setAnswer,
    saveDraft,
    saveIfDirty,
    submit,
    retryLoad,
  };
}
