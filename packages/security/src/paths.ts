import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export function resolveInsideRoot(root: string, relativePath: string): string {
  if (relativePath.includes('\0') || path.isAbsolute(relativePath))
    throw new Error('PATH_OUTSIDE_ROOT');
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relativePath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`))
    throw new Error('PATH_OUTSIDE_ROOT');
  return target;
}

export async function assertNoEscapingSymlink(root: string, target: string): Promise<void> {
  const resolvedRoot = await realpath(path.resolve(root));
  let current = path.resolve(target);
  const segments: string[] = [];
  while (current !== path.dirname(current) && current !== path.resolve(root)) {
    segments.push(path.basename(current));
    current = path.dirname(current);
  }
  current = path.resolve(root);
  for (const segment of segments.reverse()) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = await lstat(current);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      const actual = await realpath(current);
      if (actual !== resolvedRoot && !actual.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error('SYMLINK_OUTSIDE_ROOT');
      }
    }
  }
}

export function normalizeRelativePath(value: string): string {
  if (value.includes('\0') || value.includes('\\') || path.isAbsolute(value))
    throw new Error('PATH_OUTSIDE_ROOT');
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/'))
    throw new Error('PATH_OUTSIDE_ROOT');
  return normalized;
}
