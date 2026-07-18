export const COURSE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1.0', '1.2.0'] as const;
export const SUPPORTED_SCHEMA_VERSION = '1.0' as const;

export type CompletionRule =
  | { readonly type: 'all-required-checks' }
  | { readonly type: 'minimum-score'; readonly threshold: number };

export interface ChapterLessonReference {
  readonly id: string;
  readonly required: boolean;
}

export interface ChapterAssessmentDefinition {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
  readonly path: string;
  readonly requiresLessons: readonly string[];
  readonly completion: CompletionRule;
}

export interface ChapterDefinition {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
  readonly lessons: readonly ChapterLessonReference[];
  readonly assessments: readonly ChapterAssessmentDefinition[];
}

export interface CanonicalValidationResult {
  readonly valid: boolean;
  readonly path?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !value.split('/').includes('..')
  );
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && COURSE_ID_PATTERN.test(value);
}

function validateCommonCourseFields(candidate: Record<string, unknown>): boolean {
  return (
    isId(candidate.id) &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    typeof candidate.description === 'string' &&
    candidate.description.length > 0 &&
    typeof candidate.version === 'string' &&
    SEMVER_PATTERN.test(candidate.version) &&
    typeof candidate.language === 'string' &&
    candidate.language.length >= 2
  );
}

function validateLinearCourse(candidate: Record<string, unknown>): CanonicalValidationResult {
  const lessons = candidate.lessons;
  const valid =
    candidate.schemaVersion === '1.0' &&
    !('chapters' in candidate) &&
    validateCommonCourseFields(candidate) &&
    Array.isArray(lessons) &&
    lessons.length > 0 &&
    lessons.every(
      (item) =>
        isRecord(item) &&
        isId(item.id) &&
        Number.isInteger(item.position) &&
        Number(item.position) >= 1 &&
        isSafePath(item.path),
    );
  return { valid, ...(valid ? {} : { path: '$' }) };
}

function validateCompletionRule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.type === 'all-required-checks') return Object.keys(value).length === 1;
  return (
    value.type === 'minimum-score' &&
    typeof value.threshold === 'number' &&
    value.threshold >= 0 &&
    value.threshold <= 1
  );
}

function validateHierarchicalCourse(
  candidate: Record<string, unknown>,
  schemaVersion: '1.1.0' | '1.2.0',
): CanonicalValidationResult {
  if (
    candidate.schemaVersion !== schemaVersion ||
    'lessons' in candidate ||
    !validateCommonCourseFields(candidate) ||
    !Array.isArray(candidate.chapters) ||
    candidate.chapters.length === 0
  ) {
    return { valid: false, path: '$' };
  }

  const chapterIds = new Set<string>();
  const courseLessonIds = new Set<string>();
  for (const [chapterIndex, rawChapter] of candidate.chapters.entries()) {
    if (!isRecord(rawChapter) || !isId(rawChapter.id)) {
      return { valid: false, path: `$.chapters[${chapterIndex}]` };
    }
    if (chapterIds.has(rawChapter.id)) {
      return { valid: false, path: `$.chapters[${chapterIndex}].id` };
    }
    chapterIds.add(rawChapter.id);
    if (
      typeof rawChapter.title !== 'string' ||
      rawChapter.title.length === 0 ||
      typeof rawChapter.required !== 'boolean' ||
      !Array.isArray(rawChapter.lessons) ||
      rawChapter.lessons.length === 0 ||
      !Array.isArray(rawChapter.assessments)
    ) {
      return { valid: false, path: `$.chapters[${chapterIndex}]` };
    }

    const lessonIds = new Set<string>();
    for (const [lessonIndex, rawLesson] of rawChapter.lessons.entries()) {
      if (!isRecord(rawLesson) || !isId(rawLesson.id) || typeof rawLesson.required !== 'boolean') {
        return {
          valid: false,
          path: `$.chapters[${chapterIndex}].lessons[${lessonIndex}]`,
        };
      }
      if (lessonIds.has(rawLesson.id) || courseLessonIds.has(rawLesson.id)) {
        return {
          valid: false,
          path: `$.chapters[${chapterIndex}].lessons[${lessonIndex}].id`,
        };
      }
      lessonIds.add(rawLesson.id);
      courseLessonIds.add(rawLesson.id);
    }

    const assessmentIds = new Set<string>();
    for (const [assessmentIndex, rawAssessment] of rawChapter.assessments.entries()) {
      const basePath = `$.chapters[${chapterIndex}].assessments[${assessmentIndex}]`;
      if (
        !isRecord(rawAssessment) ||
        !isId(rawAssessment.id) ||
        assessmentIds.has(rawAssessment.id) ||
        typeof rawAssessment.title !== 'string' ||
        rawAssessment.title.length === 0 ||
        typeof rawAssessment.required !== 'boolean' ||
        !isSafePath(rawAssessment.path) ||
        !Array.isArray(rawAssessment.requiresLessons) ||
        !validateCompletionRule(rawAssessment.completion)
      ) {
        return { valid: false, path: basePath };
      }
      assessmentIds.add(rawAssessment.id);
      for (const prerequisite of rawAssessment.requiresLessons) {
        if (!isId(prerequisite) || !lessonIds.has(prerequisite)) {
          return { valid: false, path: `${basePath}.requiresLessons` };
        }
      }
    }
  }
  return { valid: true };
}

