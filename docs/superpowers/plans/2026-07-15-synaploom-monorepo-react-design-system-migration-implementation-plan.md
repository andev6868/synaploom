# Synaploom Monorepo, React, and Design System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally migrate the existing local-first Nova Learn proof-of-concept into Synaploom: a pnpm workspace with strict TypeScript boundaries, a React/Vite client, a product-owned accessible design system, optional provider-neutral AI, and an offline-installable CLI.

**Architecture:** Preserve the daemon-authoritative local learning runtime while replacing nominal package folders and handwritten orchestration with real workspace packages and project references. Migrate the browser client in two stages—first a behavior-compatible React shell, then the focused learning workspace using `@synaploom/ui` and typed lesson blocks—so every slice remains packageable and testable.

**Tech Stack:** Node.js `>=22.13.0`, pnpm `11.13.0`, TypeScript `6.0.3`, ESLint `10.7.0`, Prettier `3.9.5`, Vitest `4.1.10`, React `19.2.7`, Vite `8.1.4`, TanStack Query `5.101.2`, Tailwind CSS `4.3.2`, Radix Primitives, Class Variance Authority `0.7.1`, Lucide React `1.24.0`, React Resizable Panels `4.12.2`, Playwright `1.61.1`, tsup `8.5.1`.

## Global Constraints

- The learner runtime remains local-first and binds only to `127.0.0.1`.
- The minimum supported Node.js version is exactly `22.13.0`; contributor tooling may also run on Node.js 24 and newer supported majors.
- The package manager is pinned to `pnpm@11.13.0` through the root `packageManager` field and Corepack.
- The product name is `Synaploom`, the CLI command is `synaploom`, the npm scope is `@synaploom`, the local data root is `~/.synaploom`, the session cookie is `synaploom_session`, and design tokens use the `--syn-*` prefix.
- Existing `~/.nova-learn` data is moved only when `~/.synaploom` does not exist; when both exist the CLI must leave both untouched and report a conflict.
- All internal package dependencies use `workspace:*`.
- Authored TypeScript and TSX source imports must not start with `./` or `../`; cross-package imports use public `@synaploom/*` exports and intra-package imports use `#/*` private aliases.
- Domain packages must not depend on React, Vite, `@synaploom/ui`, or any `apps/*` package.
- TypeScript uses strict project references with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax` enabled.
- Prettier is the only formatting authority: `printWidth: 100`, `singleQuote: true`, `semi: true`, `trailingComma: all`, `endOfLine: lf`.
- Public exported functions, types, classes, hooks, and components require English TSDoc; comments explain contracts, invariants, security boundaries, platform constraints, and non-obvious decisions rather than narrating obvious code.
- Imported Markdown is converted to a typed safe document; unrestricted MDX, arbitrary HTML, and unrestricted `dangerouslySetInnerHTML` are prohibited.
- The browser sends declared action IDs only; raw shell commands remain prohibited.
- AI is optional, provider-neutral, daemon-side, and cannot unlock lessons, mark completion, execute undeclared commands, or expose provider credentials to the browser.
- Each migration task ends with `pnpm verify:fast` or the stronger gate specified by the task, and the packed CLI must remain installable offline at every slice boundary.
- No intentional lint, type, build, test, or packaging warnings are accepted without a documented and tested exception.

---

## Target File Map

The migration converges on the following responsibilities:

```text
package.json                         Root scripts, pinned package manager, shared dev dependencies
pnpm-workspace.yaml                 Workspace discovery
pnpm-lock.yaml                      Reproducible dependency graph
.prettierrc.json                    Formatting contract
eslint.config.mjs                   Root flat ESLint configuration
vite.config.ts                      Web production build and local daemon proxy
vitest.config.ts                    Vitest 4 projects for node, DOM, and architecture suites
tsconfig.json                       Project-reference root
tooling/typescript-config/*         Shared Node, React, and package compiler settings
tooling/eslint-config/*             Reusable lint policy and boundary rules
tooling/test-config/*               Shared Vitest setup and fixtures
apps/cli                            CLI lifecycle, rename migration, packaging entry point
apps/daemon                         Local HTTP/SSE daemon and AI extension composition
apps/web                            React/Vite client
packages/contracts                  Domain records and stable shared types
packages/protocol                   Typed local HTTP and process-event contracts
packages/course-schema              Course and exercise schemas
packages/course-loader              Disk-to-domain normalization
packages/course-validator           Package validation
packages/course-importer            Trust and installation
packages/lesson-renderer            Markdown-to-typed-block conversion
packages/local-database             SQLite access and migrations
packages/progression                Linear lesson progression
packages/workspace-manager          Learner workspace isolation
packages/exercise-runner            Declared-action execution
packages/security                   Local trust, token, and path helpers
packages/ai-contracts               Provider-neutral AI contracts and disabled provider
packages/ui                         Synaploom Design System
tests/architecture                  Import and dependency-boundary enforcement
tests/e2e                           Playwright local course flow
tests/integration                   Packed CLI and persistence verification
tests/security                      Local execution and path security regression coverage
```

---

# Slice 1 — Workspace and Engineering Foundation

### Task 1: Introduce the pinned pnpm workspace without changing runtime behavior

**Files:**

- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `tests/architecture/workspace-manifest.spec.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Preserve: `scripts/build.mjs`, `scripts/test.mjs`, `scripts/typecheck.mjs`

**Interfaces:**

- Consumes: the existing npm scripts and package folders.
- Produces: Corepack-compatible pnpm installation, workspace discovery for `apps/*`, `packages/*`, and `tooling/*`, and root lifecycle commands that still delegate to the existing implementation until later slices replace them.

- [ ] **Step 1: Write the failing workspace manifest test**

```ts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

test('pins pnpm and declares every workspace family', async () => {
  const rootPackage = await readJson('package.json');
  const workspace = await readFile('pnpm-workspace.yaml', 'utf8');
  const npmrc = await readFile('.npmrc', 'utf8');

  assert.equal(rootPackage.packageManager, 'pnpm@11.13.0');
  assert.deepEqual(rootPackage.engines, { node: '>=22.13.0' });
  assert.match(workspace, /- apps\/\*/);
  assert.match(workspace, /- packages\/\*/);
  assert.match(workspace, /- tooling\/\*/);
  assert.match(npmrc, /engine-strict=true/);
  assert.match(npmrc, /link-workspace-packages=true/);
});
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```bash
node --experimental-strip-types --test tests/architecture/workspace-manifest.spec.ts
```

Expected: FAIL because `pnpm-workspace.yaml` does not exist and `packageManager` is absent.

