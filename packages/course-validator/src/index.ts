import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type {
  CourseManifest,
  ExerciseManifest,
  LessonFrontMatter,
  ValidationIssue,
  ValidationReport,
} from '@synaploom/contracts';
import {
  COURSE_ID_PATTERN,
  SEMVER_PATTERN,
  SUPPORTED_SCHEMA_VERSION,
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
  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (/^\d+$/.test(value)) data[key] = Number(value);
    else if (value === 'true' || value === 'false') data[key] = value === 'true';
    else data[key] = value.replace(/^['"]|['"]$/g, '');
  }
  const bodyStart = markdown.indexOf('\n', end + 4);
  return { data, body: bodyStart < 0 ? '' : markdown.slice(bodyStart + 1) };
}

function issue(issues: ValidationIssue[], code: string, message: string, issuePath?: string): void {
  issues.push({ code, message, ...(issuePath === undefined ? {} : { path: issuePath }) });
}

function validateManifestShape(manifest: CourseManifest, issues: ValidationIssue[]): void {
  if (manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION)
    issue(issues, 'SCHEMA_VERSION_UNSUPPORTED', 'schemaVersion must be 1.0');
  if (!COURSE_ID_PATTERN.test(manifest.id))
    issue(issues, 'COURSE_ID_INVALID', 'Course id must be kebab-case');
  if (!manifest.title?.trim()) issue(issues, 'COURSE_TITLE_REQUIRED', 'Course title is required');
  if (!manifest.description?.trim())
    issue(issues, 'COURSE_DESCRIPTION_REQUIRED', 'Course description is required');
  if (!SEMVER_PATTERN.test(manifest.version))
    issue(issues, 'COURSE_VERSION_INVALID', 'Course version must be semantic version');
  if (!Array.isArray(manifest.lessons) || manifest.lessons.length === 0)
    issue(issues, 'LESSONS_REQUIRED', 'At least one lesson is required');
  const ids = new Set<string>();
  for (const [index, lesson] of (manifest.lessons ?? []).entries()) {
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
  for (const ref of manifest.lessons ?? []) {
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
    const lessonPath = path.join(lessonDir, 'lesson.md');
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
      if (frontMatter.exercise) {
        let exercisePath: string;
        try {
          exercisePath = resolveInsideRoot(lessonDir, frontMatter.exercise);
          await assertNoEscapingSymlink(lessonDir, exercisePath);
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
              await access(resolveInsideRoot(lessonDir, exercise.workspace.starter));
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
              resolveInsideRoot(lessonDir, editable);
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
