import type { AiGenerateCommand, AiResponse } from '@synaploom/ai-contracts';
import type { ProcessEvent } from '@synaploom/contracts';
import type {
  CanonicalLessonPayload,
  ChapterAssessmentPayload,
  CompletionPayload,
  CourseNavigationPayload,
  CoursePayload,
  LessonPayload,
  NavigationTarget,
  RequirementView,
  ProcessSessionPayload,
  WorkspaceFilePayload,
} from '@synaploom/protocol';
import { isApiErrorPayload } from '@synaploom/protocol';

/** Error raised for structured daemon responses. */
export class SynaploomApiError extends Error {
  readonly code: string;
  readonly currentLessonId: string | undefined;
  readonly blockingRequirements: readonly RequirementView[] | undefined;
  readonly currentTarget: NavigationTarget | undefined;

  constructor(
    code: string,
    message: string,
    currentLessonId?: string,
    blockingRequirements?: readonly RequirementView[],
    currentTarget?: NavigationTarget,
  ) {
    super(message);
    this.name = 'SynaploomApiError';
    this.code = code;
    this.currentLessonId = currentLessonId;
    this.blockingRequirements = blockingRequirements;
    this.currentTarget = currentTarget;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const value: unknown = await response.json();
  if (!response.ok) {
    if (isApiErrorPayload(value)) {
      throw new SynaploomApiError(
        value.code,
        value.message,
        value.currentLessonId,
        value.blockingRequirements,
        value.currentTarget,
      );
    }
    throw new SynaploomApiError('INVALID_RESPONSE', `Daemon returned HTTP ${response.status}.`);
  }
  return value as T;
}

async function request<T>(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetchImpl(url, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
  return parseResponse<T>(response);
}

/** Typed client for the loopback-only Synaploom daemon. */
export interface SynaploomApiClient {
  getCourse(): Promise<CoursePayload>;
  getNavigation(courseId: string): Promise<CourseNavigationPayload>;
  getLessonView(
    courseId: string,
    chapterId: string,
    lessonId: string,
  ): Promise<CanonicalLessonPayload>;
  getChapterAssessment(chapterId: string, assessmentId: string): Promise<ChapterAssessmentPayload>;
  getCurrentLesson(): Promise<LessonPayload>;
  getLesson(lessonId: string): Promise<LessonPayload>;
  startLesson(lessonId: string): Promise<void>;
  acknowledgeReading(lessonId: string): Promise<void>;
  completeLesson(lessonId: string): Promise<CompletionPayload>;
  listFiles(lessonId: string): Promise<readonly string[]>;
  readFile(lessonId: string, path: string): Promise<WorkspaceFilePayload>;
  writeFile(lessonId: string, path: string, content: string): Promise<void>;
  resetWorkspace(lessonId: string): Promise<void>;
  runAction(lessonId: string, actionId: string): Promise<ProcessSessionPayload>;
  requestAi(command: AiGenerateCommand): Promise<AiResponse>;
  getPaneRatio(): Promise<number>;
  setPaneRatio(ratio: number): Promise<number>;
}

/** Creates a client that can be substituted with a test double. */
export function createApiClient(
  fetchImpl: typeof fetch = fetch,
  apiBasePath = '/api/v1',
): SynaploomApiClient {
  const api = (path: string): string => `${apiBasePath}${path}`;
  return {
    getCourse: () => request<CoursePayload>(fetchImpl, api('/course')),
    getNavigation: (courseId) =>
      request<CourseNavigationPayload>(
        fetchImpl,
        api(`/courses/${encodeURIComponent(courseId)}/navigation`),
      ),
    getLessonView: (courseId, chapterId, lessonId) =>
      request<CanonicalLessonPayload>(
        fetchImpl,
        api(
          `/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/lessons/${encodeURIComponent(lessonId)}`,
        ),
      ),
    getChapterAssessment: (chapterId, assessmentId) =>
      request<ChapterAssessmentPayload>(
        fetchImpl,
        api(
          `/chapters/${encodeURIComponent(chapterId)}/assessments/${encodeURIComponent(assessmentId)}`,
        ),
      ),
    getCurrentLesson: () => request<LessonPayload>(fetchImpl, api('/lessons/current')),
    getLesson: (lessonId) =>
      request<LessonPayload>(fetchImpl, api(`/lessons/${encodeURIComponent(lessonId)}`)),
    startLesson: async (lessonId) => {
      await request(fetchImpl, api(`/lessons/${encodeURIComponent(lessonId)}/start`), {
        method: 'POST',
      });
    },
    acknowledgeReading: async (lessonId) => {
      await request(fetchImpl, api(`/lessons/${encodeURIComponent(lessonId)}/reading-complete`), {
        method: 'POST',
      });
    },
    completeLesson: (lessonId) =>
      request<CompletionPayload>(
        fetchImpl,
        api(`/lessons/${encodeURIComponent(lessonId)}/complete`),
        { method: 'POST' },
      ),
    listFiles: async (lessonId) => {
      const payload = await request<{ readonly files: readonly string[] }>(
        fetchImpl,
        api(`/lessons/${encodeURIComponent(lessonId)}/workspace/files`),
      );
      return payload.files;
    },
    readFile: (lessonId, filePath) =>
      request<WorkspaceFilePayload>(
        fetchImpl,
        api(
          `/lessons/${encodeURIComponent(lessonId)}/workspace/file?path=${encodeURIComponent(filePath)}`,
        ),
      ),
    writeFile: async (lessonId, filePath, content) => {
      await request(
        fetchImpl,
        api(
          `/lessons/${encodeURIComponent(lessonId)}/workspace/file?path=${encodeURIComponent(filePath)}`,
        ),
        { method: 'PUT', body: JSON.stringify({ content }) },
      );
    },
    resetWorkspace: async (lessonId) => {
      await request(fetchImpl, api(`/lessons/${encodeURIComponent(lessonId)}/workspace/reset`), {
        method: 'POST',
      });
    },
    runAction: (lessonId, actionId) =>
      request<ProcessSessionPayload>(
        fetchImpl,
        api(`/lessons/${encodeURIComponent(lessonId)}/actions/${encodeURIComponent(actionId)}`),
        { method: 'POST' },
      ),
    requestAi: (command) =>
      request<AiResponse>(fetchImpl, api('/ai/generate'), {
        method: 'POST',
        body: JSON.stringify(command),
      }),
    getPaneRatio: async () =>
      (await request<{ readonly ratio: number }>(fetchImpl, api('/preferences/pane-ratio'))).ratio,
    setPaneRatio: async (ratio) =>
      (
        await request<{ readonly ratio: number }>(fetchImpl, api('/preferences/pane-ratio'), {
          method: 'PUT',
          body: JSON.stringify({ ratio }),
        })
      ).ratio,
  };
}

/** Opens the process SSE stream and parses only known process events. */
export function openProcessEvents(
  eventsUrl: string,
  onEvent: (event: ProcessEvent) => void,
  onDisconnect: () => void,
): () => void {
  const source = new EventSource(eventsUrl, { withCredentials: true });
  let closed = false;

  const close = (): void => {
    if (closed) return;
    closed = true;
    source.close();
  };

  const handleMessage = (message: MessageEvent<string>): void => {
    if (closed) return;
    try {
      const parsed: unknown = JSON.parse(message.data);
      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
        const event = parsed as ProcessEvent;
        onEvent(event);
        if (
          event.type === 'process.exited' ||
          event.type === 'process.timed_out' ||
          event.type === 'process.killed' ||
          event.type === 'process.failed_to_start'
        ) {
          // EventSource reconnects automatically when an SSE response ends. A terminal process
          // event is definitive, so close explicitly before the browser can replay the session.
          close();
        }
      }
    } catch {
      // Malformed optional stream messages are ignored; the terminal remains usable.
    }
  };
  source.addEventListener('process', handleMessage as EventListener);
  source.onerror = () => {
    if (closed) return;
    close();
    onDisconnect();
  };
  return close;
}
