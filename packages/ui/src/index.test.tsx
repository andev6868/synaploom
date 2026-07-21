import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('does not export the retired AssistantDock', () => {
  const source = readFileSync('packages/ui/src/index.ts', 'utf8');
  expect(source).not.toContain('AssistantDock');
  expect(source).not.toContain('assistant-dock');
});
