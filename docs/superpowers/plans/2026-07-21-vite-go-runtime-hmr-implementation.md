# Vite Go Runtime HMR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-command development workflow that serves the React UI with Vite HMR while routing all course and session requests to a real local Go runtime.

**Architecture:** `scripts/dev/full.mjs` starts the Go preview runtime on `127.0.0.1:4174`, waits for its one-time bootstrap URL, starts Vite on `127.0.0.1:5173`, and prints a bootstrap URL on the Vite origin. Vite owns only source assets and HMR; it proxies `/bootstrap` and `/api` unchanged to the Go runtime, allowing the existing relative API client and session cookie to work without production-path branches.

**Tech Stack:** Node.js 22+, pnpm 11, Vite 7, Go 1.26.5, Vitest 4, Playwright.

## Global Constraints

- Development servers bind to `127.0.0.1` only: Go uses `4174`; Vite uses `5173`.
- Production continues embedding `internal/webassets/dist`; no production asset or routing behavior changes.
- Browser API paths remain relative and must not introduce an environment-dependent client base URL.
- Vite proxies `/api` and `/bootstrap`, preserving cookies and SSE responses.
- `synaploom dev <course-path>` remains valid; `--port` is optional and defaults to `0`.
- `dev:full` accepts exactly one course directory and forwards an existing `SYNAPLOOM_HOME` unchanged.
- Do not hot-reload Go code or course schema; restart the Go process for those changes.

---

## File structure

| File                               | Responsibility                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `internal/cli/dispatcher.go`       | Parse an optional loopback port for `dev`.                                                   |
| `internal/cli/dispatcher_test.go`  | Preserve current CLI behavior and cover `dev --port`.                                        |
| `apps/web/vite.config.ts`          | Produce the Vite proxy configuration from `SYNAPLOOM_DAEMON_ORIGIN`.                         |
| `tests/dev/vite-config.test.ts`    | Assert both development proxy routes target the Go runtime.                                  |
| `scripts/dev/full.mjs`             | Own child processes, readiness, bootstrap URL rewriting, and shutdown.                       |
| `scripts/dev/full.test.mjs`        | Unit-test argument validation and URL rewriting without starting processes.                  |
| `package.json`                     | Expose the `dev:full` entry point and include script unit tests in `pnpm test`.              |
| `docs/contributing/development.md` | Document the HMR workflow and its explicit restart boundaries.                               |
| `tests/e2e/hmr-go-runtime.spec.ts` | Verify a real browser can load a Go-backed lesson through Vite and receive a CSS HMR update. |
| `playwright.config.ts`             | Include the new HMR suite in the existing Go-runtime project.                                |

### Task 1: Add a stable Go runtime port to `dev`

**Files:**

- Modify: `internal/cli/dispatcher.go:63-69`
- Modify: `internal/cli/dispatcher_test.go`

**Interfaces:**

- Consumes: CLI arguments after `synaploom dev`.
- Produces: `cli.Command{Name: "dev", Path: coursePath, Port: port}` where `port` is `0` unless explicitly supplied.
- Used by: `internal/app/application.go`, which already passes `command.Port` to `serve`.

- [ ] **Step 1: Write failing parser tests**

  Add these cases to `internal/cli/dispatcher_test.go`:

  ```go
  func TestDispatcherParsesDevCommandWithPort(t *testing.T) {
      command, err := Parse([]string{"dev", "examples/course", "--port", "4174"})
      if err != nil {
          t.Fatal(err)
      }
      if command.Name != "dev" || command.Path != "examples/course" || command.Port != 4174 {
          t.Fatalf("unexpected command: %#v", command)
      }
  }

  func TestDispatcherParsesDevCommandWithEphemeralPortByDefault(t *testing.T) {
      command, err := Parse([]string{"dev", "examples/course"})
      if err != nil {
          t.Fatal(err)
      }
      if command.Port != 0 {
          t.Fatalf("port=%d, want 0", command.Port)
      }
  }
  ```

