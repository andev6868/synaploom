export const COURSE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1.0'] as const;
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

function validateHierarchicalCourse(candidate: Record<string, unknown>): CanonicalValidationResult {
  if (
    candidate.schemaVersion !== '1.1.0' ||
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

export function validateCanonicalFixture(
  schemaName: string,
  value: unknown,
): CanonicalValidationResult {
  if (!isRecord(value)) return { valid: false, path: '$' };
  if (schemaName === 'course') {
    return value.schemaVersion === '1.1.0'
      ? validateHierarchicalCourse(value)
      : validateLinearCourse(value);
  }
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
