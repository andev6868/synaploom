import type { ActivityKind } from '@synaploom/contracts';

export type WorkspaceLayoutMode =
  'reading' | 'inline-activity' | 'focused-activity' | 'split-coding';

export function resolveWorkspaceLayout(input: {
  readonly hasDocument: boolean;
  readonly embeddedKinds: readonly ActivityKind[];
  readonly focusedKind: ActivityKind | null;
}): WorkspaceLayoutMode {
  if (input.focusedKind === 'coding') return 'split-coding';
  if (input.focusedKind !== null) return 'focused-activity';
  if (input.embeddedKinds.length > 0) return 'inline-activity';
  return 'reading';
}
