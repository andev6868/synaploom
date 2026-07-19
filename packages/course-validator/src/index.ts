import type { Dirent } from 'node:fs';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  ActivityDefinition,
  ActivitySetDefinition,
  CourseManifest,
  ExerciseManifest,
  LessonFrontMatter,
  ValidationIssue,
  ValidationReport,
} from '@synaploom/contracts';
import {
  COURSE_ID_PATTERN,
  SEMVER_PATTERN,
  SUPPORTED_SCHEMA_VERSIONS,
} from '@synaploom/course-schema';
import { assertNoEscapingSymlink, resolveInsideRoot } from '@synaploom/security';

export interface ValidateCourseOptions {
  manifestOverride?: CourseManifest;
}

export function parseFrontMatter(markdown: string): {
  data: Record<string, unknown>;
  body: string;
} {
  if (!markdown.startsWith('---\n')) return { data: {}, body: markdown };
  const end = markdown.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: markdown };
  const raw = markdown.slice(4, end).trim();
  const data: Record<string, unknown> = {};
  let activeList: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') && activeList !== null) {
      const current = Array.isArray(data[activeList]) ? (data[activeList] as unknown[]) : [];
      current.push(
        trimmed
          .slice(2)
          .trim()
          .replace(/^['"]|['"]$/g, ''),
      );
      data[activeList] = current;
      continue;
    }
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    activeList = value === '' ? key : null;
    if (value === '') {
      data[key] = [];
    } else if (/^\d+$/.test(value)) data[key] = Number(value);
    else if (value === 'true' || value === 'false') data[key] = value === 'true';
    else data[key] = value.replace(/^['"]|['"]$/g, '');
  }
  const bodyStart = markdown.indexOf('\n', end + 4);
  return { data, body: bodyStart < 0 ? '' : markdown.slice(bodyStart + 1) };
}

function issue(issues: ValidationIssue[], code: string, message: string, issuePath?: string): void {
  issues.push({ code, message, ...(issuePath === undefined ? {} : { path: issuePath }) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateManifestShape(manifest: CourseManifest, issues: ValidationIssue[]): void {
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(manifest.schemaVersion)) {
    issue(
      issues,
      'SCHEMA_VERSION_UNSUPPORTED',
      `schemaVersion must be one of ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
    );
  }
  if (!COURSE_ID_PATTERN.test(manifest.id))
    issue(issues, 'COURSE_ID_INVALID', 'Course id must be kebab-case');
  if (!manifest.title?.trim()) issue(issues, 'COURSE_TITLE_REQUIRED', 'Course title is required');
  if (!manifest.description?.trim())
    issue(issues, 'COURSE_DESCRIPTION_REQUIRED', 'Course description is required');
  if (!SEMVER_PATTERN.test(manifest.version))
    issue(issues, 'COURSE_VERSION_INVALID', 'Course version must be semantic version');

  if (manifest.schemaVersion === '1.0') {
    if (manifest.lessons === undefined || manifest.lessons.length === 0) {
      issue(issues, 'LESSONS_REQUIRED', 'At least one lesson is required');
      return;
    }
    const ids = new Set<string>();
    for (const [index, lesson] of manifest.lessons.entries()) {
      if (ids.has(lesson.id))
        issue(issues, 'LESSON_ID_DUPLICATE', `Duplicate lesson id ${lesson.id}`);
      ids.add(lesson.id);
      if (lesson.position !== index + 1)
        issue(
          issues,
          'LESSON_POSITION_INVALID',
          `Lesson ${lesson.id} must have position ${index + 1}`,
        );
    }
    return;
  }

  if (manifest.chapters === undefined || manifest.chapters.length === 0) {
    issue(issues, 'CHAPTERS_REQUIRED', 'Hierarchical courses require chapters');
    return;
  }
  const lessonIds = new Set<string>();
  const chapterIds = new Set<string>();
  for (const [chapterIndex, chapter] of manifest.chapters.entries()) {
    if (chapterIds.has(chapter.id))
      issue(issues, 'CHAPTER_ID_DUPLICATE', `Duplicate chapter id ${chapter.id}`);
    chapterIds.add(chapter.id);
    if (chapter.lessons.length === 0)
      issue(issues, 'LESSONS_REQUIRED', `Chapter ${chapter.id} requires at least one lesson`);
    const localLessons = new Set<string>();
    for (const lesson of chapter.lessons) {
      if (lessonIds.has(lesson.id))
        issue(issues, 'LESSON_ID_DUPLICATE', `Duplicate lesson id ${lesson.id}`);
      lessonIds.add(lesson.id);
      localLessons.add(lesson.id);
    }
    for (const [assessmentIndex, assessment] of chapter.assessments.entries()) {
      for (const prerequisite of assessment.requiresLessons) {
        if (!localLessons.has(prerequisite)) {
          issue(
            issues,
            'ASSESSMENT_PREREQUISITE_INVALID',
            `Assessment prerequisite ${prerequisite} is not in chapter ${chapter.id}`,
            `course.json#chapters[${chapterIndex}].assessments[${assessmentIndex}]`,
          );
        }
      }
    }
  }
}

