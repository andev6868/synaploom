import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CourseManifest,
  ExerciseManifest,
  LessonFrontMatter,
  NormalizedCourse,
  NormalizedLesson,
} from '@synaploom/contracts';
import { assertValidCoursePackage, parseFrontMatter } from '@synaploom/course-validator';
import { parseLessonMarkdown } from '@synaploom/lesson-renderer';
import { resolveInsideRoot } from '@synaploom/security';

function removeRedundantTitleHeading(
  blocks: readonly import('@synaploom/contracts').LessonBlock[],
  title: string,
): readonly import('@synaploom/contracts').LessonBlock[] {
  const first = blocks[0];
  if (first?.type === 'heading' && first.level === 1 && first.text.trim() === title.trim()) {
    return blocks.slice(1);
  }
  return blocks;
}

function normalizeFrontMatter(data: Record<string, unknown>): LessonFrontMatter {
  return {
    id: String(data.id),
    title: String(data.title),
    position: Number(data.position),
    type: data.type as LessonFrontMatter['type'],
    ...(typeof data.estimatedMinutes === 'number'
      ? { estimatedMinutes: data.estimatedMinutes }
      : {}),
    ...(typeof data.exercise === 'string' ? { exercise: data.exercise } : {}),
  };
}

export async function loadCourse(courseRoot: string): Promise<NormalizedCourse> {
  const root = path.resolve(courseRoot);
  await assertValidCoursePackage(root);
  const manifest = JSON.parse(
    await readFile(path.join(root, 'course.json'), 'utf8'),
  ) as CourseManifest;
  const lessons: NormalizedLesson[] = [];
  for (const reference of [...manifest.lessons].sort((a, b) => a.position - b.position)) {
    const directory = resolveInsideRoot(root, reference.path);
    const markdown = await readFile(path.join(directory, 'lesson.md'), 'utf8');
    const parsed = parseFrontMatter(markdown);
    const frontMatter = normalizeFrontMatter(parsed.data);
    let exercise: ExerciseManifest | undefined;
    if (frontMatter.exercise) {
      exercise = JSON.parse(
        await readFile(resolveInsideRoot(directory, frontMatter.exercise), 'utf8'),
      ) as ExerciseManifest;
      Object.freeze(exercise.actions);
      Object.freeze(exercise.checks);
      Object.freeze(exercise.workspace.editable);
      Object.freeze(exercise);
    }
    const lesson: NormalizedLesson = {
      id: frontMatter.id,
      courseId: manifest.id,
      position: frontMatter.position,
      directory,
      title: frontMatter.title,
      type: frontMatter.type,
      ...(frontMatter.estimatedMinutes ? { estimatedMinutes: frontMatter.estimatedMinutes } : {}),
      blocks: removeRedundantTitleHeading(
        parseLessonMarkdown(parsed.body, {
          validateImageSource: (source) => {
            resolveInsideRoot(directory, source);
            return source;
          },
        }),
        frontMatter.title,
      ),
      sourceMarkdown: parsed.body,
      ...(exercise ? { exercise } : {}),
    };
    lessons.push(Object.freeze(lesson));
  }
  Object.freeze(lessons);
  Object.freeze(manifest.lessons);
  Object.freeze(manifest);
  return Object.freeze({ root, manifest, lessons });
}
