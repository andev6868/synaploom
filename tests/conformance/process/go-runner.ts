import { execFileSync } from 'node:child_process';

export function runGoHarness(scenario: string): { events: Array<Record<string, unknown>> } {
  const binary =
    process.platform === 'win32'
      ? '.tmp/synaploom-runner-harness.exe'
      : '.tmp/synaploom-runner-harness';
  execFileSync('go', ['build', '-o', binary, './cmd/synaploom-runner-harness']);
  return JSON.parse(
    execFileSync(binary, { input: `${JSON.stringify({ scenario })}\n`, encoding: 'utf8' }),
  ) as { events: Array<Record<string, unknown>> };
}
