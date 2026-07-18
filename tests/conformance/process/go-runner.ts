import { execFileSync } from 'node:child_process';
import { goCommand } from '../../../scripts/go/go-command.mjs';

export function runGoHarness(scenario: string): { events: Array<Record<string, unknown>> } {
  const binary =
    process.platform === 'win32'
      ? '.tmp/synaploom-runner-harness.exe'
      : '.tmp/synaploom-runner-harness';
  const command = goCommand(['build', '-o', binary, './cmd/synaploom-runner-harness']);
  execFileSync(command.file, command.args, command.options);
  return JSON.parse(
    execFileSync(binary, { input: `${JSON.stringify({ scenario })}\n`, encoding: 'utf8' }),
  ) as { events: Array<Record<string, unknown>> };
}
