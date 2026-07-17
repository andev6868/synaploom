/** Parsed learner route. Course identity is optional because one course is active per daemon. */
export interface LessonRoute {
  readonly lessonId: string | null;
}

/** Parses the active lesson from the local SPA path. */
export function parseLessonRoute(pathname: string): LessonRoute {
  const match = pathname.match(/^\/courses\/[^/]+\/lessons\/([^/]+)$/);
  return { lessonId: match ? decodeURIComponent(match[1] ?? '') : null };
}

/** Writes the canonical lesson URL without causing a full page reload. */
export function navigateToLesson(courseId: string, lessonId: string, replace = false): void {
  const path = `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