- [ ] **Step 2: Run the parser tests and confirm the new flag is rejected**

  Run:

  ```bash
  bash scripts/go/with-internal-toolchain.sh test ./internal/cli -run 'TestDispatcherParsesDevCommand'
  ```

  Expected: the `WithPort` test fails because the current parser requires exactly one `dev` argument.

- [ ] **Step 3: Parse `dev` arguments with `flag.FlagSet`**

  Replace `parseDev` with this path-first parser. The course path must remain
  the first positional argument so `synaploom dev <course-path> --port 4174`
  matches the documented command shape:

  ```go
  func parseDev(args []string) (Command, error) {
      if len(args) == 0 {
          return Command{}, fmt.Errorf("%w: dev requires a course path", ErrUsage)
      }
      coursePath := args[0]
      set := flag.NewFlagSet("dev", flag.ContinueOnError)
      port := set.Int("port", 0, "local HTTP port")
      if err := set.Parse(args[1:]); err != nil || set.NArg() != 0 {
          return Command{}, fmt.Errorf("%w: dev requires a course path", ErrUsage)
      }
      return Command{Name: "dev", Path: coursePath, Port: *port}, nil
  }
  ```

- [ ] **Step 4: Run formatting and the focused parser tests**

  Run:

  ```bash
  gofmt -w internal/cli/dispatcher.go internal/cli/dispatcher_test.go
  bash scripts/go/with-internal-toolchain.sh test ./internal/cli
  ```

  Expected: `ok github.com/synaploom/synaploom/internal/cli`.

- [ ] **Step 5: Commit the CLI change**

  ```bash
  git add internal/cli/dispatcher.go internal/cli/dispatcher_test.go
  git commit -m "feat: allow fixed ports for dev runtime"
  ```

### Task 2: Proxy real runtime requests through Vite

**Files:**

- Modify: `apps/web/vite.config.ts`
- Create: `tests/dev/vite-config.test.ts`

**Interfaces:**

- Consumes: optional environment variable `SYNAPLOOM_DAEMON_ORIGIN`.
- Produces: `createDevServerOptions(origin?: string): UserConfig['server']` with proxy entries for `/api` and `/bootstrap`.
- Used by: Vite configuration at startup and focused Node tests.

