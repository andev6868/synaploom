import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native core architecture', () => {
  it('contains no installed Node CLI or daemon core', () => {
    expect(existsSync('apps/cli')).toBe(false);
    expect(existsSync('apps/daemon')).toBe(false);
    expect(readFileSync('package.json', 'utf8')).not.toContain('verify-packed-cli');
    expect(existsSync('cmd/synaploom/main.go')).toBe(true);
  });
});