const ACTIVITY_KINDS = new Set([
  'single-choice',
  'multiple-choice',
  'true-false',
  'short-answer',
  'fill-blanks',
  'ordering',
  'matching',
  'numeric',
  'writing',
  'coding',
]);

function validateActivity(candidate: Record<string, unknown>): CanonicalValidationResult {
  if (
    candidate.schemaVersion !== '1.0' ||
    !isId(candidate.id) ||
    typeof candidate.kind !== 'string' ||
    !ACTIVITY_KINDS.has(candidate.kind) ||
    typeof candidate.title !== 'string' ||
    candidate.title.length === 0 ||
    !isRecord(candidate.prompt) ||
    !Array.isArray(candidate.prompt.blocks) ||
    !isRecord(candidate.config) ||
    !isRecord(candidate.evaluation) ||
    !isRecord(candidate.completion)
  ) {
    return { valid: false, path: '$' };
  }

  const config = candidate.config as Record<string, unknown>;
  const evaluation = candidate.evaluation as Record<string, unknown>;
  const completion = candidate.completion as Record<string, unknown>;

  if (candidate.kind !== 'coding') {
    const forbidden = ['runtime', 'workspace', 'actions', 'executable', 'args'];
    if (forbidden.some((key) => key in config)) {
      return { valid: false, path: '$.config' };
    }
  } else if (!('runtime' in config) || !('workspace' in config) || !('actions' in config)) {
    return { valid: false, path: '$.config' };
  }

  const mode = evaluation.mode;
  if (
    (mode !== 'automatic' && mode !== 'submission' && mode !== 'coding') ||
    typeof evaluation.points !== 'number' ||
    evaluation.points < 0
  ) {
    return { valid: false, path: '$.evaluation' };
  }
  if (typeof completion.required !== 'boolean') {
    return { valid: false, path: '$.completion' };
  }
  return { valid: true };
}

function validateInlineNodes(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((raw) => {
    if (!isRecord(raw) || typeof raw.type !== 'string') return false;
    switch (raw.type) {
      case 'text':
      case 'code':
      case 'keyboard':
        return typeof raw.value === 'string';
      case 'emphasis':
      case 'strong':
      case 'strikethrough':
      case 'superscript':
      case 'subscript':
        return validateInlineNodes(raw.children);
      case 'link':
        return typeof raw.href === 'string' && validateInlineNodes(raw.children);
      case 'hard-break':
        return true;
      case 'math':
        return typeof raw.source === 'string' && raw.source.length > 0;
      case 'footnote-reference':
        return typeof raw.id === 'string' && raw.id.length > 0;
      default:
        return false;
    }
  });
}