function asLessonFrontMatter(data: Record<string, unknown>): LessonFrontMatter | null {
  const type = data.type;
  if (
    typeof data.id !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.position !== 'number' ||
    (type !== 'theory' && type !== 'practice' && type !== 'mixed')
  )
    return null;
  return {
    id: data.id,
    title: data.title,
    position: data.position,
    type,
    ...(typeof data.estimatedMinutes === 'number'
      ? { estimatedMinutes: data.estimatedMinutes }
      : {}),
    ...(typeof data.exercise === 'string' ? { exercise: data.exercise } : {}),
    ...(Array.isArray(data.activitySets) &&
    data.activitySets.every((item) => typeof item === 'string')
      ? { activitySets: data.activitySets as string[] }
      : {}),
  };
}

function validateExerciseShape(
  exercise: ExerciseManifest,
  issues: ValidationIssue[],
  exercisePath: string,
): void {
  if (exercise.schemaVersion !== '1.0')
    issue(
      issues,
      'EXERCISE_SCHEMA_VERSION_INVALID',
      'Exercise schemaVersion must be 1.0',
      exercisePath,
    );
  if (exercise.runtime?.kind !== 'local')
    issue(issues, 'EXERCISE_RUNTIME_INVALID', 'Only local runtime is supported', exercisePath);
  if (!exercise.actions || typeof exercise.actions !== 'object')
    issue(issues, 'EXERCISE_ACTIONS_REQUIRED', 'Exercise actions are required', exercisePath);
  for (const [actionId, action] of Object.entries(exercise.actions ?? {})) {
    if (!COURSE_ID_PATTERN.test(actionId))
      issue(issues, 'ACTION_ID_INVALID', `Invalid action id ${actionId}`, exercisePath);
    if (!action.executable || action.executable.includes('/') || action.executable.includes('\\'))
      issue(
        issues,
        'ACTION_EXECUTABLE_INVALID',
        `Action ${actionId} executable must be a command name`,
        exercisePath,
      );
    if (!Array.isArray(action.args) || action.args.some((arg) => typeof arg !== 'string'))
      issue(issues, 'ACTION_ARGS_INVALID', `Action ${actionId} args must be strings`, exercisePath);
    if (!Number.isInteger(action.timeoutMs) || action.timeoutMs < 100 || action.timeoutMs > 120000)
      issue(
        issues,
        'ACTION_TIMEOUT_INVALID',
        `Action ${actionId} timeout out of range`,
        exercisePath,
      );
  }
}

function validateActivityShape(
  activity: ActivityDefinition,
  issues: ValidationIssue[],
  activityPath: string,
): void {
  if (!COURSE_ID_PATTERN.test(activity.id))
    issue(issues, 'ACTIVITY_CONFIG_INVALID', 'Activity id must be kebab-case', activityPath);
  if (isRecord(activity.presentation)) {
    const { allowInline, allowPractice, defaultSurface, supportsFullscreen } =
      activity.presentation;
    if (
      (!allowInline && !allowPractice) ||
      (defaultSurface === 'inline' && !allowInline) ||
      (defaultSurface === 'practice' && !allowPractice) ||
      (supportsFullscreen && !allowPractice)
    ) {
      issue(
        issues,
        'ACTIVITY_PRESENTATION_INVALID',
        'Activity presentation policy is impossible',
        activityPath,
      );
    }
  }
  if (activity.kind !== 'coding' && isRecord(activity.config)) {
    for (const capability of ['runtime', 'workspace', 'actions', 'executable', 'args']) {
      if (capability in activity.config) {
        issue(
          issues,
          'ACTIVITY_CONFIG_INVALID',
          `Only coding activities may declare ${capability}`,
          activityPath,
        );
      }
    }
  }
}

