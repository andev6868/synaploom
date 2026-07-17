/** Course schema supported by Synaploom 0.1. */
export const COURSE_SCHEMA_VERSION = '1.0' as const;

/** Supported lesson categories. */
export type LessonType = 'theory' | 'practice' | 'mixed';

/** Linear progression states controlled by the local daemon. */
export type LessonStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

/** Portable metadata stored in a course package. */
export interface CourseManifest {
  readonly $schema?: string;
  readonly schemaVersion: '1.0';
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly language: string;
  readonly author?: string;
  readonly lessons: readonly {
    readonly id: string;
    readonly position: number;
    readonly path: string;
  }[];
}

/** Metadata read from a lesson Markdown front matter block. */
export interface LessonFrontMatter {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly type: LessonType;
  readonly estimatedMinutes?: number;
  readonly exercise?: string;
}

/** One command that a trusted course may expose to the learner. */
export interface ExerciseAction {
  readonly label: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly maxOutputBytes?: number;
}

/** Declarative, allowlisted local exercise configuration. */
export interface ExerciseManifest {
  readonly $schema?: string;
  readonly schemaVersion: '1.0';
  readonly id: string;
  readonly title: string;
  readonly runtime: {
    readonly kind: 'local';
    readonly requires: readonly string[];
  };
  readonly workspace: {
    readonly starter?: string;
    readonly editable: readonly string[];
  };
  readonly actions: Readonly<Record<string, ExerciseAction>>;
  readonly checks: readonly {
    readonly id: string;
    readonly title: string;
    readonly required: boolean;
  }[];
  readonly completion: {
    readonly requireAllRequiredChecks: boolean;
  };
}

/** Inline content accepted by the safe lesson renderer. */
export type InlineContent =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'code'; readonly value: string }
  | { readonly type: 'strong'; readonly children: readonly InlineContent[] }
  | {
      readonly type: 'link';
      readonly href: string;
      readonly children: readonly InlineContent[];
    };

/** Typed lesson blocks. Author-provided HTML is never represented as executable markup. */
export type LessonBlock =
  | {
      readonly type: 'heading';
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly text: string;
    }
  | { readonly type: 'paragraph'; readonly children: readonly InlineContent[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly string[];
    }
  | { readonly type: 'code'; readonly language: string; readonly code: string }
  | {
      readonly type: 'callout';
      readonly kind: 'note' | 'hint' | 'warning';
      readonly children: readonly InlineContent[];
    }
  | { readonly type: 'image'; readonly source: string; readonly alt: string }
  | { readonly type: 'assignment'; readonly steps: readonly string[] };

/** Fully normalized lesson loaded from an immutable course package. */
export interface NormalizedLesson {
  readonly id: string;
  readonly courseId: string;
  readonly position: number;
  readonly directory: string;
  readonly title: string;
  readonly type: LessonType;
  readonly estimatedMinutes?: number;
  readonly blocks: readonly LessonBlock[];
  readonly sourceMarkdown: string;
  readonly exercise?: ExerciseManifest;
}

/** Validated course with lessons in canonical order. */
export interface NormalizedCourse {
  readonly root: string;
  readonly manifest: CourseManifest;
  readonly lessons: readonly NormalizedLesson[];
}

/** One actionable validation issue. */
export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

/** Validation result returned before importing or running a course. */
export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** Result of one declared evaluator check. */
export interface CheckResult {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
  readonly passed: boolean;
  readonly message?: string;
}

/** Result of one allowlisted local action. */
export interface RunActionResult {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly actionId: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly outputTruncated: boolean;
  readonly checks: readonly CheckResult[];
}

/** Streaming process events exposed through the daemon SSE endpoint. */
export type { ProcessEvent } from '@synaploom/generated-contracts';

/** Local directories owned by the current learner. */
export interface SynaploomHomePaths {
  readonly root: string;
  readonly courses: string;
  readonly workspaces: string;
  readonly state: string;
  readonly logs: string;
  readonly runtime: string;
  readonly database: string;
}

/** Installed immutable course record. */
export interface InstalledCourseRecord {
  readonly courseId: string;
  readonly version: string;
  readonly title: string;
  readonly sourcePath: string;
  readonly installPath: string;
  readonly contentHash: string;
  readonly trustedHash: string | null;
  readonly installedAt: string;
  readonly trustedAt: string | null;
}

/** Authoritative progress for one lesson. */
export interface LessonProgressRecord {
  readonly courseId: string;
  readonly version: string;
  readonly lessonId: string;
  readonly position: number;
  readonly status: LessonStatus;
  readonly readingAcknowledged: boolean;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

/** Authoritative progress for one installed course version. */
export interface CourseProgressRecord {
  readonly courseId: string;
  readonly version: string;
  readonly currentLessonId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export type { CoursePayload as GeneratedCoursePayload } from '@synaploom/generated-contracts';
