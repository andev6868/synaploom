import type {
  ChapterAssessmentPayload,
  CourseNavigationPayload,
  CoursePayload,
  LessonPayload,
  ProcessEvent,
} from '@synaploom/generated-contracts';

export interface SynaploomClient {
  getCourse(): Promise<CoursePayload>;
  getLesson(lessonId: string): Promise<LessonPayload>;
  getNavigation(courseId: string): Promise<CourseNavigationPayload>;
  getLessonView(courseId: string, chapterId: string, lessonId: string): Promise<LessonPayload>;
  getChapterAssessment(chapterId: string, assessmentId: string): Promise<ChapterAssessmentPayload>;
  streamExecution(eventsUrl: string, onEvent: (event: ProcessEvent) => void): EventSource;
}

class HttpSynaploomClient implements SynaploomClient {
  private readonly baseUrl: URL;

  constructor(baseUrl: URL) {
    this.baseUrl = baseUrl;
  }

  async getCourse(): Promise<CoursePayload> {
    return this.request<CoursePayload>('course');
  }

  async getLesson(lessonId: string): Promise<LessonPayload> {
    return this.request<LessonPayload>(`lessons/${encodeURIComponent(lessonId)}`);
  }

  async getNavigation(courseId: string): Promise<CourseNavigationPayload> {
    return this.request<CourseNavigationPayload>(
      `courses/${encodeURIComponent(courseId)}/navigation`,
    );
  }

  async getLessonView(
    courseId: string,
    chapterId: string,
    lessonId: string,
  ): Promise<LessonPayload> {
    return this.request<LessonPayload>(
      `courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/lessons/${encodeURIComponent(lessonId)}`,
    );
  }

  async getChapterAssessment(
    chapterId: string,
    assessmentId: string,
  ): Promise<ChapterAssessmentPayload> {
    return this.request<ChapterAssessmentPayload>(
      `chapters/${encodeURIComponent(chapterId)}/assessments/${encodeURIComponent(assessmentId)}`,
    );
  }

  streamExecution(eventsUrl: string, onEvent: (event: ProcessEvent) => void): EventSource {
    const source = new EventSource(new URL(eventsUrl, this.baseUrl));
    source.addEventListener('process', (event) => {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return;
      onEvent(JSON.parse(event.data) as ProcessEvent);
    });
    return source;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Synaploom API returned HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}

export function createClient(options: { readonly baseUrl: string }): SynaploomClient {
  return new HttpSynaploomClient(new URL('/api/v1/', options.baseUrl));
}