- [ ] **Step 3: Add the workspace root and pinned toolchain**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - tooling/*
```

Create `.npmrc`:

```ini
engine-strict=true
link-workspace-packages=true
prefer-workspace-packages=true
shared-workspace-lockfile=true
strict-peer-dependencies=true
```

Replace root `package.json` with:

```json
{
  "name": "synaploom",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.13.0",
  "engines": {
    "node": ">=22.13.0"
  },
  "scripts": {
    "build": "node apps/cli/scripts/build.mjs",
    "typecheck": "node scripts/typecheck.mjs",
    "check:type-strip": "node scripts/typecheck.mjs",
    "test": "node scripts/test.mjs",
    "test:e2e": "node --experimental-strip-types --test tests/e2e/*.spec.ts",
    "validate:example": "node --experimental-strip-types apps/cli/src/index.ts course validate examples/frontend-performance-foundations",
    "pack:cli": "pnpm --dir apps/cli pack",
    "verify:fast": "pnpm check:type-strip && pnpm test && pnpm build",
    "verify": "pnpm verify:fast && pnpm test:e2e"
  }
}
```

Append to `.gitignore`:

```gitignore
node_modules/
.pnpm-store/
coverage/
playwright-report/
test-results/
```

- [ ] **Step 4: Activate Corepack, install, and verify the unchanged baseline**

Run:

```bash
corepack enable
corepack prepare pnpm@11.13.0 --activate
pnpm install
node --experimental-strip-types --test tests/architecture/workspace-manifest.spec.ts
pnpm verify:fast
```

Expected: the architecture test passes; the existing type-strip, test, and build gates remain green.

- [ ] **Step 5: Commit the workspace foundation**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .gitignore tests/architecture/workspace-manifest.spec.ts
git commit -m "build: introduce pinned pnpm workspace"
```

### Task 2: Add shared formatting, lint, TypeScript, and test configuration packages

**Files:**

- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.mjs`
- Create: `tooling/typescript-config/package.json`
- Create: `tooling/typescript-config/base.json`
- Create: `tooling/typescript-config/node.json`
- Create: `tooling/typescript-config/react.json`
- Create: `tooling/eslint-config/package.json`
- Create: `tooling/eslint-config/index.mjs`
- Create: `tooling/test-config/package.json`
- Create: `tooling/test-config/setup-dom.ts`
- Create: `docs/engineering/typescript-react-style-guide.md`
- Create: `tests/architecture/engineering-tooling.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 1 workspace discovery.
- Produces: `@synaploom/typescript-config`, `@synaploom/eslint-config`, and `@synaploom/test-config` for later packages; root `format`, `lint`, and shared style policy.

- [ ] **Step 1: Write the failing engineering-tooling contract test**

```ts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function json(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

test('pins the approved engineering toolchain and formatting policy', async () => {
  const root = await json('package.json');
  const prettier = await json('.prettierrc.json');
  const devDependencies = root.devDependencies as Record<string, string>;

  assert.equal(devDependencies.prettier, '3.9.5');
  assert.equal(devDependencies.eslint, '10.7.0');
  assert.equal(devDependencies.typescript, '6.0.3');
  assert.equal(devDependencies['typescript-eslint'], '8.64.0');
  assert.deepEqual(prettier, {
    printWidth: 100,
    singleQuote: true,
    semi: true,
    trailingComma: 'all',
    endOfLine: 'lf',
  });
  assert.match(await readFile('docs/engineering/typescript-react-style-guide.md', 'utf8'), /TSDoc/);
});
```

- [ ] **Step 2: Run the test and verify it fails for missing configuration**

```bash
node --experimental-strip-types --test tests/architecture/engineering-tooling.spec.ts
```

Expected: FAIL because the shared configuration files and pinned dependencies do not exist.

- [ ] **Step 3: Add exact dependencies and shared configuration**

Add these root `devDependencies`:

```json
{
  "@eslint/js": "10.0.1",
  "@synaploom/eslint-config": "workspace:*",
  "@synaploom/test-config": "workspace:*",
  "@synaploom/typescript-config": "workspace:*",
  "@types/node": "22.19.21",
  "eslint": "10.7.0",
  "eslint-import-resolver-typescript": "4.4.5",
  "eslint-plugin-boundaries": "7.0.2",
  "eslint-plugin-import-x": "4.17.1",
  "eslint-plugin-jsx-a11y": "6.10.2",
  "eslint-plugin-react-hooks": "7.1.1",
  "globals": "17.7.0",
  "prettier": "3.9.5",
  "typescript": "6.0.3",
  "typescript-eslint": "8.64.0",
  "vitest": "4.1.10"
}
```

Create `.prettierrc.json`:

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

Create `tooling/typescript-config/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

Create `tooling/typescript-config/node.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "customConditions": ["development"]
  }
}
```

Create `tooling/typescript-config/react.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  }
}
```

Create `tooling/typescript-config/package.json`:

```json
{
  "name": "@synaploom/typescript-config",
  "version": "0.1.0",
  "private": true,
  "files": ["base.json", "node.json", "react.json"]
}
```

Create `tooling/eslint-config/package.json`:

```json
{
  "name": "@synaploom/eslint-config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": "./index.mjs",
  "dependencies": {
    "@eslint/js": "10.0.1",
    "eslint-plugin-boundaries": "7.0.2",
    "eslint-plugin-import-x": "4.17.1",
    "eslint-plugin-jsx-a11y": "6.10.2",
    "eslint-plugin-react-hooks": "7.1.1",
    "typescript-eslint": "8.64.0"
  },
  "peerDependencies": {
    "eslint": "10.7.0",
    "typescript": ">=4.8.4 <6.1.0"
  }
}
```

Create `tooling/eslint-config/index.mjs`:

```js
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export const sourceFiles = ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'];

export function createSynaploomConfig({ tsconfigRootDir }) {
  return tseslint.config(
    { ignores: ['**/dist/**', '**/node_modules/**', 'artifacts/**'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      files: sourceFiles,
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      plugins: {
        boundaries,
        'import-x': importX,
        'jsx-a11y': jsxA11y,
        'react-hooks': reactHooks,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/no-non-null-assertion': 'error',
        'import-x/no-extraneous-dependencies': 'error',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error',
        ...jsxA11y.flatConfigs.recommended.rules,
      },
    },
  );
}
```

Create root `eslint.config.mjs`:

```js
import { createSynaploomConfig } from '@synaploom/eslint-config';

export default createSynaploomConfig({ tsconfigRootDir: import.meta.dirname });
```

Create `tooling/test-config/package.json`:

```json
{
  "name": "@synaploom/test-config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./setup-dom": "./setup-dom.ts"
  },
  "dependencies": {
    "@testing-library/jest-dom": "6.9.1"
  }
}
```

Create `tooling/test-config/setup-dom.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add root scripts:

```json
{
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0"
}
```

Write `docs/engineering/typescript-react-style-guide.md` with explicit sections for module boundaries, TSDoc, comments, error handling, React component structure, hooks, accessibility, testing, and formatting. The guide must include this rule verbatim:

```text
Comments explain why a contract or constraint exists. They do not repeat what the code already states.
```

- [ ] **Step 4: Install, format, and verify the configuration**

```bash
pnpm install
pnpm format
node --experimental-strip-types --test tests/architecture/engineering-tooling.spec.ts
pnpm format:check
```

Expected: the contract test and formatting gate pass. Run `pnpm lint` only after Task 7 supplies parser project configuration for every package.

- [ ] **Step 5: Commit the engineering foundation**

```bash
git add package.json pnpm-lock.yaml .prettierrc.json .prettierignore eslint.config.mjs tooling docs/engineering tests/architecture/engineering-tooling.spec.ts
git commit -m "build: add shared engineering standards"
```

---

# Slice 2 — Naming and Real Package Boundaries

### Task 3: Rename package identities and CLI metadata to Synaploom

**Files:**

- Modify: `package.json`
- Modify: `apps/cli/package.json`
- Modify: `apps/daemon/package.json`
- Modify: `apps/web/package.json`
- Modify: every `packages/*/package.json`
- Move: `packages/workspace` → `packages/workspace-manager`
- Create: `tests/architecture/package-identities.spec.ts`

**Interfaces:**

- Consumes: pnpm workspace and shared toolchain.
- Produces: canonical package names, `synaploom` binary metadata, and workspace dependency declarations for all current packages.

- [ ] **Step 1: Write the failing package identity test**

```ts
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

async function manifest(filePath: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

test('uses the Synaploom identity for every workspace package', async () => {
  const roots = ['apps', 'packages', 'tooling'];
  const names: string[] = [];

  for (const root of roots) {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageJson = await manifest(`${root}/${entry.name}/package.json`);
      names.push(String(packageJson.name));
    }
  }

  assert.ok(names.every((name) => name.startsWith('@synaploom/')));
  const cli = await manifest('apps/cli/package.json');
  assert.deepEqual(cli.bin, { synaploom: './dist/index.js' });
  assert.equal(cli.name, '@synaploom/cli');
});
```

- [ ] **Step 2: Run the test and verify the Nova identities fail**

```bash
node --experimental-strip-types --test tests/architecture/package-identities.spec.ts
```

Expected: FAIL because packages still use `@nova-learn/*` and the CLI binary is `nova-learn`.

- [ ] **Step 3: Rename package manifests and declare workspace dependencies**

Apply this package matrix exactly:

| Path                         | Package name                   | Workspace dependencies                                                                                                                                                                            |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/cli`                   | `@synaploom/cli`               | `@synaploom/daemon`, `@synaploom/course-importer`, `@synaploom/course-loader`, `@synaploom/course-validator`, `@synaploom/exercise-runner`, `@synaploom/local-database`, `@synaploom/progression` |
| `apps/daemon`                | `@synaploom/daemon`            | `@synaploom/contracts`, `@synaploom/course-loader`, `@synaploom/exercise-runner`, `@synaploom/local-database`, `@synaploom/progression`, `@synaploom/security`, `@synaploom/workspace-manager`    |
| `apps/web`                   | `@synaploom/web`               | none until Slice 4                                                                                                                                                                                |
| `packages/contracts`         | `@synaploom/contracts`         | none                                                                                                                                                                                              |
| `packages/course-schema`     | `@synaploom/course-schema`     | `@synaploom/contracts`                                                                                                                                                                            |
| `packages/course-loader`     | `@synaploom/course-loader`     | `@synaploom/contracts`, `@synaploom/course-schema`, `@synaploom/lesson-renderer`, `@synaploom/security`                                                                                           |
| `packages/course-validator`  | `@synaploom/course-validator`  | `@synaploom/contracts`, `@synaploom/course-schema`, `@synaploom/security`                                                                                                                         |
| `packages/course-importer`   | `@synaploom/course-importer`   | `@synaploom/contracts`, `@synaploom/course-loader`, `@synaploom/local-database`, `@synaploom/security`                                                                                            |
| `packages/lesson-renderer`   | `@synaploom/lesson-renderer`   | `@synaploom/contracts`                                                                                                                                                                            |
| `packages/local-database`    | `@synaploom/local-database`    | `@synaploom/contracts`                                                                                                                                                                            |
| `packages/progression`       | `@synaploom/progression`       | `@synaploom/contracts`, `@synaploom/local-database`                                                                                                                                               |
| `packages/workspace-manager` | `@synaploom/workspace-manager` | `@synaploom/contracts`, `@synaploom/security`                                                                                                                                                     |
| `packages/exercise-runner`   | `@synaploom/exercise-runner`   | `@synaploom/contracts`, `@synaploom/security`                                                                                                                                                     |
| `packages/security`          | `@synaploom/security`          | none                                                                                                                                                                                              |

Every internal dependency value is exactly `workspace:*`.

Use this common manifest shape for reusable packages:

```json
{
  "name": "@synaploom/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "imports": {
    "#/*": {
      "development": "./src/*.ts",
      "default": "./dist/*.js"
    }
  }
}
```

Move the workspace package:

```bash
git mv packages/workspace packages/workspace-manager
```

Set the CLI `bin` field to:

```json
{
  "synaploom": "./dist/index.js"
}
```

- [ ] **Step 4: Install and verify workspace-only resolution**

```bash
pnpm install
node --experimental-strip-types --test tests/architecture/package-identities.spec.ts
pnpm list --recursive --depth 0
```

Expected: every internal dependency is linked from the workspace and no `@nova-learn/*` package appears.

- [ ] **Step 5: Commit package identities**

```bash
git add package.json pnpm-lock.yaml apps packages tests/architecture/package-identities.spec.ts
git commit -m "refactor: rename workspace packages to Synaploom"
```

### Task 4: Implement the product rename and one-time local-data migration

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/local-database/src/open-database.ts`
- Create: `packages/local-database/src/migrate-legacy-home.ts`
- Create: `packages/local-database/src/migrate-legacy-home.test.ts`
- Modify: `packages/local-database/src/index.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/commands/doctor.ts`
- Modify: `apps/daemon/src/auth.ts`
- Modify: `apps/daemon/src/create-server.ts`
- Modify: user-facing strings under `apps/*`, `docs/*`, and `apps/cli/README.md`

**Interfaces:**

- Consumes: renamed package identities from Task 3.
- Produces: `SynaploomHomePaths`, `resolveSynaploomHome(base?)`, `migrateLegacyNovaHome(options)`, `synaploom_session`, and Synaploom user-facing output.

- [ ] **Step 1: Write failing migration tests for all three filesystem states**

```ts
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateLegacyNovaHome } from '#/migrate-legacy-home';

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

describe('migrateLegacyNovaHome', () => {
  it('moves legacy data when only the old directory exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-migration-'));
    const legacyRoot = path.join(root, '.nova-learn');
    const targetRoot = path.join(root, '.synaploom');
    await mkdir(legacyRoot);
    await writeFile(path.join(legacyRoot, 'marker.txt'), 'progress', 'utf8');

    const result = await migrateLegacyNovaHome({ legacyRoot, targetRoot });

    expect(result).toEqual({ status: 'migrated', legacyRoot, targetRoot });
    expect(await exists(legacyRoot)).toBe(false);
    expect(await readFile(path.join(targetRoot, 'marker.txt'), 'utf8')).toBe('progress');
  });

  it('does nothing when neither directory exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-migration-'));
    const legacyRoot = path.join(root, '.nova-learn');
    const targetRoot = path.join(root, '.synaploom');

    await expect(migrateLegacyNovaHome({ legacyRoot, targetRoot })).resolves.toEqual({
      status: 'not-needed',
      legacyRoot,
      targetRoot,
    });
  });

  it('reports a conflict without modifying either directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-migration-'));
    const legacyRoot = path.join(root, '.nova-learn');
    const targetRoot = path.join(root, '.synaploom');
    await mkdir(legacyRoot);
    await mkdir(targetRoot);

    await expect(migrateLegacyNovaHome({ legacyRoot, targetRoot })).resolves.toEqual({
      status: 'conflict',
      legacyRoot,
      targetRoot,
    });
    assert.equal(await exists(legacyRoot), true);
    assert.equal(await exists(targetRoot), true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing export**

```bash
pnpm vitest run packages/local-database/src/migrate-legacy-home.test.ts
```

Expected: FAIL because `migrateLegacyNovaHome` does not exist. If Vitest has not been activated yet, run the same file through `pnpm exec vitest run`.

- [ ] **Step 3: Implement the migration and rename runtime contracts**

Create `packages/local-database/src/migrate-legacy-home.ts`:

```ts
import { access, rename } from 'node:fs/promises';

export interface LegacyHomeMigrationOptions {
  readonly legacyRoot: string;
  readonly targetRoot: string;
}

export type LegacyHomeMigrationResult =
  | {
      readonly status: 'migrated';
      readonly legacyRoot: string;
      readonly targetRoot: string;
    }
  | {
      readonly status: 'not-needed';
      readonly legacyRoot: string;
      readonly targetRoot: string;
    }
  | {
      readonly status: 'conflict';
      readonly legacyRoot: string;
      readonly targetRoot: string;
    };

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves the pre-release Nova Learn data directory to the Synaploom location.
 *
 * The migration is intentionally conservative. When both roots exist, neither
 * directory is modified because automatically merging SQLite and workspace data
 * could silently corrupt learner progress.
 */
