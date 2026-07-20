import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const vitestPackage = fileURLToPath(import.meta.resolve('vitest/package.json'));
const vitestEntry = path.join(path.dirname(vitestPackage), 'vitest.mjs');
const activityPrefixes = [
  'apps/web/src/features/activity-engine/',
  'apps/web/src/features/lesson-content/',
  'apps/web/src/features/chapter-assessment/',
];

async function collectTests(directory) {
  const entries = await readdir(path.join(root, directory), {
    withFileTypes: true,
    recursive: true,
  });
  return entries
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
    )
    .sort();
}

function runVitestGroup(name, args) {
  console.log(`Starting ${name}`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        vitestEntry,
        'run',
        '--pool=threads',
        '--maxWorkers=1',
        '--no-file-parallelism',
        '--reporter=json',
        ...args,
      ],
      {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      console.log(`Closed ${name}: ${code ?? signal ?? 'unknown status'}`);
      if (code !== 0) {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        reject(new Error(`${name} exited with ${code ?? signal ?? 'unknown status'}`));
        return;
      }

      try {
        resolve({ name, result: JSON.parse(stdout), warning: stderr.trim() });
      } catch (error) {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        reject(new Error(`${name} returned invalid Vitest JSON`, { cause: error }));
      }
    });
  });
}

function summarize(group) {
  return {
    files: group.result.testResults.length,
    tests: group.result.numTotalTests,
    passed: group.result.numPassedTests,
    warning: group.warning,
  };
}

const domTests = [
  ...(await collectTests('apps/web/src')),
  ...(await collectTests('packages/ui/src')),
].sort();
const activityTests = domTests.filter((file) =>
  activityPrefixes.some((prefix) => file.startsWith(prefix)),
);
const workspaceTests = domTests.filter((file) => !activityTests.includes(file));
const workspaceMidpoint = Math.ceil(workspaceTests.length / 2);

try {
  const firstWave = await Promise.all([
    runVitestGroup('activity DOM', ['--project', 'dom', ...activityTests]),
    runVitestGroup('workspace DOM 1', [
      '--project',
      'dom',
      ...workspaceTests.slice(0, workspaceMidpoint),
    ]),
  ]);
  const secondWave = await Promise.all([
    runVitestGroup('workspace DOM 2', [
      '--project',
      'dom',
      ...workspaceTests.slice(workspaceMidpoint),
    ]),
    runVitestGroup('Node', ['--project', 'node']),
  ]);
  const groups = [...firstWave, ...secondWave];

  for (const group of groups) {
    const summary = summarize(group);
    console.log(
      `${group.name}: ${summary.files} files, ${summary.passed}/${summary.tests} tests passed`,
    );
    if (summary.warning !== '') {
      console.warn(`${group.name} warnings:\n${summary.warning}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
