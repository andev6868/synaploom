import type { InlineContent, LessonBlock } from '@synaploom/contracts';
import { normalizeRelativePath } from '@synaploom/security';

/** Context used to validate local image references while parsing Markdown. */
export interface LessonMarkdownContext {
  readonly validateImageSource?: (source: string) => string;
}

function isSafeLink(href: string): boolean {
  if (href.startsWith('#')) return true;

  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(href);
  if (scheme !== null) {
    return /^(https?:|mailto:)$/i.test(scheme[0]);
  }

  try {
    normalizeRelativePath(href);
    return true;
  } catch {
    return false;
  }
}

function parseInline(value: string): readonly InlineContent[] {
  const result: InlineContent[] = [];
  const token = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ type: 'text', value: value.slice(cursor, index) });
    const raw = match[0];
    if (raw.startsWith('`')) {
      result.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (raw.startsWith('**')) {
      result.push({ type: 'strong', children: [{ type: 'text', value: raw.slice(2, -2) }] });
    } else {
      const link = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link && isSafeLink(link[2] ?? '')) {
        result.push({
          type: 'link',
          href: link[2] ?? '',
          children: [{ type: 'text', value: link[1] ?? '' }],
        });
      } else {
        result.push({ type: 'text', value: link?.[1] ?? raw });
      }
    }
    cursor = index + raw.length;
  }
  if (cursor < value.length) result.push({ type: 'text', value: value.slice(cursor) });
  return result.length > 0 ? result : [{ type: 'text', value }];
}

function startsBlock(line: string): boolean {
  return /^(#{1,6})\s+|^```|^>\s*\[!|^[-*]\s+|^\d+\.\s+|^!\[[^\]]*\]\([^)]+\)/.test(line);
}

/**
 * Parses the supported Markdown subset into inert, typed blocks.
 *
 * Raw HTML remains ordinary text. Unsafe links are downgraded to text, and
 * local image paths are normalized before a course may expose them to the UI.
 */
export function parseLessonMarkdown(
  markdown: string,
  context: LessonMarkdownContext = {},
): readonly LessonBlock[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const blocks: LessonBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence[1] ?? '', code: code.join('\n') });
      continue;
    }

    const callout = line.match(/^>\s*\[!(HINT|NOTE|WARNING)\]\s*$/i);
    if (callout) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && /^>/.test(lines[index] ?? '')) {
        body.push((lines[index] ?? '').replace(/^>\s?/, ''));
        index += 1;
      }
      const kind = (callout[1] ?? 'note').toLowerCase() as 'note' | 'hint' | 'warning';
      blocks.push({ type: 'callout', kind, children: parseInline(body.join(' ')) });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]?.length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2] ?? '',
      });
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const rawSource = image[2] ?? '';
      const source = context.validateImageSource
        ? context.validateImageSource(rawSource)
        : normalizeRelativePath(rawSource);
      blocks.push({ type: 'image', source, alt: image[1] ?? '' });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const steps: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        steps.push((lines[index] ?? '').replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'assignment', steps });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      Boolean((lines[index] ?? '').trim()) &&
      !startsBlock(lines[index] ?? '')
    ) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
  }

  return blocks;
}