export async function migrateLegacyNovaHome(
  options: LegacyHomeMigrationOptions,
): Promise<LegacyHomeMigrationResult> {
  const [legacyExists, targetExists] = await Promise.all([
    exists(options.legacyRoot),
    exists(options.targetRoot),
  ]);

  if (legacyExists && targetExists) {
    return { status: 'conflict', ...options };
  }
  if (!legacyExists) {
    return { status: 'not-needed', ...options };
  }

  await rename(options.legacyRoot, options.targetRoot);
  return { status: 'migrated', ...options };
}
```

Rename `NovaHomePaths` to `SynaploomHomePaths` and replace `resolveNovaHome` with:

```ts
/** Resolves the local Synaploom data directories for the current learner. */
export function resolveSynaploomHome(
  base = path.join(os.homedir(), '.synaploom'),
): SynaploomHomePaths {
  return {
    root: base,
    courses: path.join(base, 'courses'),
    workspaces: path.join(base, 'workspaces'),
    state: path.join(base, 'state'),
    logs: path.join(base, 'logs'),
    runtime: path.join(base, 'runtime'),
    database: path.join(base, 'state', 'synaploom.db'),
  };
}
```

At CLI startup, run the migration before opening the database. When the result is `conflict`, print:

```text
Synaploom found both ~/.nova-learn and ~/.synaploom. Neither directory was changed. Move or remove one directory, then run the command again.
```

Rename cookie reads and writes to `synaploom_session`. Replace all product-facing `Nova Learn` strings with `Synaploom` and update the minimum-version error to `Synaploom requires Node.js >=22.13.0`.

- [ ] **Step 4: Run migration, CLI, daemon, and full regression tests**

```bash
pnpm vitest run packages/local-database/src/migrate-legacy-home.test.ts
pnpm test
pnpm build
```

Expected: migration tests pass, existing local progression behavior remains green, and the generated CLI prints Synaploom branding.

- [ ] **Step 5: Commit the product rename**

```bash
git add apps packages docs
git commit -m "feat: rename local runtime to Synaploom"
```

### Task 5: Replace cross-package relative imports with public package imports

**Files:**

- Modify: all `apps/**/*.ts`
- Modify: all `packages/**/*.ts`
- Modify: all `tests/**/*.ts`
- Create: `tests/architecture/import-boundaries.spec.ts`
- Modify: package `exports`, `imports`, and `dependencies` fields as required

**Interfaces:**

- Consumes: canonical `@synaploom/*` manifests.
- Produces: source imports that use package exports across boundaries and `#/*` aliases within a package; automated prohibition of relative TS/TSX imports and deep package imports.

- [ ] **Step 1: Write the failing source-import architecture test**

```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = ['apps', 'packages', 'tests'];

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory() && !['dist', 'node_modules'].includes(entry.name))
        await visit(target);
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(target);
    }
  }
  await visit(root);
  return files;
}

describe('source module boundaries', () => {
  it('contains no authored relative imports or package-private deep imports', async () => {
    const violations: string[] = [];
    for (const root of roots) {
      for (const file of await sourceFiles(root)) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)) {
          const specifier = match[2] ?? '';
          if (specifier.startsWith('./') || specifier.startsWith('../')) {
            violations.push(`${file}: relative import ${specifier}`);
          }
          if (/^@synaploom\/[^/]+\/src\//.test(specifier)) {
            violations.push(`${file}: private package import ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the architecture test and inspect the full violation list**

```bash
pnpm vitest run tests/architecture/import-boundaries.spec.ts
```

Expected: FAIL with imports such as `../../packages/.../src` and `./terminal.ts`.

- [ ] **Step 3: Convert imports package by package**

Use public imports for cross-package dependencies:

```ts
import type { NormalizedCourse, SynaploomHomePaths } from '@synaploom/contracts';
import { openDatabase, ProgressRepository } from '@synaploom/local-database';
import { ProgressionService } from '@synaploom/progression';
import { ExerciseRunner } from '@synaploom/exercise-runner';
```

Use private aliases for intra-package modules:

```ts
import { createTerminal } from '#/terminal';
import type { CliDependencies } from '#/types';
import { runDoctor } from '#/commands/doctor';
```

For each package, add a private alias mapping that is usable in source and built output:

```json
{
  "imports": {
    "#/*": {
      "development": "./src/*.ts",
      "default": "./dist/*.js"
    }
  }
}
```

Add `customConditions: ["development"]` to shared TypeScript and Vitest resolution. Add the following root private import map for repository tests:

```json
{
  "imports": {
    "#test/*": "./tests/*.ts"
  }
}
```

Use imports such as `#test/helpers/local-runtime` and `#test/e2e/fixtures/synaploom-cli` in test sources. Export every consumed symbol from the package root `src/index.ts`; do not introduce public subpaths solely to avoid maintaining the root contract.

- [ ] **Step 4: Verify import boundaries and runtime behavior**

```bash
pnpm vitest run tests/architecture/import-boundaries.spec.ts
pnpm test
pnpm build
```

Expected: no authored relative source imports remain in `apps` or `packages`; all existing behavior passes.

- [ ] **Step 5: Commit package-boundary imports**

```bash
git add apps packages tests/architecture/import-boundaries.spec.ts pnpm-lock.yaml
git commit -m "refactor: enforce Synaploom package boundaries"
```

---

# Slice 3 — Strict TypeScript and Standard Test Pipeline

### Task 6: Add project references and declaration-emitting package builds

**Files:**

- Modify: `tsconfig.json`
- Create: `apps/*/tsconfig.json`
- Create: `packages/*/tsconfig.json`
- Create: `packages/*/tsconfig.build.json`
- Modify: package scripts for every app and package
- Create: `tests/architecture/project-references.spec.ts`

**Interfaces:**

- Consumes: public package imports and private aliases.
- Produces: `pnpm typecheck` through `tsc -b`, reusable package declarations under `dist`, and explicit dependency order through TypeScript references.

- [ ] **Step 1: Write the failing project-reference test**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface TsConfig {
  references?: Array<{ path: string }>;
  compilerOptions?: Record<string, unknown>;
}

async function config(filePath: string): Promise<TsConfig> {
  return JSON.parse(await readFile(filePath, 'utf8')) as TsConfig;
}

describe('TypeScript project references', () => {
  it('uses strict composite builds for reusable packages', async () => {
    const root = await config('tsconfig.json');
    const contracts = await config('packages/contracts/tsconfig.build.json');

    expect(root.references?.some((entry) => entry.path === './packages/contracts')).toBe(true);
    expect(contracts.compilerOptions).toMatchObject({
      composite: true,
      declaration: true,
      declarationMap: true,
      outDir: './dist',
      rootDir: './src',
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm missing reference configs**

```bash
pnpm vitest run tests/architecture/project-references.spec.ts
```

Expected: FAIL because package build configs do not exist.

- [ ] **Step 3: Add shared composite build configuration and references**

Create reusable package `tsconfig.build.json` files using this shape:

```json
{
  "extends": "@synaploom/typescript-config/node.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

Create a source/test `tsconfig.json` per package:

```json
{
  "extends": "@synaploom/typescript-config/node.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

The root `tsconfig.json` contains `files: []` and references every reusable package build project in dependency order: contracts, security, course-schema, lesson-renderer, local-database, course-loader, course-validator, course-importer, progression, workspace-manager, and exercise-runner. Each package `tsconfig.build.json` declares `references` for its direct workspace dependencies using the package matrix from Task 3; for example, progression references `../contracts` and `../local-database`. Each app owns a no-emit `tsconfig.json` that references its direct package dependencies but is not itself referenced by the root build solution.

Add package scripts:

```json
{
  "build": "tsc -b tsconfig.build.json",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\""
}
```

Change the root scripts to:

```json
{
  "clean": "pnpm -r clean",
  "typecheck": "tsc -b --pretty false && pnpm -r --filter './apps/**' typecheck",
  "build:packages": "pnpm -r --filter './packages/**' build"
}
```

- [ ] **Step 4: Run strict type checks and fix every reported error without weakening flags**

```bash
pnpm typecheck
pnpm build:packages
pnpm vitest run tests/architecture/project-references.spec.ts
```

Expected: zero TypeScript diagnostics and declaration files for all reusable packages.

- [ ] **Step 5: Commit strict TypeScript project references**

```bash
git add tsconfig.json apps packages tests/architecture/project-references.spec.ts package.json pnpm-lock.yaml
git commit -m "build: add strict TypeScript project references"
```

### Task 7: Replace handwritten test orchestration with Vitest projects

**Files:**

- Create: `vitest.config.ts`
- Modify: all existing `*.test.ts` and `*.spec.ts` tests from `node:test` to Vitest
- Delete after parity: `scripts/test.mjs`
- Modify: `package.json`
- Create: `tests/architecture/test-runner-parity.spec.ts`

**Interfaces:**

- Consumes: strict TypeScript configs.
- Produces: one standard test command with Node and DOM projects, deterministic coverage discovery, and no manual filesystem walk.

- [ ] **Step 1: Add a parity test that asserts the standard runner discovers all suites**

```ts
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function countTests(root: string): Promise<number> {
  let count = 0;
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory() && !['dist', 'node_modules'].includes(entry.name))
        await visit(target);
      if (entry.isFile() && /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) count += 1;
    }
  }
  await visit(root);
  return count;
}

