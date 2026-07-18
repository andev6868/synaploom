import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { goCommand } from '../../../scripts/go/go-command.mjs';

type Entry = { schema: string; path: string };
const catalog = JSON.parse(readFileSync('schemas/fixtures/catalog.json', 'utf8')) as {
  valid: Entry[];
  invalid: Entry[];
};
const entries = [...catalog.valid, ...catalog.invalid];

function run(command: string, args: string[]) {
  return JSON.parse(execFileSync(command, args, { encoding: 'utf8' }).trim()) as { valid: boolean };
}

describe('cross-language contract conformance', () => {
  it.each(entries)(
    'classifies $path identically in Go and TypeScript',
    ({ schema, path }) => {
      const fixture = `schemas/fixtures/${path}`;
      const typescriptResult = run(process.execPath, [
        '--disable-warning=ExperimentalWarning',
        '--experimental-strip-types',
        'tests/conformance/contracts/typescript-runner.ts',
        schema,
        fixture,
      ]);
      const command = goCommand([
        'run',
        './tests/conformance/contracts/go-runner',
        schema,
        fixture,
      ]);
      const goResult = JSON.parse(
        execFileSync(command.file, command.args, { ...command.options, encoding: 'utf8' }).trim(),
      ) as { valid: boolean };
      expect(goResult).toEqual(typescriptResult);
    },
    30_000,
  );
  it('keeps rich lesson documents inert and round-trippable', () => {
    const fixture = JSON.parse(
      readFileSync('schemas/fixtures/lesson-document/rich-document.json', 'utf8'),
    ) as unknown;
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture);
    const forbidden = new Set(['html', 'script', 'iframe']);
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value !== 'object' || value === null) return;
      for (const [key, nested] of Object.entries(value)) {
        expect(forbidden.has(key)).toBe(false);
        visit(nested);
      }
    };
    visit(fixture);
  });
});