- [ ] **Step 1: Write the failing Vite proxy tests**

  Create `tests/dev/vite-config.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { createDevServerOptions } from '../../apps/web/vite.config';

  describe('createDevServerOptions', () => {
    it('proxies API and bootstrap requests to the configured Go origin', () => {
      const server = createDevServerOptions('http://127.0.0.1:4317');
      const proxy = server?.proxy;

      expect(proxy?.['/api']).toMatchObject({
        target: 'http://127.0.0.1:4317',
        changeOrigin: false,
      });
      expect(proxy?.['/bootstrap']).toMatchObject({
        target: 'http://127.0.0.1:4317',
        changeOrigin: false,
      });
    });

    it('uses the local development origin by default', () => {
      const proxy = createDevServerOptions()?.proxy;
      expect(proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:4174' });
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm the exported helper is absent**

  Run:

  ```bash
  pnpm exec vitest run --project node tests/dev/vite-config.test.ts
  ```

  Expected: FAIL because `createDevServerOptions` is not exported.

- [ ] **Step 3: Add the isolated proxy factory and apply it to Vite**

  Add the import and helper below, then add `server: createDevServerOptions()`
  beside the existing `root`, `plugins`, `resolve`, and `build` properties:

  ```ts
  import type { UserConfig } from 'vite';

  const defaultDaemonOrigin = 'http://127.0.0.1:4174';

  export function createDevServerOptions(
    daemonOrigin = process.env.SYNAPLOOM_DAEMON_ORIGIN ?? defaultDaemonOrigin,
  ): UserConfig['server'] {
    return {
      host: '127.0.0.1',
      proxy: {
        '/api': { target: daemonOrigin, changeOrigin: false },
        '/bootstrap': { target: daemonOrigin, changeOrigin: false },
      },
    };
  }

  export default defineConfig({
    // Keep all current settings unchanged.
    server: createDevServerOptions(),
  });
  ```

  Do not add a proxy for application routes: Vite must serve the SPA shell and
  its own HMR client for those paths.

- [ ] **Step 4: Run the focused config test and TypeScript check**

  Run:

  ```bash
  pnpm exec vitest run --project node tests/dev/vite-config.test.ts
  pnpm typecheck
  ```

  Expected: both commands exit `0`.

- [ ] **Step 5: Commit the proxy configuration**

  ```bash
  git add apps/web/vite.config.ts tests/dev/vite-config.test.ts
  git commit -m "feat: proxy Vite development requests to Go"
  ```

### Task 3: Provide the one-command HMR workflow

**Files:**

- Create: `scripts/dev/full.mjs`
- Create: `scripts/dev/full.test.mjs`
- Modify: `package.json`
- Modify: `docs/contributing/development.md`

**Interfaces:**

- Consumes: one course path from `process.argv.slice(2)` and optional `SYNAPLOOM_HOME`.
- Produces: a Vite-origin bootstrap URL, or a nonzero exit code with the child process failure.
- Uses: `bash scripts/go/with-internal-toolchain.sh run ./cmd/synaploom-preview dev <course> --port 4174` and the local Vite package entry point.

- [ ] **Step 1: Write failing unit tests for pure orchestration helpers**

  Create `scripts/dev/full.test.mjs`:

  ```js
  import assert from 'node:assert/strict';
  import test from 'node:test';
  import { parseCoursePath, rewriteBootstrapURL } from './full.mjs';

  test('requires exactly one course path', () => {
    assert.equal(parseCoursePath(['examples/course']), 'examples/course');
    assert.throws(() => parseCoursePath([]), /requires exactly one course path/);
    assert.throws(() => parseCoursePath(['one', 'two']), /requires exactly one course path/);
  });

  test('rewrites only the bootstrap origin for Vite', () => {
    assert.equal(
      rewriteBootstrapURL(
        'http://127.0.0.1:4174/bootstrap?token=one-time-token',
        'http://127.0.0.1:5173',
      ),
      'http://127.0.0.1:5173/bootstrap?token=one-time-token',
    );
  });
  ```

- [ ] **Step 2: Run the Node tests and confirm the module is absent**

  Run:

  ```bash
  node --test scripts/dev/full.test.mjs
  ```

  Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/dev/full.mjs`.

- [ ] **Step 3: Implement process orchestration with deterministic shutdown**

  Create `scripts/dev/full.mjs` with the following implementation. Keep the
  constants at the top so test fixtures and error messages use one port policy.

  ```js
  import { spawn } from 'node:child_process';
  import { fileURLToPath } from 'node:url';
  import path from 'node:path';

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const runtimeOrigin = 'http://127.0.0.1:4174';
  const viteOrigin = 'http://127.0.0.1:5173';
  const bootstrapPattern = /http:\/\/127\.0\.0\.1:4174\/bootstrap\?token=[^\s]+/;
  let stopCurrentRun = async () => {};

  export function parseCoursePath(args) {
    if (args.length !== 1) throw new Error('dev:full requires exactly one course path');
    return args[0];
  }

  export function rewriteBootstrapURL(runtimeURL, browserOrigin) {
    const url = new URL(runtimeURL);
    const target = new URL(browserOrigin);
    url.protocol = target.protocol;
    url.hostname = target.hostname;
    url.port = target.port;
    return url.toString();
  }

  function spawnChild(file, args, options) {
    const child = spawn(file, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    return child;
  }

  function waitForExit(child) {
    if (child.exitCode !== null) return Promise.resolve(child.exitCode);
    return new Promise((resolve) => child.once('exit', (code) => resolve(code ?? 1)));
  }

  function waitForMatch(child, pattern, label) {
    return new Promise((resolve, reject) => {
      let output = '';
      const onData = (chunk) => {
        output += String(chunk);
        const match = output.match(pattern);
        if (match) finish(resolve, match[0]);
      };
      const onError = (error) =>
        finish(reject, new Error(`${label} failed to start: ${error.message}`));
      const onExit = (code, signal) =>
        finish(reject, new Error(`${label} exited before ready (code=${code}, signal=${signal})`));
      const cleanup = () => {
        child.stdout.off('data', onData);
        child.off('error', onError);
        child.off('exit', onExit);
      };
      const finish = (settle, value) => {
        cleanup();
        settle(value);
      };
      child.stdout.on('data', onData);
      child.once('error', onError);
      child.once('exit', onExit);
    });
  }

  async function stopAndWait(child) {
    if (!child || child.exitCode !== null) return;
    child.kill('SIGINT');
    await Promise.race([waitForExit(child), new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
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
        [
          path.join(root, 'apps/web/node_modules/vite/bin/vite.js'),
          '--host',
          '127.0.0.1',
          '--port',
          '5173',
        ],
        { env: { ...process.env, SYNAPLOOM_DAEMON_ORIGIN: runtimeOrigin } },
      );
      try {
        await waitForMatch(vite, /http:\/\/127\.0\.0\.1:5173\//, 'Vite');
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
      stopCurrentRun = async () => {};
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
  ```