describe('Vitest discovery', () => {
  it('keeps every repository test suite visible to the workspace runner', async () => {
    const expected = await countTests('.');
    expect(expected).toBeGreaterThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Create the Vitest project configuration and run it before converting tests**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'apps/**/*.test.ts',
            'packages/**/*.test.ts',
            'tests/{architecture,integration,security,tooling}/**/*.{test,spec}.ts',
          ],
          exclude: ['apps/web/**/*.test.tsx', 'packages/ui/**/*.test.tsx'],
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          setupFiles: ['@synaploom/test-config/setup-dom'],
          include: ['apps/web/**/*.{test,spec}.tsx', 'packages/ui/**/*.{test,spec}.tsx'],
        },
      },
    ],
  },
});
```

Run:

```bash
pnpm exec vitest run
```

Expected: FAIL on suites still importing `node:test`, establishing the conversion boundary.

- [ ] **Step 3: Convert tests mechanically and preserve behavior assertions**

Replace:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
```

with:

```ts
import { describe, expect, it } from 'vitest';
```

Translate `assert.equal(actual, expected)` to `expect(actual).toBe(expected)`, `assert.deepEqual` to `expect(...).toEqual(...)`, `assert.rejects` to `await expect(...).rejects`, and named `test()` calls to `it()` inside focused `describe()` groups. Do not weaken security or progression assertions.

Add exact dev dependencies:

```json
{
  "@testing-library/jest-dom": "6.9.1",
  "happy-dom": "20.10.6",
  "vitest": "4.1.10"
}
```

Replace root test scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Delete `scripts/test.mjs` only after every converted suite is green.

- [ ] **Step 4: Verify test parity and packed CLI regression coverage**

```bash
pnpm test
pnpm vitest run tests/architecture/test-runner-parity.spec.ts
pnpm build
```

Expected: all previously existing tests run under Vitest and the suite count does not decrease.

- [ ] **Step 5: Commit the standard test pipeline**

```bash
git add vitest.config.ts apps packages tests package.json pnpm-lock.yaml scripts/test.mjs
git commit -m "test: migrate repository suites to Vitest"
```

### Task 8: Separate real type checking from Node type-strip portability

**Files:**

- Move: `scripts/typecheck.mjs` → `scripts/check-type-strip.mjs`
- Modify: `tests/typecheck-script.spec.ts` → `tests/tooling/type-strip-compatibility.spec.ts`
- Modify: `package.json`
- Create: `tests/tooling/strict-typecheck.spec.ts`

**Interfaces:**

- Consumes: TypeScript project references and Vitest.
- Produces: `pnpm typecheck` as compiler validation and `pnpm check:type-strip` as an independent Node runtime portability check.

- [ ] **Step 1: Add a regression test proving type errors fail the compiler gate**

```ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runTsc(project: string) {
  return spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', project], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

describe('strict typecheck', () => {
  it('rejects semantically invalid TypeScript that can still be type-stripped', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-typecheck-'));
    await writeFile(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true },
        files: ['invalid.ts'],
      }),
    );
    await writeFile(path.join(root, 'invalid.ts'), "const count: number = 'invalid';\n");

    const result = runTsc(path.join(root, 'tsconfig.json'));

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      "Type 'string' is not assignable to type 'number'",
    );
  });
});
```

- [ ] **Step 2: Run the test and verify the current `typecheck` script does not satisfy it**

```bash
pnpm vitest run tests/tooling/strict-typecheck.spec.ts
```

Expected: FAIL until the test invokes the local TypeScript compiler reliably and root `typecheck` uses `tsc -b`.

- [ ] **Step 3: Rename the portability script and update exact commands**

Rename the script:

```bash
git mv scripts/typecheck.mjs scripts/check-type-strip.mjs
```

Set root scripts:

```json
{
  "typecheck": "tsc -b --pretty false && pnpm -r --filter './apps/**' typecheck",
  "check:type-strip": "node scripts/check-type-strip.mjs",
  "verify:fast": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm check:type-strip && pnpm test && pnpm build"
}
```

Keep `stripTypeScriptTypes(source, { mode: 'strip' })` only in `check-type-strip.mjs`. Rename its success output to:

```text
Node type-strip compatibility checked for the reported TypeScript file count.
```

Update the existing portability test to assert that the script does not call `npm root -g`, does not import a global TypeScript installation, and does not use the removed `transform` mode.

- [ ] **Step 4: Run all static gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:type-strip
pnpm test
```

Expected: all commands pass with zero warnings.

- [ ] **Step 5: Commit strict type checking**

```bash
git add scripts tests/tooling package.json pnpm-lock.yaml
git commit -m "build: separate type checking from type-strip portability"
```

---

# Slice 4 — Typed Protocol and React/Vite Shell

### Task 9: Create typed local protocol contracts and make daemon payloads conform

**Files:**

- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/tsconfig.build.json`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/src/index.test.ts`
- Modify: `apps/daemon/src/routes/courses.ts`
- Modify: `apps/daemon/src/routes/lessons.ts`
- Modify: `apps/daemon/src/create-server.ts`
- Modify: `apps/daemon/package.json`

**Interfaces:**

- Consumes: domain contracts and current daemon JSON shapes.
- Produces: `CoursePayload`, `LessonPayload`, `WorkspaceFilePayload`, `ProcessSessionPayload`, `CompletionPayload`, `ApiErrorPayload`, and typed process events for the web client.

- [ ] **Step 1: Write contract tests for daemon payloads**

```ts
import { describe, expect, it } from 'vitest';
import { isApiErrorPayload, type CoursePayload, type LegacyLessonPayload } from '#/index';

