/** Course schema supported by Synaploom 0.1. */
export const COURSE_SCHEMA_VERSION = '1.0' as const;

/** Supported lesson categories. */
export type LessonType = 'theory' | 'practice' | 'mixed';

/** Linear progression states controlled by the local daemon. */
export type LessonStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

/** Portable metadata stored in a course package. */
export interface CourseManifest {
  readonly $schema?: string;
  readonly schemaVersion: '1.0' | '1.1.0' | '1.2.0';
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly language: string;
  readonly author?: string;
  readonly lessons?: readonly {
    readonly id: string;
    readonly position: number;
    readonly path: string;
  }[];
  readonly chapters?: readonly {
    readonly id: string;
    readonly title: string;
    readonly required: boolean;
    readonly lessons: readonly { readonly id: string; readonly required: boolean }[];
    readonly assessments: readonly {
      readonly id: string;
      readonly title: string;
      readonly required: boolean;
      readonly path: string;
      readonly requiresLessons: readonly string[];
      readonly completion:
        | { readonly type: 'all-required-checks' }
        | { readonly type: 'minimum-score'; readonly threshold: number };
    }[];
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
  readonly activitySets?: readonly string[];
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

/** Activity kinds supported by Course Schema 1.2. */
export type ActivityKind =
  | 'single-choice'
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-blanks'
  | 'ordering'
  | 'matching'
  | 'numeric'
  | 'writing'
  | 'coding';

export interface ActivitySetPolicy {
  readonly purpose: 'practice' | 'assessment';
  readonly maxAttempts: number | null;
  readonly feedbackMode: 'immediate' | 'after-submit' | 'after-final-attempt';
  readonly revealAnswers: 'never' | 'after-submit' | 'after-final-attempt';
  readonly scoring: 'none' | 'points';
  readonly passingScore: number | null;
}

export interface ActivityEvaluationPolicy {
  readonly mode: 'automatic' | 'submission' | 'coding';
  readonly points: number;
}

export interface ActivityCompletionPolicy {
  readonly required: boolean;
  readonly passingScore?: number | null;
}

export interface ActivityFeedbackPolicy {
  readonly showExplanation?: boolean;
}

export interface ActivityOption {
  readonly id: string;
  readonly label: string;
  readonly explanation?: string;
}

export interface TextNormalizationRules {
  readonly trim?: boolean;
  readonly caseSensitive?: boolean;
  readonly collapseWhitespace?: boolean;
  readonly removePunctuation?: boolean;
  readonly unicodeForm?: 'NFC' | 'NFKC';
}

export interface SingleChoiceActivityConfig {
  readonly options: readonly ActivityOption[];
  readonly correctOptionId: string;
  readonly randomize?: boolean;
}

export interface MultipleChoiceActivityConfig {
  readonly options: readonly ActivityOption[];
  readonly correctOptionIds: readonly string[];
  readonly evaluationMode: 'exact-set' | 'partial-credit';
  readonly randomize?: boolean;
}

export interface TrueFalseActivityConfig {
  readonly expected: boolean;
  readonly explanation?: string;
}

export interface ShortAnswerActivityConfig {
  readonly acceptedAnswers: readonly string[];
  readonly normalization?: TextNormalizationRules;
  readonly pattern?: string;
  readonly maximumLength?: number;
}

export interface FillBlankDefinition {
  readonly id: string;
  readonly label: string;
  readonly acceptedAnswers: readonly string[];
  readonly normalization?: TextNormalizationRules;
}

export interface FillBlanksActivityConfig {
  readonly blanks: readonly FillBlankDefinition[];
  readonly scoring: 'all-or-nothing' | 'per-blank';
}

export interface OrderingActivityConfig {
  readonly items: readonly ActivityOption[];
  readonly correctOrder: readonly string[];
  readonly evaluationMode: 'exact' | 'adjacent-partial';
  readonly randomize?: boolean;
}

export interface MatchingActivityConfig {
  readonly left: readonly ActivityOption[];
  readonly right: readonly ActivityOption[];
  readonly correctMatches: Readonly<Record<string, string>>;
  readonly randomize?: boolean;
}

export interface NumericActivityConfig {
  readonly answerMode: 'number' | 'expression';
  readonly expected: string;
  readonly absoluteTolerance?: number;
  readonly relativeTolerance?: number;
  readonly unit?: string;
  readonly requireUnit?: boolean;
}

export interface WritingRubricCriterion {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface WritingActivityConfig {
  readonly minimumCharacters: number;
  readonly maximumCharacters: number;
  readonly answerFormat: 'plain-text' | 'safe-markdown';
  readonly rubric?: readonly WritingRubricCriterion[];
  readonly outlinePrompts?: readonly string[];
}

export type ActivityConfig =
  | SingleChoiceActivityConfig
  | MultipleChoiceActivityConfig
  | TrueFalseActivityConfig
  | ShortAnswerActivityConfig
  | FillBlanksActivityConfig
  | OrderingActivityConfig
  | MatchingActivityConfig
  | NumericActivityConfig
  | WritingActivityConfig
  | ExerciseManifest;

export interface LessonDocumentFragment {
  readonly blocks: readonly LessonBlock[];
}

export interface ActivityDefinition {
  readonly schemaVersion: '1.0';
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly prompt: LessonDocumentFragment;
  readonly config: ActivityConfig;
  readonly evaluation: ActivityEvaluationPolicy;
  readonly completion: ActivityCompletionPolicy;
  readonly feedback?: ActivityFeedbackPolicy;
}

export type ActivityPublicConfig =
  | Omit<SingleChoiceActivityConfig, 'correctOptionId'>
  | Omit<MultipleChoiceActivityConfig, 'correctOptionIds'>
  | Omit<TrueFalseActivityConfig, 'expected'>
  | Omit<ShortAnswerActivityConfig, 'acceptedAnswers' | 'pattern'>
  | {
      readonly blanks: readonly Omit<FillBlankDefinition, 'acceptedAnswers'>[];
      readonly scoring: FillBlanksActivityConfig['scoring'];
    }
  | Omit<OrderingActivityConfig, 'correctOrder'>
  | Omit<MatchingActivityConfig, 'correctMatches'>
  | Omit<NumericActivityConfig, 'expected'>
  | WritingActivityConfig
  | ExerciseManifest;

export interface ActivityPublicView {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly title: string;
  readonly prompt: LessonDocumentFragment;
  readonly config: ActivityPublicConfig;
  readonly evaluation: ActivityEvaluationPolicy;
  readonly completion: ActivityCompletionPolicy;
  readonly feedback?: ActivityFeedbackPolicy;
}

export interface ActivityReference {
  readonly id: string;
  readonly path: string;
  readonly required: boolean;
}

export interface ActivitySetDefinition {
  readonly schemaVersion: '1.0';
  readonly id: string;
  readonly title?: string;
  readonly policy: ActivitySetPolicy;
  readonly activities: readonly ActivityReference[];
}

export type ActivityAnswer =
  | { readonly kind: 'single-choice'; readonly optionId: string }
  | { readonly kind: 'multiple-choice'; readonly optionIds: readonly string[] }
  | { readonly kind: 'true-false'; readonly value: boolean }
  | { readonly kind: 'short-answer'; readonly value: string }
  | { readonly kind: 'fill-blanks'; readonly values: Readonly<Record<string, string>> }
  | { readonly kind: 'ordering'; readonly itemIds: readonly string[] }
  | { readonly kind: 'matching'; readonly pairs: Readonly<Record<string, string>> }
  | { readonly kind: 'numeric'; readonly value: string; readonly unit?: string }
  | { readonly kind: 'writing'; readonly value: string }
  | { readonly kind: 'coding'; readonly workspaceRevision: string };

export interface ActivityFeedbackItem {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ActivityFeedback {
  readonly summary: string;
  readonly details: readonly ActivityFeedbackItem[];
  readonly correctAnswer?: unknown;
  readonly nextAction?: 'retry' | 'continue' | 'review-content';
}

export interface ActivityAttempt {
  readonly id: string;
  readonly courseId: string;
  readonly courseVersion: string;
  readonly ownerKind: 'lesson' | 'assessment';
  readonly ownerId: string;
  readonly activityId: string;
  readonly attemptNumber: number;
  readonly status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  readonly answer: ActivityAnswer;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly passed: boolean | null;
  readonly feedback: ActivityFeedback | null;
  readonly startedAt: string;
  readonly submittedAt: string | null;
  readonly evaluatedAt: string | null;
  readonly revision?: number;
  readonly randomSeed?: string | null;
}

export interface ActivitySetProgress {
  readonly status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  readonly completedRequiredActivities: number;
  readonly requiredActivities: number;
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly passed: boolean | null;
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