- [ ] **Step 4: Wire the script into repository commands and contributor docs**

  In `package.json`, make these exact script changes:

  ```json
  {
    "scripts": {
      "test": "node scripts/test/run-vitest-batches.mjs && node --test scripts/dev/full.test.mjs",
      "dev:full": "node scripts/dev/full.mjs"
    }
  }
  ```

  Add this section to `docs/contributing/development.md` after setup guidance:

  ```markdown
  ## Frontend HMR with the real runtime

  Run `pnpm dev:full -- examples/frontend-performance-foundations`, then open
  the printed `127.0.0.1:5173/bootstrap?...` URL. Vite reloads React and CSS
  changes immediately while `/bootstrap` and `/api` are served by the local Go
  runtime. Restart `dev:full` after Go changes, course manifest changes, or
  course structure changes. Production preview and release workflows still use
  `pnpm go:stage-web` followed by a Go build.
  ```

- [ ] **Step 5: Run the script unit tests, lint, and a manual startup smoke test**

  Run:

  ```bash
  node --test scripts/dev/full.test.mjs
  pnpm lint
  pnpm dev:full -- examples/frontend-performance-foundations
  ```

  Expected: the tests and lint exit `0`; the final command prints one
  `http://127.0.0.1:5173/bootstrap?token=...` URL and stops both children when
  interrupted with `Ctrl-C`.

- [ ] **Step 6: Commit the developer workflow**

  ```bash
  git add scripts/dev/full.mjs scripts/dev/full.test.mjs package.json docs/contributing/development.md
  git commit -m "feat: add Go-backed Vite HMR workflow"
  ```

### Task 4: Verify a browser receives both real API data and HMR updates

**Files:**