async function validateActivitySets(
  ownerRoot: string,
  refs: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  const setIDs = new Set<string>();
  for (const ref of refs) {
    let setPath: string;
    try {
      setPath = resolveInsideRoot(ownerRoot, ref);
      await assertNoEscapingSymlink(ownerRoot, setPath);
    } catch {
      issue(issues, 'DOCUMENT_ASSET_OUTSIDE_COURSE', 'Activity set path escapes owner root', ref);
      continue;
    }
    let set: ActivitySetDefinition;
    try {
      set = JSON.parse(await readFile(setPath, 'utf8')) as ActivitySetDefinition;
    } catch {
      issue(issues, 'ACTIVITY_REFERENCE_NOT_FOUND', 'Activity set could not be loaded', setPath);
      continue;
    }
    if (setIDs.has(set.id))
      issue(issues, 'ACTIVITY_ID_DUPLICATE', `Duplicate set ${set.id}`, setPath);
    setIDs.add(set.id);
    const activityIDs = new Set<string>();
    const activityPaths = new Set<string>();
    for (const reference of set.activities ?? []) {
      if (activityIDs.has(reference.id))
        issue(issues, 'ACTIVITY_ID_DUPLICATE', `Duplicate activity ${reference.id}`, setPath);
      activityIDs.add(reference.id);
      if (activityPaths.has(reference.path))
        issue(
          issues,
          'ACTIVITY_EMBED_DUPLICATE',
          `Activity ${reference.id} is referenced more than once`,
          setPath,
        );
      activityPaths.add(reference.path);
      let activityPath: string;
      try {
        activityPath = resolveInsideRoot(path.dirname(setPath), reference.path);
        await assertNoEscapingSymlink(ownerRoot, activityPath);
      } catch {
        issue(
          issues,
          'DOCUMENT_ASSET_OUTSIDE_COURSE',
          'Activity path escapes owner root',
          reference.path,
        );
        continue;
      }
      let activity: ActivityDefinition;
      try {
        activity = JSON.parse(await readFile(activityPath, 'utf8')) as ActivityDefinition;
      } catch {
        issue(
          issues,
          'ACTIVITY_REFERENCE_NOT_FOUND',
          `Activity ${reference.id} could not be loaded`,
          activityPath,
        );
        continue;
      }
      if (activity.id !== reference.id)
        issue(
          issues,
          'ACTIVITY_REFERENCE_NOT_FOUND',
          `Activity id ${activity.id} does not match ${reference.id}`,
          activityPath,
        );
      validateActivityShape(activity, issues, activityPath);
      if (
        set.policy.purpose === 'assessment' &&
        set.policy.scoring === 'points' &&
        activity.kind === 'writing' &&
        activity.evaluation.mode === 'submission'
      ) {
        issue(
          issues,
          'ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY',
          'Scored assessments cannot contain submission-only writing activities',
          activityPath,
        );
      }
    }
  }
}

interface LessonFileReference {
  readonly id: string;
  readonly position: number;
  readonly path: string;
}

async function collectLessonReferences(
  root: string,
  manifest: CourseManifest,
  issues: ValidationIssue[],
): Promise<readonly LessonFileReference[]> {
  if (manifest.schemaVersion === '1.0') return manifest.lessons ?? [];
  const expected = new Set(
    (manifest.chapters ?? []).flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
  );
  const discovered: LessonFileReference[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(path.join(root, 'lessons'), { withFileTypes: true });
  } catch {
    issue(issues, 'LESSONS_REQUIRED', 'Hierarchical course lessons directory is missing');
    return discovered;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relative = path.join('lessons', entry.name);
    const lessonPath = path.join(root, relative, 'lesson.md');
    try {
      const frontMatter = asLessonFrontMatter(
        parseFrontMatter(await readFile(lessonPath, 'utf8')).data,
      );
      if (frontMatter !== null) {
        discovered.push({ id: frontMatter.id, position: frontMatter.position, path: relative });
        expected.delete(frontMatter.id);
      }
    } catch {
      issue(issues, 'LESSON_MARKDOWN_MISSING', 'lesson.md is required', lessonPath);
    }
  }
  for (const id of expected) {
    issue(issues, 'ACTIVITY_REFERENCE_NOT_FOUND', `Lesson ${id} was not found`, 'course.json');
  }
  return discovered.sort((a, b) => a.position - b.position);
}