describe('local protocol contracts', () => {
  it('models the daemon-authoritative course and lesson payloads', () => {
    const course: CoursePayload = {
      id: 'frontend-performance-foundations',
      title: 'Frontend Performance Foundations',
      description: 'Local course',
      version: '1.0.0',
      currentLessonId: 'main-thread',
      completedAt: null,
      lessons: [],
    };
    const lesson: LegacyLessonPayload = {
      id: 'main-thread',
      title: 'Main Thread',
      position: 1,
      type: 'theory',
      estimatedMinutes: 12,
      renderedHtml: '<h1>Main Thread</h1>',
      status: 'AVAILABLE',
      readingAcknowledged: false,
      latestCheck: null,
      exercise: null,
    };

    expect(course.currentLessonId).toBe('main-thread');
    expect(lesson.status).toBe('AVAILABLE');
    expect(isApiErrorPayload({ code: 'LESSON_LOCKED', message: 'locked' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm the protocol package is missing**

```bash
pnpm vitest run packages/protocol/src/index.test.ts
```

Expected: FAIL because `@synaploom/protocol` and its exports do not exist.

- [ ] **Step 3: Implement protocol types and type daemon builders explicitly**

Create `packages/protocol/src/index.ts` with TSDoc and these public contracts:

```ts
import type { CheckResult, LessonStatus, LessonType, ProcessEvent } from '@synaploom/contracts';

export interface CourseLessonSummary {
  readonly id: string;
  readonly position: number;
  readonly title: string;
  readonly type: LessonType;
  readonly estimatedMinutes: number | null;
  readonly status: LessonStatus;
}

export interface CoursePayload {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly currentLessonId: string | null;
  readonly completedAt: string | null;
  readonly lessons: readonly CourseLessonSummary[];
}

export interface LegacyLessonPayload {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly type: LessonType;
  readonly estimatedMinutes: number | null;
  readonly renderedHtml: string;
  readonly status: LessonStatus;
  readonly readingAcknowledged: boolean;
  readonly latestCheck: { readonly checks: readonly CheckResult[] } | null;
  readonly exercise: {
    readonly id: string;
    readonly title: string;
    readonly editable: readonly string[];
    readonly actions: readonly {
      readonly id: string;
      readonly label: string;
    }[];
    readonly checks: readonly {
      readonly id: string;
      readonly title: string;
      readonly required: boolean;
    }[];
  } | null;
}

export type LessonPayload = LegacyLessonPayload;

export interface CompletionPayload {
  readonly completed: true;
  readonly courseCompleted: boolean;
  readonly nextLesson: { readonly id: string; readonly title: string } | null;
}

export interface WorkspaceFilePayload {
  readonly path: string;
  readonly content: string;
}

export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly currentLessonId?: string;
}

export interface ProcessSessionPayload {
  readonly sessionId: string;
  readonly eventsUrl: string;
}

export interface ProcessEvents {
  readonly event: ProcessEvent;
}

/** Returns true only for JSON objects that satisfy the local API error contract. */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}
```

Change `coursePayload()` and `lessonPayload()` return types from `Record<string, unknown>` to `CoursePayload` and `LegacyLessonPayload`. Task 14 replaces `LegacyLessonPayload.renderedHtml` with the final `LessonPayload.blocks` contract and deletes the legacy type in the same commit.

- [ ] **Step 4: Verify daemon contract tests and existing APIs**

```bash
pnpm vitest run packages/protocol/src/index.test.ts apps/daemon/src/create-server.test.ts
pnpm typecheck
pnpm test
```

Expected: protocol and daemon tests pass without `as any` casts.

- [ ] **Step 5: Commit typed protocol contracts**

```bash
git add packages/protocol apps/daemon package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat: define typed local daemon protocol"
```

### Task 10: Create the React 19.2 and Vite application shell

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/providers/AppProviders.tsx`
- Create: `apps/web/src/app/router/AppRouter.tsx`
- Create: `apps/web/src/shared/api/api-client.ts`
- Create: `apps/web/src/shared/api/query-client.ts`
- Create: `apps/web/src/shared/lib/routes.ts`
- Create: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/index.html`

**Interfaces:**

- Consumes: `@synaploom/protocol` and the current local daemon endpoints.
- Produces: React entry point, TanStack Query provider, browser route parsing, typed API client, and a behavior-compatible shell that can load the current course and lesson.

- [ ] **Step 1: Write the failing React shell test**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '#/app/App';
import { createApiClient } from '#/shared/api/api-client';

const course = {
  id: 'frontend-performance-foundations',
  title: 'Frontend Performance Foundations',
  description: 'Course',
  version: '1.0.0',
  currentLessonId: 'main-thread',
  completedAt: null,
  lessons: [],
};

it('loads the current course through the typed API client', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(course), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  const client = createApiClient(fetchImpl);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <App api={client} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('Frontend Performance Foundations')).toBeVisible();
});
```

- [ ] **Step 2: Install React/Vite dependencies and verify the shell test fails**

Add exact dependencies to `apps/web/package.json`:

```json
{
  "dependencies": {
    "@synaploom/contracts": "workspace:*",
    "@synaploom/protocol": "workspace:*",
    "@tanstack/react-query": "5.101.2",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "vite": "8.1.4"
  }
}
```

Run:

```bash
pnpm install
pnpm vitest run apps/web/src/app/App.test.tsx
```

Expected: FAIL because the React shell files do not exist.

- [ ] **Step 3: Implement the minimal React application shell**

Create `apps/web/src/shared/api/api-client.ts` with a generic typed request helper and methods matching the daemon endpoints. The public shape is:

```ts
export interface SynaploomApiClient {
  getCourse(): Promise<CoursePayload>;
  getCurrentLesson(): Promise<LessonPayload>;
  getLesson(lessonId: string): Promise<LessonPayload>;
  startLesson(lessonId: string): Promise<{ readonly started: true }>;
  markReadingComplete(lessonId: string): Promise<{ readonly readingAcknowledged: true }>;
  completeLesson(lessonId: string): Promise<CompletionPayload>;
  listFiles(lessonId: string): Promise<{ readonly files: readonly string[] }>;
  readFile(lessonId: string, filePath: string): Promise<WorkspaceFilePayload>;
  writeFile(lessonId: string, filePath: string, content: string): Promise<{ readonly saved: true }>;
  resetWorkspace(lessonId: string): Promise<{ readonly reset: true }>;
  runAction(lessonId: string, actionId: string): Promise<ProcessSessionPayload>;
  getPaneRatio(): Promise<{ readonly ratio: number }>;
  setPaneRatio(ratio: number): Promise<{ readonly ratio: number }>;
}
```

Create `AppProviders.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { queryClient } from '#/shared/api/query-client';

/** Installs application-wide client-side providers. */
export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Create `App.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import type { SynaploomApiClient } from '#/shared/api/api-client';

export interface AppProps {
  readonly api: SynaploomApiClient;
}

/** Loads the active local course and delegates focused learning rendering. */
export function App({ api }: AppProps) {
  const course = useQuery({
    queryKey: ['course'],
    queryFn: () => api.getCourse(),
  });

  if (course.isPending) return <main aria-busy="true">Đang tải khóa học…</main>;
  if (course.isError) return <main role="alert">Không thể tải khóa học local.</main>;
  return (
    <main>
      <h1>{course.data.title}</h1>
    </main>
  );
}
```

Create `main.tsx` with `createRoot`, update `index.html` to contain `<div id="root"></div>`, and configure Vite with React and `#` alias resolution.

- [ ] **Step 4: Verify React tests and production build**

```bash
pnpm vitest run apps/web/src/app/App.test.tsx
pnpm --filter @synaploom/web build
pnpm typecheck
```

Expected: the React shell test passes and `apps/web/dist` contains hashed JavaScript and CSS assets.

- [ ] **Step 5: Commit the React/Vite shell**

```bash
git add apps/web package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat: add React and Vite application shell"
```

### Task 11: Serve Vite assets in production and proxy the daemon in development

**Files:**

- Modify: `apps/daemon/src/create-server.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/types.ts`
- Create: `apps/web/src/shared/api/api-client.integration.test.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/daemon/src/create-server.test.ts`

**Interfaces:**

- Consumes: Vite build output and typed API client.
- Produces: production static asset serving from `apps/web/dist`, development API/SSE proxy to the daemon, and SPA fallback without weakening root-path validation.

- [ ] **Step 1: Add failing tests for hashed assets and SPA fallback**

Extend `apps/daemon/src/create-server.test.ts`:

```ts
it('serves Vite assets and falls back to index.html for application routes', async () => {
  const fixture = await createFixture();
  const index = await fetch(`${fixture.origin}/`);
  const route = await fetch(`${fixture.origin}/courses/course/lessons/lesson-1`);

  expect(index.status).toBe(200);
  expect(index.headers.get('content-type')).toContain('text/html');
  expect(route.status).toBe(200);
  expect(await route.text()).toContain('<div id="root"></div>');

  await fixture.runtime.close();
});
```

- [ ] **Step 2: Run the daemon test and confirm the old copied web root fails parity**

```bash
pnpm vitest run apps/daemon/src/create-server.test.ts
```

Expected: FAIL until the fixture uses Vite output and SPA paths resolve to the new index.

- [ ] **Step 3: Implement production and development integration**

Set Vite proxy rules:

```ts
server: {
  proxy: {
    '/api': {
      target: process.env.SYNAPLOOM_DAEMON_ORIGIN ?? 'http://127.0.0.1:4174',
      changeOrigin: false,
    },
    '/bootstrap': {
      target: process.env.SYNAPLOOM_DAEMON_ORIGIN ?? 'http://127.0.0.1:4174',
      changeOrigin: false,
    },
  },
},
```

Retain daemon static-file protection through `resolveInsideRoot`. Extend `contentType()` for `.mjs`, `.woff2`, `.png`, and `.webp`. Use `apps/web/dist` as `webRoot` in built development fixtures and CLI startup. Do not serve source files.

- [ ] **Step 4: Run daemon, web build, and current E2E regression**

```bash
pnpm --filter @synaploom/web build
pnpm vitest run apps/daemon/src/create-server.test.ts apps/web/src/shared/api/api-client.integration.test.ts
pnpm test
pnpm build
```

Expected: HTML, CSS, JavaScript, and API endpoints remain HTTP 200 and the existing course flow is unchanged.

- [ ] **Step 5: Commit Vite/daemon integration**

```bash
git add apps/daemon apps/cli apps/web
git commit -m "feat: serve React application from local daemon"
```

---

# Slice 5 — Synaploom Design System

### Task 12: Build design tokens and accessible primitive components

**Files:**

- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tsconfig.build.json`
- Create: `packages/ui/src/foundations/tokens.css`
- Create: `packages/ui/src/foundations/reset.css`
- Create: `packages/ui/src/foundations/typography.css`
- Create: `packages/ui/src/primitives/button/Button.tsx`
- Create: `packages/ui/src/primitives/button/Button.test.tsx`
- Create: `packages/ui/src/primitives/input/Input.tsx`
- Create: `packages/ui/src/primitives/input/Input.test.tsx`
- Create: `packages/ui/src/primitives/tabs/Tabs.tsx`
- Create: `packages/ui/src/primitives/tooltip/Tooltip.tsx`
- Create: `packages/ui/src/primitives/scroll-area/ScrollArea.tsx`
- Create: `packages/ui/src/primitives/separator/Separator.tsx`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/styles.css`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/package.json`

**Interfaces:**

- Consumes: React, Radix, Tailwind, CVA, Lucide, shared React TypeScript config.
- Produces: semantic tokens and product-owned primitive APIs used by feature code.

- [ ] **Step 1: Write failing accessibility and variant tests for Button and Input**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '#/primitives/button/Button';
import { Input } from '#/primitives/input/Input';

describe('Button', () => {
  it('exposes loading state without allowing duplicate activation', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Nộp bài
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Nộp bài' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Input', () => {
  it('associates label, description, and error text', () => {
    render(<Input label="Câu hỏi" description="Tối đa 500 ký tự" error="Bắt buộc" />);
    expect(screen.getByRole('textbox', { name: 'Câu hỏi' })).toHaveAccessibleDescription(
      'Tối đa 500 ký tự Bắt buộc',
    );
  });
});
```

- [ ] **Step 2: Install exact UI dependencies and verify tests fail**

Add to `packages/ui/package.json`:

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "1.1.19",
    "@radix-ui/react-scroll-area": "1.2.14",
    "@radix-ui/react-separator": "1.1.11",
    "@radix-ui/react-slot": "1.3.0",
    "@radix-ui/react-tabs": "1.1.17",
    "@radix-ui/react-tooltip": "1.2.12",
    "class-variance-authority": "0.7.1",
    "lucide-react": "1.24.0"
  },
  "peerDependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "react": "19.2.7",
    "react-dom": "19.2.7"
  }
}
```

Add these development dependencies to `apps/web/package.json`:

```json
{
  "@tailwindcss/vite": "4.3.2",
  "tailwindcss": "4.3.2"
}
```

Add `tailwindcss()` to the Vite plugin list. Create `packages/ui/src/styles.css` to import foundations, and create `apps/web/src/styles.css`:

```css
@import 'tailwindcss';
@source '../../../packages/ui/src';
@import '@synaploom/ui/styles.css';
```

Export `./styles.css` from `@synaploom/ui`. Then run:

```bash
pnpm install
pnpm vitest run packages/ui/src/primitives/button/Button.test.tsx packages/ui/src/primitives/input/Input.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement tokens and primitives with product-owned APIs**

Create `tokens.css` using the approved `--syn-*` variables from the specification. Implement `Button` using CVA and Radix Slot with this public API:

```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly size?: 'sm' | 'md' | 'lg';
  readonly loading?: boolean;
  readonly asChild?: boolean;
}
```

Implement `Input` with generated IDs through `useId()`, combined `aria-describedby`, visible focus, and semantic error state. Wrap Radix primitives behind named Synaploom exports for Tabs, Tooltip, ScrollArea, Separator, and Dialog. Feature code must never import Radix directly.

- [ ] **Step 4: Verify UI accessibility contracts and build output**

```bash
pnpm vitest run packages/ui
pnpm --filter @synaploom/ui typecheck
pnpm --filter @synaploom/ui build
pnpm lint
```

Expected: keyboard, accessible name, disabled, loading, and variant tests pass with zero lint warnings.

- [ ] **Step 5: Commit design-system primitives**

```bash
git add packages/ui package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat: add Synaploom design system primitives"
```

### Task 13: Build focused-workspace design-system components and development showcase

**Files:**

- Create: `packages/ui/src/components/app-header/AppHeader.tsx`
- Create: `packages/ui/src/components/lesson-progress/LessonProgress.tsx`
- Create: `packages/ui/src/components/status-badge/StatusBadge.tsx`
- Create: `packages/ui/src/components/action-bar/ActionBar.tsx`
- Create: `packages/ui/src/components/terminal-shell/TerminalShell.tsx`
- Create: `packages/ui/src/components/assistant-dock/AssistantDock.tsx`
- Create: `packages/ui/src/components/workspace-shell/WorkspaceShell.tsx`
- Create: corresponding `*.test.tsx` files
- Create: `apps/web/src/app/showcase/DesignSystemShowcase.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: Task 12 primitives and React Resizable Panels.
- Produces: stable product layout components and a development-only showcase route.

- [ ] **Step 1: Write failing workspace shell interaction tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceShell } from '#/components/workspace-shell/WorkspaceShell';

it('clamps persisted lesson pane ratios to the approved range', async () => {
  const user = userEvent.setup();
  const onRatioChange = vi.fn();
  render(
    <WorkspaceShell
      lesson={<div>Lesson</div>}
      practice={<div>Practice</div>}
      assistant={<div>Assistant</div>}
      lessonRatio={0.9}
      onLessonRatioChange={onRatioChange}
    />,
  );

  expect(screen.getByText('Lesson').closest('[data-pane="lesson"]')).toHaveStyle({
    flexBasis: '68%',
  });
  const separator = screen.getByRole('separator');
  separator.focus();
  await user.keyboard('{ArrowLeft}');
  expect(onRatioChange).toHaveBeenCalled();
});
```

- [ ] **Step 2: Add React Resizable Panels and verify component tests fail**

Add `react-resizable-panels: 4.12.2` to `@synaploom/ui` dependencies, then run:

```bash
pnpm install
pnpm vitest run packages/ui/src/components
```

Expected: FAIL because the product layout components are absent.

- [ ] **Step 3: Implement the product components and development-only route**

`WorkspaceShell` owns the 32–68 percent clamp, keyboard-operable separator, independent scroll regions, and persistent bottom action region. `StatusBadge` supports `locked`, `available`, `in-progress`, `passed`, `failed`, and `neutral`. `TerminalShell` exposes an accessible output region using `role="log"` and `aria-live="polite"`. `AssistantDock` accepts provider state but contains no provider SDK.

Register `/__design-system` only when `import.meta.env.DEV` is true:

```tsx
if (import.meta.env.DEV && location.pathname === '/__design-system') {
  return <DesignSystemShowcase />;
}
```

The showcase renders every component state using semantic tokens and contains no course logic.

- [ ] **Step 4: Run design-system, web, and accessibility tests**

```bash
pnpm vitest run packages/ui apps/web/src/app/showcase
pnpm --filter @synaploom/ui build
pnpm --filter @synaploom/web build
pnpm lint
```

Expected: component tests pass, the development route builds, and production code tree-shakes showcase-only content.

- [ ] **Step 5: Commit workspace components**

```bash
git add packages/ui apps/web package.json pnpm-lock.yaml
git commit -m "feat: add focused workspace design components"
```

---

# Slice 6 — Safe Lesson Model and React Learning Workspace

### Task 14: Replace HTML-string lesson rendering with a typed lesson document

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Replace: `packages/lesson-renderer/src/index.ts`
- Replace: `packages/lesson-renderer/src/index.test.ts`
- Modify: `packages/course-loader/src/index.ts`
- Modify: `apps/daemon/src/routes/lessons.ts`
- Modify: `packages/protocol/src/index.ts`
- Remove after migration: `NormalizedLesson.renderedHtml`

**Interfaces:**

- Consumes: existing Markdown course files.
- Produces: `LessonBlock[]`, `parseLessonMarkdown(markdown, context)`, safe link and local image validation, and daemon payloads containing typed blocks only.

- [ ] **Step 1: Write failing typed-block and malicious-content tests**

````ts
import { describe, expect, it } from 'vitest';
import { parseLessonMarkdown } from '#/index';

it('parses supported Markdown into typed blocks', () => {
  expect(
    parseLessonMarkdown('# Event Loop\n\n- Task queue\n- Microtask queue\n\n```js\nalert(1)\n```'),
  ).toEqual([
    { type: 'heading', level: 1, text: 'Event Loop' },
    { type: 'list', ordered: false, items: ['Task queue', 'Microtask queue'] },
    { type: 'code', language: 'js', code: 'alert(1)' },
  ]);
});

it('does not preserve raw HTML or unsafe links', () => {
  const blocks = parseLessonMarkdown(
    '<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n[safe](https://example.com)',
  );

  expect(blocks.map((block) => block.type)).not.toContain('html');
  expect(JSON.stringify(blocks)).not.toContain('\"href\":\"javascript:');
  expect(blocks).toContainEqual({
    type: 'paragraph',
    children: [{ type: 'text', value: '<script>alert(1)</script>' }],
  });
});
````

- [ ] **Step 2: Run lesson-renderer tests and verify the HTML renderer fails the contract**

```bash
pnpm vitest run packages/lesson-renderer/src/index.test.ts
```

Expected: FAIL because the package returns HTML strings instead of typed blocks.

- [ ] **Step 3: Define and implement the safe typed model**

Add discriminated unions to `@synaploom/contracts`:

```ts
export type InlineContent =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'code'; readonly value: string }
  | { readonly type: 'strong'; readonly children: readonly InlineContent[] }
  | {
      readonly type: 'link';
      readonly href: string;
      readonly children: readonly InlineContent[];
    };

export type LessonBlock =
  | {
      readonly type: 'heading';
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly text: string;
    }
  | { readonly type: 'paragraph'; readonly children: readonly InlineContent[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly string[];
    }
  | { readonly type: 'code'; readonly language: string; readonly code: string }
  | {
      readonly type: 'callout';
      readonly kind: 'note' | 'hint' | 'warning';
      readonly children: readonly InlineContent[];
    }
  | { readonly type: 'image'; readonly source: string; readonly alt: string }
  | { readonly type: 'assignment'; readonly steps: readonly string[] };
```

Implement `parseLessonMarkdown` as a deterministic parser for the approved MVP syntax. Treat raw HTML as text. Accept only `https:`, `http:`, `mailto:`, `#`, and validated course-relative links. Course-relative images are validated through `@synaploom/security` before reaching the daemon payload.

Replace `NormalizedLesson.renderedHtml` with `blocks: readonly LessonBlock[]`. Rename `LegacyLessonPayload` to `LessonPayload`, replace its `renderedHtml` field with `blocks`, and update loader, daemon, protocol, and tests atomically. Delete `renderLessonMarkdown` after all consumers migrate.

- [ ] **Step 4: Verify parser safety and daemon payloads**

```bash
pnpm vitest run packages/lesson-renderer packages/course-loader apps/daemon
pnpm typecheck
pnpm test
```

Expected: no HTML string field remains in the lesson protocol and malicious Markdown is represented only as inert text.

- [ ] **Step 5: Commit typed lesson rendering**

```bash
git add packages/contracts packages/lesson-renderer packages/course-loader packages/protocol apps/daemon
git commit -m "refactor: render lessons through typed safe blocks"
```

### Task 15: Implement the focused React learning workspace and preserve daemon authority

**Files:**

- Create: `apps/web/src/features/course-session/useCourseSession.ts`
- Create: `apps/web/src/features/lesson-content/LessonContent.tsx`
- Create: `apps/web/src/features/lesson-content/LessonContent.test.tsx`
- Create: `apps/web/src/features/practice-runner/PracticePanel.tsx`
- Create: `apps/web/src/features/practice-runner/useProcessEvents.ts`
- Create: `apps/web/src/features/progression/CompletionBar.tsx`
- Create: `apps/web/src/features/workspace-layout/LearningWorkspacePage.tsx`
- Replace: `apps/web/src/features/learning/LearningWorkspacePage.test.ts`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/router/AppRouter.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**

- Consumes: typed API client, typed lesson blocks, and `@synaploom/ui`.
- Produces: complete React implementation of the approved two-pane learning loop, SSE output, file editing, declared actions, completion, redirects for locked lessons, and persisted pane ratio.

- [ ] **Step 1: Write the failing primary-flow component test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LearningWorkspacePage } from '#/features/workspace-layout/LearningWorkspacePage';
import { createTestApi } from '#/shared/api/test-api';

it('runs a declared check and enables completion only after authoritative success', async () => {
  const user = userEvent.setup();
  const api = createTestApi({ latestCheck: null });
  render(<LearningWorkspacePage api={api} lessonId="event-loop" />);

  expect(await screen.findByRole('heading', { name: 'Event Loop' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Hoàn thành bài học' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Kiểm tra kết quả' }));
  api.emitProcess({
    type: 'process.exited',
    sessionId: 'session-1',
    lessonId: 'event-loop',
    timestamp: new Date().toISOString(),
    exitCode: 0,
    outputTruncated: false,
  });

  expect(await screen.findByText('Output đúng thứ tự')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Hoàn thành bài học' })).toBeEnabled();
});
```

- [ ] **Step 2: Run the focused test and confirm the React feature is absent**

```bash
pnpm vitest run apps/web/src/features/workspace-layout/LearningWorkspacePage.test.tsx
```

Expected: FAIL because the feature modules and test API do not exist.

- [ ] **Step 3: Implement feature modules with explicit state ownership**

Use TanStack Query keys:

```ts
export const courseQueryKey = ['course'] as const;
export const lessonQueryKey = (lessonId: string) => ['lesson', lessonId] as const;
export const workspaceFileQueryKey = (lessonId: string, filePath: string) =>
  ['workspace-file', lessonId, filePath] as const;
```

`useCourseSession` loads course and current lesson, calls `startLesson`, redirects `LESSON_LOCKED` responses to the daemon-provided `currentLessonId`, and invalidates course/lesson queries after completion. `useProcessEvents` owns EventSource lifecycle and reconnect state; it closes streams on terminal events and route changes. `PracticePanel` sends action IDs only and renders output through `TerminalShell`. `CompletionBar` derives button availability from daemon-returned `readingAcknowledged` and `latestCheck`, never from optimistic local checks.

Render each `LessonBlock` through typed React components with exhaustive `switch` handling. Do not use `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run React, daemon, security, and package tests**

```bash
pnpm vitest run apps/web packages/ui apps/daemon tests/security
pnpm typecheck
pnpm lint
pnpm build
```

Expected: the complete learning workspace renders through React, security tests remain green, and Vite assets build successfully.

- [ ] **Step 5: Commit the React learning workspace**

```bash
git add apps/web packages/ui
git commit -m "feat: migrate focused learning workspace to React"
```

### Task 16: Remove the handwritten DOM renderer and add browser-level Playwright parity

**Files:**

- Delete: `apps/web/src/app.js`
- Delete: `apps/web/src/app-state.js`
- Delete: `apps/web/src/api-client.js`
- Delete: legacy `apps/web/src/styles.css` after token migration
- Create: `playwright.config.ts`
- Replace: `tests/e2e/linear-course.spec.ts` with Playwright browser flow
- Create: `tests/e2e/fixtures/synaploom-cli.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: completed React workspace and local CLI lifecycle.
- Produces: one browser-renderer implementation and end-to-end proof of the full learner flow.

- [ ] **Step 1: Write the Playwright linear-course flow**

```ts
import { expect, test } from '@playwright/test';
import { startSynaploomFixture } from '#test/e2e/fixtures/synaploom-cli';

test('learns in strict order and persists progress after restart', async ({ page }) => {
  const fixture = await startSynaploomFixture();
  await page.goto(fixture.bootstrapUrl);

  await expect(page.getByRole('heading', { name: 'Main Thread' })).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn thành phần đọc' }).click();
  await page.getByRole('button', { name: 'Hoàn thành bài học' }).click();
  await page.getByRole('button', { name: 'Bài tiếp theo' }).click();

  await expect(page.getByRole('heading', { name: 'Event Loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra kết quả' }).click();
  await expect(page.getByText('Output đúng thứ tự')).toBeVisible();

  const restarted = await fixture.restart();
  await page.goto(restarted.bootstrapUrl);
  await expect(page.getByRole('heading', { name: 'Event Loop' })).toBeVisible();
  await fixture.stop();
});
```

- [ ] **Step 2: Install Playwright and run the browser test before removing legacy files**

Add `@playwright/test: 1.61.1`, run `pnpm exec playwright install chromium`, then:

```bash
pnpm playwright test tests/e2e/linear-course.spec.ts
```

Expected: FAIL until the fixture and React selectors are complete.

- [ ] **Step 3: Implement the CLI fixture, pass E2E, then delete legacy DOM files**

The fixture must create a temporary `SYNAPLOOM_HOME`, import the example course through the built CLI, capture the printed bootstrap URL, expose `restart()` and `stop()`, and require clean exit code `0` on `SIGINT`.

After Playwright passes, delete the DOM renderer files and remove every reference from Vite, package manifests, and packaging scripts. Add an architecture assertion that no `document.createElement`, `replaceChildren`, or direct `innerHTML` assignment exists under `apps/web/src`.

- [ ] **Step 4: Run browser parity and full verification**

```bash
pnpm test:e2e
pnpm verify:fast
```

Expected: Playwright passes the real browser flow and repository verification remains green without legacy DOM sources.

- [ ] **Step 5: Commit React parity and legacy removal**

```bash
git add apps/web tests/e2e playwright.config.ts package.json pnpm-lock.yaml
git commit -m "test: verify React learner flow in a real browser"
```

---

# Slice 7 — Optional AI Extension Boundary

### Task 17: Add provider-neutral AI contracts, disabled provider, and assistant dock states

**Files:**

- Create: `packages/ai-contracts/package.json`
- Create: `packages/ai-contracts/tsconfig.json`
- Create: `packages/ai-contracts/tsconfig.build.json`
- Create: `packages/ai-contracts/src/index.ts`
- Create: `packages/ai-contracts/src/disabled-provider.ts`
- Create: `packages/ai-contracts/src/disabled-provider.test.ts`
- Modify: `apps/daemon/src/context.ts`
- Create: `apps/daemon/src/routes/ai.ts`
- Modify: `apps/daemon/src/create-server.ts`
- Create: `apps/web/src/features/ai-assistant/AssistantPanel.tsx`
- Create: `apps/web/src/features/ai-assistant/AssistantPanel.test.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**

- Consumes: active lesson context and design-system `AssistantDock`.
- Produces: `AiProvider`, `AiRequest`, `AiResponse`, `DisabledAiProvider`, daemon-only provider composition, and UI states that keep course playback complete when AI is disabled.

- [ ] **Step 1: Write failing provider-boundary and disabled-state tests**

```ts
import { describe, expect, it } from 'vitest';
import { DisabledAiProvider } from '#/disabled-provider';

it('reports disabled status without performing generation', async () => {
  const provider = new DisabledAiProvider();
  expect(provider.id).toBe('disabled');
  await expect(
    provider.generate(
      {
        kind: 'hint',
        lessonId: 'event-loop',
        prompt: 'Help',
        context: { lessonText: '' },
      },
      new AbortController().signal,
    ),
  ).resolves.toEqual({
    status: 'disabled',
    message: 'AI assistance is not configured.',
  });
});
```

```tsx
it('keeps learning actions available when AI is disabled', () => {
  render(<AssistantPanel state={{ status: 'disabled' }} />);
  expect(screen.getByText('AI chưa được cấu hình')).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused tests and confirm the boundary is missing**

```bash
pnpm vitest run packages/ai-contracts apps/web/src/features/ai-assistant
```

Expected: FAIL because AI contracts and the React panel do not exist.

- [ ] **Step 3: Implement provider-neutral contracts and daemon-only configuration**

Define:

```ts
export type AiRequestKind = 'explain' | 'hint' | 'summarize' | 'explain-check-failure';

export interface AiRequest {
  readonly kind: AiRequestKind;
  readonly lessonId: string;
  readonly prompt: string;
  readonly context: {
    readonly lessonText: string;
    readonly selectedText?: string;
    readonly editableFiles?: readonly {
      readonly path: string;
      readonly content: string;
    }[];
    readonly latestCheckMessage?: string;
  };
}

export type AiResponse =
  | { readonly status: 'ok'; readonly content: string }
  | { readonly status: 'disabled'; readonly message: string };

export interface AiProvider {
  readonly id: string;
  generate(request: AiRequest, signal: AbortSignal): Promise<AiResponse>;
}
```

The daemon context receives `aiProvider: AiProvider`. The default composition uses `DisabledAiProvider`. Add a browser protocol command containing only `kind`, `prompt`, and optional `selectedText`; the web client cannot send `AiRequest.context`. Add `POST /api/ai/generate` with the existing session cookie, 64 KiB request limit, request validation, and daemon-generated minimal context from the active lesson, declared editable files, and latest check result. Never accept arbitrary filesystem paths, file contents outside the active workspace, context objects, or provider credentials from the browser.

The React panel exposes `Gợi ý`, `Giải thích`, and `Tóm tắt`; disabled state is informational and does not block lesson or practice actions.

- [ ] **Step 4: Run AI boundary, security, and offline-course tests**

```bash
pnpm vitest run packages/ai-contracts apps/daemon apps/web/src/features/ai-assistant tests/security
pnpm test:e2e
pnpm typecheck
```

Expected: AI-disabled course playback and completion remain fully functional.

- [ ] **Step 5: Commit the optional AI boundary**

```bash
git add packages/ai-contracts apps/daemon apps/web package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat: add optional provider-neutral AI boundary"
```

---

# Slice 8 — Self-Contained CLI Packaging

### Task 18: Bundle Synaploom CLI runtime and Vite assets without workspace dependencies

**Files:**

- Replace: `apps/cli/scripts/build.mjs`
- Delete after replacement: `apps/cli/scripts/copy-runtime-assets.mjs`
- Delete after replacement: `apps/cli/scripts/copy-web.mjs`
- Create: `apps/cli/tsup.config.ts`
- Create: `apps/cli/scripts/copy-package-assets.mjs`
- Create: `scripts/verify-packed-cli.mjs`
- Modify: `apps/cli/package.json`
- Modify: `package.json`
- Replace: `tests/integration/packed-cli.test.ts`

**Interfaces:**

- Consumes: built domain packages, daemon composition, Vite production assets, schemas, and migrations.
- Produces: `synaploom` tarball containing one executable runtime bundle plus static assets, with no pnpm or workspace package requirement on learner machines.

- [ ] **Step 1: Write failing packed-artifact assertions**

```ts
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';

it('installs the packed Synaploom CLI offline without internal dependencies', async () => {
  const prefix = await mkdtemp(path.join(os.tmpdir(), 'synaploom-packed-'));
  const packageJson = JSON.parse(await readFile('apps/cli/package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
  };

  expect(packageJson.dependencies ?? {}).toEqual({});
  const result = await run('pnpm', ['verify:package'], {
    env: { ...process.env, npm_config_offline: 'true' },
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('Packed Synaploom CLI verified');

  const files = await readdir(prefix);
  expect(files).not.toContain('pnpm-lock.yaml');
});
```

- [ ] **Step 2: Add tsup and run the packaging test against the old copied-source build**

Add `tsup: 8.5.1` and `esbuild: 0.28.1` to root dev dependencies, then run:

```bash
pnpm vitest run tests/integration/packed-cli.test.ts
```

Expected: FAIL because the CLI still copies repository runtime source and old web files.

- [ ] **Step 3: Implement one runtime bundle and explicit asset copy**

Create `apps/cli/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22.13',
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: [/^@synaploom\//],
});
```

After tsup completes, `copy-package-assets.mjs` must call `chmod('dist/index.js', 0o755)` and copy exactly:

```text
apps/web/dist/**                     → apps/cli/dist/web/**
packages/course-schema/schemas/**    → apps/cli/dist/schemas/**
packages/local-database/migrations/**→ apps/cli/dist/migrations/**
apps/cli/README.md                   → apps/cli/dist/README.md
```

Set `apps/cli/package.json`:

```json
{
  "name": "@synaploom/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "synaploom": "./dist/index.js" },
  "files": ["dist", "README.md"],
  "dependencies": {},
  "engines": { "node": ">=22.13.0" },
  "scripts": {
    "build": "tsup && node scripts/copy-package-assets.mjs",
    "pack:local": "pnpm pack --pack-destination ../../artifacts"
  }
}
```

`verify-packed-cli.mjs` must build all workspaces, pack the CLI, install it into an isolated prefix with `npm_config_offline=true`, run `synaploom doctor`, validate/import/start the example course, request HTML/CSS/JS/API endpoints, send `SIGINT`, require exit code `0`, scan the extracted package for absolute paths and `@synaploom/*` runtime imports, and print `Packed Synaploom CLI verified` only after every assertion passes.

- [ ] **Step 4: Run offline packaging and complete browser smoke tests**

```bash
pnpm build
pnpm verify:package
pnpm test:e2e
```

Expected: the tarball installs with no network, no pnpm, no repository checkout, no internal package dependencies, and serves the React UI successfully.

- [ ] **Step 5: Commit self-contained packaging**

```bash
git add apps/cli scripts/verify-packed-cli.mjs tests/integration/packed-cli.test.ts package.json pnpm-lock.yaml
git commit -m "build: package Synaploom as a self-contained CLI"
```

---

# Slice 9 — Cleanup, Documentation, and Release Gate

### Task 19: Remove superseded orchestration and enforce forbidden legacy artifacts

**Files:**

- Delete: `scripts/build.mjs`
- Delete: old copied CLI runtime under `apps/cli/dist/runtime` from Git if tracked
- Delete: root `nova-learn-cli-0.1.0.tgz`
- Delete or replace: `docs-design.md` and `docs-plan.md`
- Create: `tests/architecture/legacy-artifacts.spec.ts`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**

- Consumes: standard pnpm, TypeScript, Vitest, Vite, and tsup pipeline.
- Produces: repository-wide enforcement that legacy names, global-tool assumptions, handwritten DOM code, and copied-source packaging cannot return.

- [ ] **Step 1: Write the failing legacy-artifact scan**

```ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const forbidden = [
  '@nova-learn/',
  'nova-learn',
  'nova_session',
  '.nova-learn',
  'npm root -g',
  'document.createElement',
  'apps/cli/dist/runtime',
];

async function textFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'dist', 'artifacts'].includes(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      if (entry.isFile() && /\.(ts|tsx|js|mjs|json|md|yaml|yml|css)$/.test(entry.name))
        files.push(target);
    }
  }
  await visit(root);
  return files;
}

it('contains no legacy runtime or product artifacts outside migration documentation', async () => {
  const violations: string[] = [];
  for (const file of await textFiles('.')) {
    if (
      file.endsWith('migrate-legacy-home.ts') ||
      file.endsWith('migrate-legacy-home.test.ts') ||
      file.includes('docs/superpowers/specs/') ||
      file.includes('docs/superpowers/plans/')
    )
      continue;
    const source = await readFile(file, 'utf8');
    for (const token of forbidden) if (source.includes(token)) violations.push(`${file}: ${token}`);
  }
  expect(violations).toEqual([]);
});
```

- [ ] **Step 2: Run the scan and inspect every remaining legacy reference**

```bash
pnpm vitest run tests/architecture/legacy-artifacts.spec.ts
```

Expected: FAIL with old scripts, names, generated archives, or documentation references not explicitly allowed.

- [ ] **Step 3: Remove superseded files and tighten root scripts**

Delete handwritten orchestration replaced by pnpm/Vite/tsup. Set final root scripts:

```json
{
  "build": "pnpm -r build",
  "check:type-strip": "node scripts/check-type-strip.mjs",
  "clean": "pnpm -r clean && node -e \"require('node:fs').rmSync('artifacts',{recursive:true,force:true})\"",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -b --pretty false && pnpm -r --filter './apps/**' typecheck",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "verify:package": "node scripts/verify-packed-cli.mjs",
  "verify:fast": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm check:type-strip && pnpm test && pnpm build",
  "verify": "pnpm install --frozen-lockfile && pnpm verify:fast && pnpm test:e2e && pnpm verify:package"
}
```

Ignore `artifacts/`, `apps/*/dist/`, `packages/*/dist/`, and TypeScript build info. Do not ignore `pnpm-lock.yaml`.

- [ ] **Step 4: Verify the repository is free of legacy artifacts**

```bash
pnpm vitest run tests/architecture/legacy-artifacts.spec.ts
pnpm verify:fast
```

Expected: the scan and all fast gates pass.

- [ ] **Step 5: Commit cleanup enforcement**

```bash
git add -A
git commit -m "chore: remove superseded Nova Learn tooling"
```

### Task 20: Update user, contributor, authoring, security, and architecture documentation

**Files:**

- Replace: `README.md` or create it if absent
- Modify: `apps/cli/README.md`
- Modify: `docs/user/getting-started.md`
- Modify: `docs/course-authoring/course-format-v1.md`
- Modify: `docs/architecture/security-model.md`
- Create: `docs/architecture/monorepo-boundaries.md`
- Create: `docs/architecture/ai-privacy-boundary.md`
- Create: `docs/contributing/development.md`
- Create: `docs/releases/0.1.0-migration-checklist.md`
- Modify: example course README
- Create: `tests/architecture/documentation.spec.ts`

**Interfaces:**

- Consumes: final command names, package structure, design system, AI boundary, and packaging flow.
- Produces: complete contributor and learner guidance that matches executable behavior.

- [ ] **Step 1: Add documentation command-verification tests**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

it('documents only executable Synaploom commands', async () => {
  const files = [
    'README.md',
    'apps/cli/README.md',
    'docs/user/getting-started.md',
    'docs/contributing/development.md',
  ];
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  const joined = contents.join('\n');

  expect(joined).toContain('synaploom course validate');
  expect(joined).toContain('pnpm verify');
  expect(joined).toContain('Node.js 22.13.0');
  expect(joined).not.toContain('nova-learn start');
});
```

- [ ] **Step 2: Run the documentation test and confirm the old docs fail**

```bash
pnpm vitest run tests/architecture/documentation.spec.ts
```

Expected: FAIL until all referenced files use the final commands and architecture.

- [ ] **Step 3: Write complete final documentation**

The root README must include:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm --filter @synaploom/cli build
node apps/cli/dist/index.js dev examples/frontend-performance-foundations
```

Learner docs must show:

```bash
synaploom doctor
synaploom course validate ./course
synaploom course import ./course --trust
synaploom start frontend-performance-foundations
```

Security docs must state that imported exercise actions execute with the learner's OS account, only declared action IDs are callable from the browser, trusted courses can still run local programs, and unrestricted shells remain outside the MVP. AI privacy docs must distinguish local and remote providers and state that browser code never receives credentials.

The release checklist must enumerate every acceptance criterion from the approved specification with an exact verification command or test file.

- [ ] **Step 4: Format and verify documentation**

```bash
pnpm format
pnpm vitest run tests/architecture/documentation.spec.ts
pnpm format:check
```

Expected: documentation tests and formatting pass.

- [ ] **Step 5: Commit final documentation**

```bash
git add README.md apps/cli/README.md docs examples tests/architecture/documentation.spec.ts
git commit -m "docs: document Synaploom development and security model"
```

### Task 21: Run the complete release gate and record evidence

**Files:**

- Create: `docs/releases/0.1.0-verification-report.md`
- Modify only if a gate exposes a real defect: the smallest relevant source and regression test

**Interfaces:**

- Consumes: every previous task.
- Produces: fresh verification evidence from a clean install and a release-ready `main` candidate without claiming npm scope or trademark availability.

- [ ] **Step 1: Verify a clean frozen installation**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules tooling/*/node_modules
corepack prepare pnpm@11.13.0 --activate
pnpm install --frozen-lockfile
```

Expected: exit code `0`, no lockfile modification, and no peer-dependency warning.

- [ ] **Step 2: Run the complete static and test gate**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:type-strip
pnpm test
pnpm build
pnpm test:e2e
pnpm verify:package
```

Expected: every command exits `0` with zero warnings and no skipped mandatory suite.

- [ ] **Step 3: Inspect the packed artifact and repository state**

```bash
git status --short
find artifacts -maxdepth 2 -type f -print
sha256sum artifacts/*.tgz
```

Expected: Git working tree is clean; one Synaploom CLI tarball and checksum are present; the tarball contains no absolute paths, workspace dependencies, source repository files, or legacy Nova Learn branding.

- [ ] **Step 4: Record exact evidence without unsupported claims**

Generate `docs/releases/0.1.0-verification-report.md` directly from fresh command output:

```bash
COMMIT=$(git rev-parse HEAD)
NODE_VERSION=$(node --version)
PNPM_VERSION=$(pnpm --version)
TARBALL=$(find artifacts -maxdepth 1 -name '*.tgz' -print -quit)
CHECKSUM=$(sha256sum "$TARBALL" | awk '{print $1}')
VITEST_SUMMARY=$(pnpm test -- --reporter=basic 2>&1 | tail -n 8 | tr '\n' ' ')
PLAYWRIGHT_SUMMARY=$(pnpm test:e2e -- --reporter=line 2>&1 | tail -n 5 | tr '\n' ' ')
cat > docs/releases/0.1.0-verification-report.md <<EOF
# Synaploom 0.1.0 Verification Report

- Commit: $COMMIT
- Node.js: $NODE_VERSION
- pnpm: $PNPM_VERSION
- Frozen install: passed
- Format: passed
- ESLint: passed with zero warnings
- TypeScript: passed
- Node type-strip compatibility: passed
- Vitest summary: $VITEST_SUMMARY
- Playwright summary: $PLAYWRIGHT_SUMMARY
- Packed CLI offline install: passed
- Local daemon bind address: 127.0.0.1
- SIGINT shutdown: exit code 0
- Tarball SHA-256: $CHECKSUM

The Synaploom name remains a working identity pending independent npm, repository,
domain, and trademark availability checks.
EOF
```

Inspect the generated report and reject the task if any summary contains a failure, skip, warning, or empty value.

- [ ] **Step 5: Commit the verified release evidence**

```bash
git add docs/releases/0.1.0-verification-report.md
git commit -m "chore: record Synaploom migration verification"
```

---

## Slice Checkpoints

After each slice, run the listed minimum gate before proceeding:

| Slice | Required checkpoint                                                                      |
| ----- | ---------------------------------------------------------------------------------------- |
| 1     | `pnpm format:check && pnpm verify:fast`                                                  |
| 2     | `pnpm test && pnpm build && pnpm verify:package`                                         |
| 3     | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm check:type-strip && pnpm test` |
| 4     | `pnpm --filter @synaploom/web build && pnpm test && pnpm verify:package`                 |
| 5     | `pnpm vitest run packages/ui apps/web/src/app/showcase && pnpm lint`                     |
| 6     | `pnpm verify:fast && pnpm test:e2e`                                                      |
| 7     | `pnpm test && pnpm test:e2e` with the disabled provider                                  |
| 8     | `pnpm verify:package && pnpm test:e2e`                                                   |
| 9     | `pnpm verify` from a clean frozen install                                                |

## Self-Review Checklist

- Every approved migration slice maps to at least one task.
- Product rename, local-data migration, CLI binary, cookie, package scope, and design token prefix are covered.
- pnpm workspace dependencies, package exports, private aliases, strict compiler flags, Prettier, ESLint, and TSDoc policy are covered.
- React/Vite, TanStack Query, safe typed Markdown, design-system primitives, focused workspace behavior, SSE, and daemon authority are covered.
- Optional AI contracts and privacy boundaries are covered without requiring a provider integration.
- Offline CLI installation, absolute-path scanning, SIGINT shutdown, security regression tests, and Playwright browser flow are covered.
- No implementation step weakens linear progression, local bind restrictions, path validation, trust confirmation, or declared-action enforcement.
