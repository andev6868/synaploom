import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeOrigin = 'http://127.0.0.1:4174';
const viteOrigin = 'http://127.0.0.1:5173';
const bootstrapPattern = /http:\/\/127\.0\.0\.1:4174\/bootstrap\?token=[^\s]+/;
let stopCurrentRun = async () => undefined;

export function parseCoursePath(args) {
  const paths = args[0] === '--' ? args.slice(1) : args;
  if (paths.length !== 1) throw new Error('dev:full requires exactly one course path');
  return paths[0];
}

export function rewriteBootstrapURL(runtimeURL, browserOrigin) {
  const url = new URL(runtimeURL);
  const target = new URL(browserOrigin);
  url.protocol = target.protocol;
  url.hostname = target.hostname;
  url.port = target.port;
  return url.toString();
}

export function forwardOutput(source, destination) {
  source.on('data', (chunk) => destination.write(chunk));
}

function spawnChild(file, args, { forwardStdout = false, ...options } = {}) {
  const child = spawn(file, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (forwardStdout) forwardOutput(child.stdout, process.stdout);
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode ?? 1);
  return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
}

function waitForMatch(child, pattern, label) {
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    const cleanup = () => {
      child.stdout.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      settle(value);
    };
    const onData = (chunk) => {
      output += String(chunk);
      const match = output.match(pattern);
      if (match) finish(resolve, match[0]);
    };
    const onError = (error) =>
      finish(reject, new Error(`${label} failed to start: ${error.message}`));
    const onExit = (code, signal) =>
      finish(reject, new Error(`${label} exited before ready (code=${code}, signal=${signal})`));

    child.stdout.on('data', onData);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

async function stopAndWait(child) {
  if (!child || child.exitCode !== null) return;
  const exited = waitForExit(child).then(() => true);
  const timedOut = new Promise((resolve) => setTimeout(() => resolve(false), 5_000));
  child.kill('SIGINT');
  if (await Promise.race([exited, timedOut])) return;
  child.kill('SIGKILL');
  await waitForExit(child);
}

export async function runFullDev(coursePath) {
  const runtime = spawnChild(
    'bash',
    [
      path.join(root, 'scripts/go/with-internal-toolchain.sh'),
      'run',
      './cmd/synaploom-preview',
      'dev',
      coursePath,
      '--port',
      '4174',
    ],
    { env: process.env },
  );
  let vite;
  stopCurrentRun = async () => {
    await stopAndWait(vite);
    await stopAndWait(runtime);
  };

  try {
    const runtimeBootstrap = await waitForMatch(runtime, bootstrapPattern, 'Go runtime');
    vite = spawnChild(
      process.execPath,
      [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173'],
      {
        cwd: path.join(root, 'apps/web'),
        env: { ...process.env, SYNAPLOOM_DAEMON_ORIGIN: runtimeOrigin },
        forwardStdout: true,
      },
    );
    try {
      await Promise.race([
        waitForMatch(vite, /http:\/\/127\.0\.0\.1:5173\//, 'Vite'),
        waitForExit(runtime).then((code) => {
          throw new Error(`Go runtime exited while Vite was starting (code=${code})`);
        }),
      ]);
      process.stdout.write(`${rewriteBootstrapURL(runtimeBootstrap, viteOrigin)}\n`);
      const exitCode = await Promise.race([
        waitForExit(vite),
        waitForExit(runtime).then((code) => {
          throw new Error(`Go runtime exited while Vite was running (code=${code})`);
        }),
      ]);
      if (exitCode !== 0) throw new Error(`Vite exited with code ${exitCode}`);
    } finally {
      await stopAndWait(vite);
    }
  } finally {
    await stopAndWait(runtime);
    stopCurrentRun = async () => undefined;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const coursePath = parseCoursePath(process.argv.slice(2));
    const onSignal = () => {
      void stopCurrentRun().then(() => process.exit(0));
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    runFullDev(coursePath).catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