- Create: `tests/e2e/hmr-go-runtime.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

- Consumes: the `pnpm dev:full` contract from Task 3 and the existing example course.
- Produces: a browser-level regression proving a Vite-origin bootstrap route, Go-backed lesson data, and CSS HMR update.

- [ ] **Step 1: Write the failing end-to-end test**

  Create `tests/e2e/hmr-go-runtime.spec.ts`:

  ```ts
  import { expect, test } from '@playwright/test';
  import { spawn, type ChildProcess } from 'node:child_process';
  import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
  import { tmpdir } from 'node:os';
  import path from 'node:path';

  const root = path.resolve(import.meta.dirname, '../..');
  const cssPath = path.join(root, 'apps/web/src/application.css');
  let proc: ChildProcess | undefined;
  let home = '';
  let bootstrap = '';
  let originalCSS = '';

  function startDev(): Promise<string> {
    proc = spawn('node', ['scripts/dev/full.mjs', 'examples/frontend-performance-foundations'], {
      cwd: root,
      env: { ...process.env, SYNAPLOOM_HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HMR startup timeout')), 60_000);
      proc?.stdout?.on('data', (chunk) => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:5173\/bootstrap\?token=[^\s]+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      proc?.once('exit', (code) => reject(new Error(`HMR process exited ${code}`)));
    });
  }

  test.beforeAll(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'synaploom-hmr-'));
    originalCSS = await readFile(cssPath, 'utf8');
    bootstrap = await startDev();
  });

  async function stopDev(): Promise<void> {
    if (!proc || proc.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => proc?.once('exit', () => resolve()));
    proc.kill('SIGINT');
    await Promise.race([
      exited,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          proc?.kill('SIGKILL');
          resolve();
        }, 5_000),
      ),
    ]);
  }

  test.afterAll(async () => {
    await writeFile(cssPath, originalCSS);
    await stopDev();
    if (home) await rm(home, { recursive: true, force: true });
  });

  test('loads a Go-backed lesson and hot-reloads a CSS change', async ({ page }) => {
    await page.goto(bootstrap);
    await expect(page.getByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();

    try {
      const value = `hmr-${Date.now()}`;
      await appendFile(cssPath, `\n:root { --synaploom-hmr-sentinel: ${value}; }\n`);

      await expect
        .poll(() =>
          page
            .locator('html')
            .evaluate((element) =>
              getComputedStyle(element).getPropertyValue('--synaploom-hmr-sentinel').trim(),
            ),
        )
        .toBe(value);
    } finally {
      await writeFile(cssPath, originalCSS);
    }
  });
  ```

- [ ] **Step 2: Run the end-to-end test and confirm it is not selected yet**

  Run:

  ```bash
  pnpm test:e2e --project=go-runtime --grep 'hot-reloads a CSS change'
  ```

  Expected: no matching test is found because the Go-runtime project does not
  yet include the new filename.

- [ ] **Step 3: Include the HMR file in the Go-runtime Playwright project**

  Change the project matcher in `playwright.config.ts` to:

  ```ts
  testMatch: /(?:go|multi-domain|dual-surface-workspace|hmr-go)-runtime\.spec\.ts/,
  ```

  The failing-test code already includes the final cleanup shape. Apply the
  matcher change without altering its `stopDev` or `try/finally` behavior.

- [ ] **Step 4: Run the focused HMR acceptance test**

  Run:

  ```bash
  pnpm test:e2e --project=go-runtime --grep 'hot-reloads a CSS change'
  ```

  Expected: the browser displays `Main Thread` through port `5173`, and the
  sentinel CSS custom property changes without a Go rebuild or runtime restart.

- [ ] **Step 5: Run final relevant checks**

  Run:

  ```bash
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm go:test
  pnpm test:e2e --project=go-runtime
  ```

  Expected: all commands exit `0`. Existing production Go-runtime tests prove
  embedded assets still work; the new HMR test proves the development proxy
  path works independently.

- [ ] **Step 6: Commit acceptance coverage**

  ```bash
  git add tests/e2e/hmr-go-runtime.spec.ts playwright.config.ts
  git commit -m "test: cover Vite HMR with Go runtime API"
  ```

## Plan self-review

- **Spec coverage:** Task 1 supplies a stable runtime port; Task 2 adds the two
  required proxy routes; Task 3 provides the one-command workflow, bootstrap
  URL rewriting, shutdown handling, documentation, and no client-path changes;
  Task 4 verifies real API and HMR behavior.
- **Scope:** The plan keeps all production embedding and native release code
  untouched, and deliberately excludes Go/schema hot reload.
- **Consistency:** The same ports (`4174` Go, `5173` Vite), route names
  (`/api`, `/bootstrap`), and command (`pnpm dev:full -- <course>`) appear in
  every task.
- **Placeholder scan:** No deferred implementation markers remain; every
  source change, test target, command, and commit target has an exact path.
