import type {
  CheckResult,
  LessonBlock,
  LessonStatus,
  LessonType,
  ProcessEvent,
} from '@synaploom/contracts';

/** Summary used by the course navigation UI. */
export interface CourseLessonSummary {
  readonly id: string;
  readonly position: number;
  readonly title: string;
  readonly type: LessonType;
  readonly estimatedMinutes: number | null;
  readonly status: LessonStatus;
}

/** Course response controlled by the local daemon. */
export interface CoursePayload {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly currentLessonId: string | null;
  readonly completedAt: string | null;
  readonly lessons: readonly CourseLessonSummary[];
}

/** Lesson response containing only inert, typed document blocks. */
export interface LessonPayload {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly type: LessonType;
  readonly estimatedMinutes: number | null;
  readonly blocks: readonly LessonBlock[];
  readonly status: LessonStatus;
  readonly readingAcknowledged: boolean;
  readonly latestCheck: { readonly checks: readonly CheckResult[] } | null;
  readonly exercise: {
    readonly id: string;
    readonly title: string;
    readonly editable: readonly string[];
    readonly actions: readonly { readonly id: string; readonly label: string }[];
    readonly checks: readonly {
      readonly id: string;
      readonly title: string;
      readonly required: boolean;
    }[];
  } | null;
}

/** Completion response. The daemon remains authoritative for next-lesson access. */
export interface CompletionPayload {
  readonly completed: true;
  readonly courseCompleted: boolean;
  readonly nextLesson: { readonly id: string; readonly title: string } | null;
}

/** Editable workspace file response. */
export interface WorkspaceFilePayload {
  readonly path: string;
  readonly content: string;
}

/** Stable local API error response. */
export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly currentLessonId?: string;
}

/** Process-session response used to connect to server-sent events. */
export interface ProcessSessionPayload {
  readonly sessionId: string;
  readonly eventsUrl: string;
}

/** Envelope used by event transports and tests. */
export interface ProcessEvents {
  readonly event: ProcessEvent;
}

/** Returns true only for JSON objects satisfying the local API error contract. */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

export type { ProcessEvent as GeneratedProcessEvent } from '@synaploom/generated-contracts';

export type RequirementKind = 'reading' | 'practice' | 'lesson' | 'assessment';
export interface RequirementView {
  readonly id: string;
  readonly kind: RequirementKind;
  readonly required: boolean;
  readonly satisfied: boolean;
  readonly attempted: boolean;
  readonly latestPassed: boolean | null;
}

export interface NavigationTarget {
  readonly type: 'LESSON' | 'CHAPTER_ASSESSMENT' | 'CHAPTER' | 'COURSE';
  readonly id: string;
  readonly chapterId: string | null;
  readonly label: string;
}

export type NextActionPayload =
  | {
      readonly type: 'RETURN_TO_CURRENT_LESSON';
      readonly chapterId: string;
      readonly lessonId: string;
    }
  | { readonly type: 'ACKNOWLEDGE_READING'; readonly chapterId: string; readonly lessonId: string }
  | {
      readonly type: 'START_REQUIRED_PRACTICE';
      readonly chapterId: string;
      readonly lessonId: string;
      readonly practiceId: string;
    }
  | {
      readonly type: 'RETRY_REQUIRED_PRACTICE';
      readonly chapterId: string;
      readonly lessonId: string;
      readonly practiceId: string;
    }
  | { readonly type: 'CONTINUE_TO_LESSON'; readonly chapterId: string; readonly lessonId: string }
  | {
      readonly type: 'START_CHAPTER_ASSESSMENT';
      readonly chapterId: string;
      readonly assessmentId: string;
    }
  | {
      readonly type: 'RETRY_CHAPTER_ASSESSMENT';
      readonly chapterId: string;
      readonly assessmentId: string;
    }
  | { readonly type: 'CONTINUE_TO_CHAPTER'; readonly chapterId: string }
  | { readonly type: 'VIEW_COURSE_SUMMARY'; readonly courseId: string }
  | { readonly type: 'NONE' };

export interface LessonNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  readonly required: boolean;
  readonly current: boolean;
  readonly viewed: boolean;
  readonly blockingRequirements: readonly RequirementView[];
}

export interface AssessmentNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  readonly required: boolean;
  readonly viewed: boolean;
  readonly blockingRequirements: readonly RequirementView[];
}

export interface ChapterNavigationItem {
  readonly id: string;
  readonly title: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'ASSESSMENT_REQUIRED' | 'COMPLETED';
  readonly required: boolean;
  readonly lessons: readonly LessonNavigationItem[];
  readonly assessments: readonly AssessmentNavigationItem[];
}

export interface CourseNavigationPayload {
  readonly courseId: string;
  readonly currentLessonId: string | null;
  readonly viewedItemId: string;
  readonly viewMode: 'LEARNING' | 'REVIEW';
  readonly chapters: readonly ChapterNavigationItem[];
  readonly returnTarget: NavigationTarget | null;
  readonly nextAction: NextActionPayload;
}

export interface LessonViewContext {
  readonly chapterId: string;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  readonly required: boolean;
  readonly readingCompleted: boolean;
  readonly requirements: readonly RequirementView[];
  readonly viewMode: 'LEARNING' | 'REVIEW';
  readonly currentLessonId: string | null;
  readonly returnTarget: NavigationTarget | null;
  readonly nextAction: NextActionPayload;
}

export interface ChapterAssessmentPayload {
  readonly id: string;
  readonly chapterId: string;
  readonly title: string;
  readonly required: boolean;
  readonly status: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  readonly requirements: readonly RequirementView[];
  readonly latestResult: Record<string, unknown> | null;
  readonly bestResult: Record<string, unknown> | null;
  readonly actions: readonly { readonly id: string; readonly label: string }[];
  readonly editable: readonly string[];
}

export function parseLessonViewContext(value: unknown): LessonViewContext {
  if (typeof value !== 'object' || value === null)
    throw new TypeError('Lesson view context must be an object.');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.chapterId !== 'string')
    throw new TypeError('Lesson view context chapterId is required.');
  if (candidate.viewMode !== 'LEARNING' && candidate.viewMode !== 'REVIEW')
    throw new TypeError('Lesson view context viewMode is invalid.');
  if (!Array.isArray(candidate.requirements))
    throw new TypeError('Lesson view context requirements must be an array.');
  if (
    typeof candidate.nextAction !== 'object' ||
    candidate.nextAction === null ||
    typeof (candidate.nextAction as Record<string, unknown>).type !== 'string'
  ) {
    throw new TypeError('Lesson view context nextAction is invalid.');
  }
  return value as LessonViewContext;
}
