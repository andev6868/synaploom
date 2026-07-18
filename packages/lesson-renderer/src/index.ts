import type { LessonDocument } from '@synaploom/contracts';

const lessonTypes = new Set(['theory', 'practice', 'mixed']);

/** Returns true for daemon-produced typed lesson documents. */
export function isLessonDocument(value: unknown): value is LessonDocument {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.courseId === 'string' &&
    typeof candidate.position === 'number' &&
    Number.isInteger(candidate.position) &&
    candidate.position >= 1 &&
    typeof candidate.title === 'string' &&
    typeof candidate.type === 'string' &&
    lessonTypes.has(candidate.type) &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.every(
      (block) =>
        typeof block === 'object' &&
        block !== null &&
        !Array.isArray(block) &&
        typeof (block as Record<string, unknown>).type === 'string',
    )
  );
}

/** Browser-safe attributes for external links. */
export function externalLinkProps(href: string): {
  readonly target?: '_blank';
  readonly rel?: string;
} {
  if (/^(https?:|mailto:)/i.test(href)) {
    return { target: '_blank', rel: 'noreferrer noopener' };
  }
  return {};
}