export async function validateCoursePackage(
  courseRoot: string,
  options: ValidateCourseOptions = {},
): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  const root = path.resolve(courseRoot);
  let manifest: CourseManifest;
  try {
    manifest =
      options.manifestOverride ??
      (JSON.parse(await readFile(path.join(root, 'course.json'), 'utf8')) as CourseManifest);
  } catch (error) {
    issue(
      issues,
      'COURSE_MANIFEST_INVALID',
      error instanceof Error ? error.message : String(error),
      'course.json',
    );
    return { valid: false, issues };
  }
  validateManifestShape(manifest, issues);
  const lessonReferences = await collectLessonReferences(root, manifest, issues);
  for (const ref of lessonReferences) {
    let lessonDir: string;
    try {
      lessonDir = resolveInsideRoot(root, ref.path);
      await assertNoEscapingSymlink(root, lessonDir);
    } catch (error) {
      issue(
        issues,
        error instanceof Error ? error.message : 'PATH_OUTSIDE_ROOT',
        `Unsafe lesson path ${ref.path}`,
        ref.path,
      );
      continue;
    }
    const lessonPath = path.extname(lessonDir) ? lessonDir : path.join(lessonDir, 'lesson.md');
    try {
      await access(lessonPath);
    } catch {
      issue(issues, 'LESSON_MARKDOWN_MISSING', 'lesson.md is required', lessonPath);
      continue;
    }
    try {
      await assertNoEscapingSymlink(root, lessonPath);
      const markdown = await readFile(lessonPath, 'utf8');
      const frontMatter = asLessonFrontMatter(parseFrontMatter(markdown).data);
      if (frontMatter === null) {
        issue(issues, 'LESSON_FRONT_MATTER_INVALID', 'Invalid lesson front matter', lessonPath);
        continue;
      }
      if (frontMatter.id !== ref.id)
        issue(issues, 'LESSON_ID_MISMATCH', 'Lesson id does not match course manifest', lessonPath);
      if (frontMatter.position !== ref.position)
        issue(
          issues,
          'LESSON_POSITION_MISMATCH',
          'Lesson position does not match course manifest',
          lessonPath,
        );
      if (manifest.schemaVersion === '1.2.0') {
        if (frontMatter.exercise) {
          issue(
            issues,
            'LEGACY_EXERCISE_NOT_ALLOWED',
            'Course Schema 1.2 lessons must use activitySets',
            lessonPath,
          );
        }
        await validateActivitySets(
          path.dirname(lessonPath),
          frontMatter.activitySets ?? [],
          issues,
        );
      } else if (frontMatter.exercise) {
        let exercisePath: string;
        try {
          exercisePath = resolveInsideRoot(path.dirname(lessonPath), frontMatter.exercise);
          await assertNoEscapingSymlink(path.dirname(lessonPath), exercisePath);
        } catch (error) {
          issue(
            issues,
            error instanceof Error ? error.message : 'PATH_OUTSIDE_ROOT',
            'Unsafe exercise path',
            frontMatter.exercise,
          );
          continue;
        }
        try {
          const exercise = JSON.parse(await readFile(exercisePath, 'utf8')) as ExerciseManifest;
          validateExerciseShape(exercise, issues, exercisePath);
          if (exercise.workspace.starter) {
            try {
              await access(resolveInsideRoot(path.dirname(lessonPath), exercise.workspace.starter));
            } catch {
              issue(
                issues,
                'STARTER_MISSING',
                'Starter directory does not exist',
                exercise.workspace.starter,
              );
            }
          }
          for (const editable of exercise.workspace.editable ?? []) {
            try {
              resolveInsideRoot(path.dirname(lessonPath), editable);
            } catch {
              issue(issues, 'PATH_OUTSIDE_ROOT', 'Editable path escapes lesson root', editable);
            }
          }
        } catch (error) {
          issue(
            issues,
            'EXERCISE_MANIFEST_INVALID',
            error instanceof Error ? error.message : String(error),
            exercisePath,
          );
        }
      }
    } catch (error) {
      issue(
        issues,
        'LESSON_READ_FAILED',
        error instanceof Error ? error.message : String(error),
        lessonPath,
      );
    }
  }
  return { valid: issues.length === 0, issues };
}

export async function assertValidCoursePackage(courseRoot: string): Promise<void> {
  const report = await validateCoursePackage(courseRoot);
  if (!report.valid) {
    const error = new Error(`COURSE_INVALID: ${report.issues.map((item) => item.code).join(', ')}`);
    Object.assign(error, { report });
    throw error;
  }
}