function validateLessonBlocks(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const blocks = value as unknown[];
  const blockList = (candidate: unknown): boolean => validateLessonBlocks(candidate);
  return blocks.every((raw) => {
    if (!isRecord(raw) || typeof raw.type !== 'string') return false;
    switch (raw.type) {
      case 'heading':
        return (
          Number.isInteger(raw.level) &&
          Number(raw.level) >= 1 &&
          Number(raw.level) <= 6 &&
          validateInlineNodes(raw.children)
        );
      case 'paragraph':
        return validateInlineNodes(raw.children);
      case 'blockquote':
      case 'footnote-definition':
      case 'definition':
      case 'theorem':
      case 'proof':
      case 'worked-example':
      case 'summary':
        return blockList(raw.blocks);
      case 'list':
        return (
          typeof raw.ordered === 'boolean' &&
          Array.isArray(raw.items) &&
          raw.items.every((item) => isRecord(item) && blockList(item.blocks))
        );
      case 'code':
        return typeof raw.code === 'string';
      case 'thematic-break':
        return true;
      case 'table': {
        const row = (candidate: unknown): boolean =>
          isRecord(candidate) &&
          Array.isArray(candidate.cells) &&
          candidate.cells.every((cell) => isRecord(cell) && validateInlineNodes(cell.children));
        return (
          Array.isArray(raw.alignments) &&
          row(raw.header) &&
          Array.isArray(raw.rows) &&
          raw.rows.every(row)
        );
      }
      case 'math':
        return typeof raw.source === 'string' && raw.source.length > 0;
      case 'callout':
        return (
          ['note', 'hint', 'warning', 'important', 'misconception'].includes(String(raw.kind)) &&
          blockList(raw.blocks)
        );
      case 'details':
        return validateInlineNodes(raw.summary) && blockList(raw.blocks);
      case 'tabs':
        return (
          Array.isArray(raw.tabs) &&
          raw.tabs.length > 0 &&
          raw.tabs.every(
            (tab) =>
              isRecord(tab) &&
              typeof tab.id === 'string' &&
              typeof tab.label === 'string' &&
              blockList(tab.blocks),
          )
        );
      case 'objectives':
        return Array.isArray(raw.items) && raw.items.every(validateInlineNodes);
      case 'vocabulary':
        return (
          Array.isArray(raw.items) &&
          raw.items.every(
            (item) =>
              isRecord(item) && validateInlineNodes(item.term) && blockList(item.definition),
          )
        );
      case 'compare':
        return (
          Array.isArray(raw.columns) &&
          raw.columns.length >= 2 &&
          raw.columns.every(
            (column) =>
              isRecord(column) && typeof column.title === 'string' && blockList(column.blocks),
          )
        );
      case 'walkthrough':
        return (
          Array.isArray(raw.steps) &&
          raw.steps.length > 0 &&
          raw.steps.every(
            (step) => isRecord(step) && typeof step.title === 'string' && blockList(step.blocks),
          )
        );
      case 'activity':
        return typeof raw.activityId === 'string' && raw.activityId.length > 0;
      case 'figure':
        return (
          isSafePath(raw.source) &&
          typeof raw.alt === 'string' &&
          raw.alt.length > 0 &&
          (raw.caption === undefined || validateInlineNodes(raw.caption))
        );
      case 'audio':
        return isSafePath(raw.source) && typeof raw.title === 'string' && blockList(raw.transcript);
      case 'video':
        return (
          isSafePath(raw.source) &&
          typeof raw.title === 'string' &&
          blockList(raw.transcript) &&
          (raw.captions === undefined || isSafePath(raw.captions)) &&
          (raw.poster === undefined || isSafePath(raw.poster))
        );
      case 'attachment':
        return (
          isSafePath(raw.source) &&
          typeof raw.label === 'string' &&
          (raw.description === undefined || validateInlineNodes(raw.description))
        );
      default:
        return false;
    }
  });
}

function validateLessonDocument(candidate: Record<string, unknown>): CanonicalValidationResult {
  const forbidden = new Set(['html', 'script', 'iframe']);
  const containsForbidden = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(containsForbidden);
    if (!isRecord(value)) return false;
    return Object.entries(value).some(
      ([key, nested]) => forbidden.has(key) || containsForbidden(nested),
    );
  };
  const valid =
    typeof candidate.id === 'string' &&
    typeof candidate.courseId === 'string' &&
    Number.isInteger(candidate.position) &&
    Number(candidate.position) >= 1 &&
    typeof candidate.title === 'string' &&
    ['theory', 'practice', 'mixed'].includes(String(candidate.type)) &&
    validateLessonBlocks(candidate.blocks) &&
    !containsForbidden(candidate);
  return { valid, ...(valid ? {} : { path: '$' }) };
}

export function validateCanonicalFixture(
  schemaName: string,
  value: unknown,
): CanonicalValidationResult {
  if (!isRecord(value)) return { valid: false, path: '$' };
  if (schemaName === 'course') {
    if (value.schemaVersion === '1.1.0') return validateHierarchicalCourse(value, '1.1.0');
    if (value.schemaVersion === '1.2.0') return validateHierarchicalCourse(value, '1.2.0');
    return validateLinearCourse(value);
  }
  if (schemaName === 'activity') return validateActivity(value);
  if (schemaName === 'lesson-document') return validateLessonDocument(value);
  if (schemaName === 'process-event') {
    const allowed = new Set([
      'process.started',
      'process.stdout',
      'process.stderr',
      'process.exited',
      'process.timed_out',
      'process.killed',
      'process.failed_to_start',
    ]);
    const valid =
      typeof value.type === 'string' &&
      allowed.has(value.type) &&
      typeof value.sessionId === 'string' &&
      typeof value.lessonId === 'string' &&
      typeof value.timestamp === 'string';
    return { valid, ...(valid ? {} : { path: '$.type' }) };
  }
  return { valid: false, path: '$schema' };
}
