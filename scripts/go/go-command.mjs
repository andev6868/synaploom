import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function goCommand(args, options = {}) {
  return {
    file: 'bash',
    args: [path.join(root, 'scripts/go/with-internal-toolchain.sh'), ...args],
    options: {
      cwd: root,
      ...options,
      env: { ...process.env, ...(options.env ?? {}) },
    },
  };
}
