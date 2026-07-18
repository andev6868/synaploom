export type LearningRoute =
  | {
      readonly kind: 'lesson';
      readonly courseId: string;
      readonly chapterId: string;
      readonly lessonId: string;
    }
  | {
      readonly kind: 'assessment';
      readonly courseId: string;
      readonly chapterId: string;
      readonly assessmentId: string;
    }
  | { readonly kind: 'legacy-lesson'; readonly courseId: string; readonly lessonId: string }
  | { readonly kind: 'unknown' };

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Parses canonical chapter-aware routes and the temporary short lesson compatibility route. */
export function parseLearningRoute(pathname: string): LearningRoute {
  const lesson = pathname.match(/^\/courses\/([^/]+)\/chapters\/([^/]+)\/lessons\/([^/]+)\/?$/);
  if (lesson) {
    return {
      kind: 'lesson',
      courseId: decode(lesson[1] ?? ''),
      chapterId: decode(lesson[2] ?? ''),
      lessonId: decode(lesson[3] ?? ''),
    };
  }

  const assessment = pathname.match(
    /^\/courses\/([^/]+)\/chapters\/([^/]+)\/assessments\/([^/]+)\/?$/,
  );
  if (assessment) {
    return {
      kind: 'assessment',
      courseId: decode(assessment[1] ?? ''),
      chapterId: decode(assessment[2] ?? ''),
      assessmentId: decode(assessment[3] ?? ''),
    };
  }

  const legacyLesson = pathname.match(/^\/courses\/([^/]+)\/lessons\/([^/]+)\/?$/);
  if (legacyLesson) {
    return {
      kind: 'legacy-lesson',
      courseId: decode(legacyLesson[1] ?? ''),
      lessonId: decode(legacyLesson[2] ?? ''),
    };
  }

  return { kind: 'unknown' };
}

/** Compatibility adapter for callers that only need a requested lesson ID. */
export function parseLessonRoute(pathname: string): { readonly lessonId: string | null } {
  const route = parseLearningRoute(pathname);
  return {
    lessonId: route.kind === 'lesson' || route.kind === 'legacy-lesson' ? route.lessonId : null,
  };
}

function writePath(path: string, replace: boolean): void {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Writes a canonical chapter-aware lesson URL without a full reload.
 * The two-argument form is retained temporarily for legacy callers that do not yet know chapterId.
 */
export function navigateToLesson(courseId: string, lessonId: string, replace?: boolean): void;
export function navigateToLesson(
  courseId: string,
  chapterId: string,
  lessonId: string,
  replace?: boolean,
): void;
export function navigateToLesson(
  courseId: string,
  chapterOrLessonId: string,
  lessonOrReplace?: string | boolean,
  replace = false,
): void {
  if (typeof lessonOrReplace !== 'string') {
    writePath(
      `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(chapterOrLessonId)}`,
      lessonOrReplace ?? false,
    );
    return;
  }
  if (!chapterOrLessonId.trim()) {
    writePath(
      `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonOrReplace)}`,
      replace,
    );
    return;
  }
  writePath(
    `/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterOrLessonId)}/lessons/${encodeURIComponent(lessonOrReplace)}`,
    replace,
  );
}

/** Writes a canonical chapter assessment URL without a full reload. */
export function navigateToAssessment(
  courseId: string,
  chapterId: string,
  assessmentId: string,
  replace = false,
): void {
  writePath(
    `/courses/${encodeURIComponent(courseId)}/chapters/${encodeURIComponent(chapterId)}/assessments/${encodeURIComponent(assessmentId)}`,
    replace,
  );
}
