# Synaploom Monorepo, React, and Design System Migration Design

**Status:** Approved working design  
**Date:** 2026-07-15  
**Scope:** Incremental migration of the existing local-first course player  
**Product name:** Synaploom  
**npm scope:** `@synaploom`  
**CLI command:** `synaploom`

## 1. Purpose

This design migrates the current Nova Learn proof-of-concept into a maintainable open-source product named **Synaploom**. The migration replaces nominal package boundaries and hand-written build orchestration with a real pnpm workspace, strict TypeScript tooling, a React application, and a product-owned design system.

The product remains a local-first course player:

1. A learner imports a trusted Markdown/JSON course.
2. The CLI starts a daemon bound to `127.0.0.1`.
3. A browser opens a focused two-pane learning workspace.
4. Lessons unlock in strict sequence.
5. Practice actions execute locally from declared action IDs.
6. Progress and workspaces persist on the learner's machine.
7. AI assistance is optional and never blocks the learning flow.

The migration must preserve the current security model, local execution model, linear progression semantics, and offline installability.

## 2. Naming and identity

### 2.1 Product identity

The product and ecosystem are renamed as follows:

| Current name           | Target name                |
| ---------------------- | -------------------------- |
| Nova Learn             | Synaploom                  |
| `nova-learn` CLI       | `synaploom` CLI            |
| `@nova-learn/*`        | `@synaploom/*`             |
| `~/.nova-learn`        | `~/.synaploom`             |
| `nova_session` cookie  | `synaploom_session` cookie |
| `--nl-*` design tokens | `--syn-*` design tokens    |

The name combines **synapse**, representing AI-assisted cognition, with **loom**, representing community-authored learning paths woven from lessons, code, and practice.

Working tagline:

> Community-crafted learning, guided by AI.

The name is a working product identity until npm scope, repository, domain, and trademark checks are completed. The codebase must not imply that uniqueness or legal availability has been proven.

### 2.2 Compatibility policy

The project is still pre-release, so the migration will not keep a permanent `nova-learn` command alias. A one-time local-data migration will preserve existing development progress:

1. If `~/.synaploom` does not exist and `~/.nova-learn` exists, the CLI moves the old directory atomically when the filesystem permits it.
2. If both directories exist, the CLI leaves both unchanged and prints a clear conflict message.
3. Course IDs, lesson IDs, and Course Schema v1 remain unchanged.
4. Existing imported courses do not need content changes solely because of the product rename.

## 3. Migration strategy

The migration is incremental. Each slice must leave the repository buildable, testable, and packageable before the next slice begins.

The order is:

1. Workspace and tooling foundation.
2. Real package boundaries and alias imports.
3. Strict TypeScript build pipeline.
4. React/Vite application shell.
5. Synaploom Design System foundation.
6. Learning workspace feature migration.
7. AI extension boundary.
8. CLI packaging integration.
9. Cleanup and documentation.

A slice may not be merged when the packed CLI cannot be installed and started from a clean directory.

## 4. Target repository architecture

```text
synaploom/
├── apps/
│   ├── cli/
│   ├── daemon/
│   └── web/
│
├── packages/
│   ├── ai-contracts/
│   ├── contracts/
│   ├── course-importer/
│   ├── course-loader/
│   ├── course-schema/
│   ├── course-validator/
│   ├── exercise-runner/
│   ├── lesson-renderer/
│   ├── local-database/
│   ├── progression/
│   ├── protocol/
│   ├── security/
│   ├── ui/
│   └── workspace-manager/
│
├── tooling/
│   ├── eslint-config/
│   ├── test-config/
│   └── typescript-config/
│
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── security/
│
├── examples/
├── docs/
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
└── tsconfig.json
```

### 4.1 Package responsibilities

- `@synaploom/contracts`: stable domain data types shared across runtimes.
- `@synaploom/protocol`: typed local HTTP and process-event contracts.
- `@synaploom/course-schema`: JSON schema and schema-level types.
- `@synaploom/course-loader`: reads and normalizes course content from disk.
- `@synaploom/course-validator`: validates imported course structure and references.
- `@synaploom/course-importer`: installs trusted course copies into local storage.
- `@synaploom/lesson-renderer`: converts Markdown into a safe typed lesson document.
- `@synaploom/local-database`: owns SQLite access and migrations.
- `@synaploom/progression`: owns linear progression invariants.
- `@synaploom/workspace-manager`: owns learner workspace copies and safe file access.
- `@synaploom/exercise-runner`: runs declared actions with resource limits.
- `@synaploom/security`: path, token, trust, and local-boundary helpers.
- `@synaploom/ai-contracts`: provider-neutral AI request and response contracts.
- `@synaploom/ui`: Synaploom Design System.
- `apps/daemon`: composes domain packages into the local server.
- `apps/web`: React client for the local daemon.
- `apps/cli`: command-line lifecycle, packaging, browser launch, and migration entry point.

### 4.2 Dependency direction

```text
apps/web
 ├── @synaploom/ui
 ├── @synaploom/protocol
 ├── @synaploom/contracts
 └── @synaploom/ai-contracts

apps/daemon
 ├── @synaploom/course-loader
 ├── @synaploom/course-validator
 ├── @synaploom/progression
 ├── @synaploom/workspace-manager
 ├── @synaploom/exercise-runner
 ├── @synaploom/security
 ├── @synaploom/protocol
 └── @synaploom/ai-contracts

apps/cli
 └── apps/daemon

Domain packages
 └── @synaploom/contracts
```

Domain packages must not depend on React, Vite, `@synaploom/ui`, or any `apps/*` package.

## 5. pnpm workspace design

The repository uses pnpm 11 workspaces with one lockfile. The exact pnpm 11 release is pinned in the root `packageManager` field and activated through Corepack. Internal dependencies use `workspace:*`. Node.js remains pinned to `>=22.13.0`, preserving the current runtime floor while satisfying the selected Vite toolchain.

```yaml
packages:
  - apps/*
  - packages/*
  - tooling/*
```

Representative package dependency:

```json
{
  "name": "@synaploom/progression",
  "dependencies": {
    "@synaploom/contracts": "workspace:*",
    "@synaploom/local-database": "workspace:*"
  }
}
```

pnpm owns:

- dependency installation;
- workspace linking;
- recursive lifecycle execution;
- lockfile reproducibility;
- dependency graph traversal;
- package filtering.

Custom scripts remain only for Synaploom-specific operations that package managers do not provide:

- packed-CLI artifact verification;
- absolute-path scanning;
- offline installation smoke tests;
- Course Schema compatibility checks;
- one-time local-data migration tests.

## 6. TypeScript, formatting, and code style

### 6.1 TypeScript

All TypeScript packages use strict project references and real compiler checks.

Required compiler principles:

- `strict: true`;
- `noUncheckedIndexedAccess: true`;
- `exactOptionalPropertyTypes: true`;
- `noImplicitOverride: true`;
- `noFallthroughCasesInSwitch: true`;
- `verbatimModuleSyntax: true`;
- explicit package exports;
- declaration generation for reusable packages.

Node type-stripping compatibility remains a separate check. It is not called type-checking.

```text
pnpm typecheck
pnpm check:type-strip
```

### 6.2 Prettier

Prettier is the only formatting authority.

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

Generated files are excluded explicitly. Source files, tests, Markdown, JSON, YAML, and CSS are formatted in CI.

### 6.3 ESLint and style guide

The project defines a **Synaploom TypeScript and React Style Guide** based on:

- `typescript-eslint` strict type-checked rules;
- React Hooks recommended rules;
- accessibility linting for JSX;
- explicit import boundaries;
- no undeclared workspace dependencies;
- no floating promises;
- exhaustive discriminated-union handling;
- no `any` without a documented adapter-boundary exception;
- no non-null assertion outside validated adapter boundaries;
- named exports for domain and design-system modules;
- small focused modules with one responsibility.

The style guide is stored at:

```text
docs/engineering/typescript-react-style-guide.md
```

### 6.4 Comment policy

Comments explain contracts, constraints, security boundaries, and non-obvious decisions. They do not narrate self-explanatory code.

TSDoc is required for:

- every public exported function, type, class, hook, and component;
- domain invariants;
- local execution and security boundaries;
- provider interfaces;
- migration behavior;
- platform-specific workarounds.

Example:

```ts
/**
 * Resolves the first lesson the learner may open.
 *
 * Progression is intentionally linear. A lesson is available only when
 * every preceding lesson has been completed.
 */
export declare function resolveCurrentLesson(course: Course, progress: CourseProgress): Lesson;
```

Comments are written in English. User-facing strings and example course content may remain Vietnamese.

## 7. Import policy and aliases

Relative module imports are prohibited in source TypeScript and TSX.

### 7.1 Cross-package imports

```ts
import type { Course } from '@synaploom/contracts';
import { loadCourse } from '@synaploom/course-loader';
import { Button } from '@synaploom/ui';
```

Consumers may import only public package exports. Deep imports into another package's `src/` directory are prohibited.

### 7.2 Intra-package imports

Each package uses Node-compatible private aliases through the `imports` field:

```json
{
  "imports": {
    "#/*": "./src/*"
  }
}
```

```ts
import { parseCourseManifest } from '#/manifest/parse-course-manifest';
```

TypeScript, test tooling, and bundlers must resolve the same alias contract. Emitted build output may contain generated relative paths; the prohibition applies to authored source imports.

### 7.3 Enforcement

Lint and architecture tests reject:

- `./` and `../` imports in source TS/TSX;
- deep imports into another package;
- undeclared package dependencies;
- dependency cycles;
- app imports from another app except the documented CLI-to-daemon composition boundary;
- domain dependencies on UI or React.

## 8. React application architecture

The current handwritten DOM application is replaced completely by React. The old renderer is not maintained in parallel after the React feature slice is accepted.

### 8.1 Technology

- React 19.2;
- TypeScript;
- Vite;
- TanStack Query for daemon-backed server state;
- React local state for transient UI state;
- URL state for the active course and lesson;
- local storage only for preferences such as pane ratio.

The application remains a client-side SPA served as static assets by the local daemon. It does not use SSR, React Server Components, or a full-stack web framework.

### 8.2 Source layout

```text
apps/web/src/
├── app/
│   ├── App.tsx
│   ├── providers/
│   └── router/
├── features/
│   ├── ai-assistant/
│   ├── course-session/
│   ├── lesson-content/
│   ├── practice-runner/
│   ├── progression/
│   └── workspace-layout/
├── entities/
│   ├── course/
│   ├── lesson/
│   └── submission/
├── shared/
│   ├── api/
│   ├── hooks/
│   └── lib/
└── main.tsx
```

### 8.3 State ownership

- The daemon is authoritative for lesson access, progress, completion, and declared actions.
- TanStack Query caches daemon responses and invalidates them after mutations.
- React state owns open tabs, selected file, terminal selection, and temporary interaction state.
- Pane ratio is stored as a preference and clamped to the approved 32–68 percent range.
- The browser never sends a raw shell command; it sends an action ID declared by the exercise manifest.

### 8.4 Learning workspace

```tsx
<LearningWorkspace>
  <LearningHeader />
  <WorkspaceShell
    lesson={<LessonPanel />}
    practice={<PracticePanel />}
    assistant={<AssistantDock />}
  />
</LearningWorkspace>
```

The workspace preserves the approved interaction model:

- thin header;
- two dominant panes;
- independent scrolling;
- resizable divider;
- large readable content;
- persistent action bar;
- no dashboard cards inside the focused learning flow;
- no modal required for the primary learning loop.

## 9. Safe lesson rendering

Imported Markdown is untrusted content. The React migration must not replace the current safety behavior with unrestricted MDX or arbitrary HTML.

`@synaploom/lesson-renderer` converts Markdown into a typed, sanitized lesson document:

```ts
export type LessonBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | CodeBlock
  | CalloutBlock
  | ImageBlock
  | LinkBlock
  | AssignmentBlock;
```

The web application renders these blocks through React components. It does not render arbitrary author-provided components and does not use unrestricted `dangerouslySetInnerHTML`.

Supported MVP syntax remains limited to:

- headings;
- paragraphs;
- ordered and unordered lists;
- fenced code;
- safe links;
- local course images;
- note, hint, and warning callouts;
- assignment blocks.

MDX remains out of scope.

## 10. Synaploom Design System

### 10.1 Foundation

The design system is published internally as:

```text
@synaploom/ui
```

It uses:

- Radix Primitives for accessible behavior and focus management;
- Tailwind CSS through the Vite plugin for zero-runtime generated styles;
- Class Variance Authority for typed variants;
- Lucide React for icons;
- CSS custom properties for semantic design tokens.

Synaploom owns component APIs, tokens, visual states, and documentation. It does not expose raw Radix primitives as the feature-layer contract.

### 10.2 Package structure

```text
packages/ui/src/
├── foundations/
│   ├── reset.css
│   ├── tokens.css
│   └── typography.css
├── primitives/
│   ├── button/
│   ├── dialog/
│   ├── input/
│   ├── scroll-area/
│   ├── separator/
│   ├── tabs/
│   └── tooltip/
├── components/
│   ├── action-bar/
│   ├── app-header/
│   ├── assistant-dock/
│   ├── lesson-progress/
│   ├── status-badge/
│   ├── terminal-shell/
│   └── workspace-shell/
├── hooks/
├── icons/
└── index.ts
```

### 10.3 Tokens

```css
:root {
  --syn-color-background: oklch(0.985 0.004 250);
  --syn-color-surface: oklch(1 0 0);
  --syn-color-surface-muted: oklch(0.965 0.006 250);
  --syn-color-border: oklch(0.9 0.01 250);
  --syn-color-primary: oklch(0.58 0.2 255);
  --syn-color-primary-hover: oklch(0.52 0.21 255);
  --syn-color-text: oklch(0.22 0.025 255);
  --syn-color-text-muted: oklch(0.5 0.025 255);
  --syn-color-success: oklch(0.62 0.15 150);
  --syn-color-warning: oklch(0.72 0.15 75);
  --syn-color-danger: oklch(0.6 0.2 25);
  --syn-radius-sm: 0.375rem;
  --syn-radius-md: 0.625rem;
  --syn-radius-lg: 0.875rem;
  --syn-header-height: 3.5rem;
  --syn-panel-padding: 1.5rem;
}
```

Feature code must use semantic components and tokens instead of arbitrary color utilities.

```tsx
<Button variant="primary">Nộp bài</Button>
<StatusBadge status="passed">Đã đạt</StatusBadge>
```

### 10.4 Accessibility contract

Every interactive component must define and test:

- accessible name;
- keyboard interaction;
- visible focus;
- disabled behavior;
- loading behavior;
- reduced-motion behavior when animation exists;
- sufficient semantic structure for assistive technology.

## 11. AI architecture

AI is an optional assistance layer, not a prerequisite for learning or progression.

### 11.1 Product behavior

The assistant may:

- explain the current lesson in simpler language;
- provide a hint based on the current exercise;
- summarize the visible lesson section;
- explain daemon-reported test failures;
- ask guiding questions rather than reveal a complete solution immediately.

The assistant may not:

- mark lessons complete;
- bypass locked lessons;
- execute undeclared commands;
- access files outside the active course workspace;
- receive secrets or arbitrary local files;
- become a required dependency for course playback.

### 11.2 Provider-neutral contracts

```ts
export interface AiProvider {
  readonly id: string;
  generate(request: AiRequest, signal: AbortSignal): Promise<AiResponse>;
}
```

`@synaploom/ai-contracts` defines the stable contract. Provider adapters remain separate packages or daemon plugins.

Potential adapters include:

- OpenAI-compatible remote API;
- Ollama local model;
- LM Studio local server;
- disabled provider.

No provider SDK is imported into domain packages or the web application.

### 11.3 Secret and privacy boundary

- API keys remain in daemon-side local configuration.
- The web client never receives provider credentials.
- The daemon constructs a minimal context package from the active lesson, declared editable files, latest check result, and learner-selected text.
- Sending source code to a remote provider requires explicit configuration and visible disclosure.
- A local provider remains the recommended privacy-preserving mode.

### 11.4 Migration scope

This migration creates the contracts, daemon extension point, configuration boundary, and React `AssistantDock`. It does not require a production provider integration before the React and monorepo migration is accepted.

## 12. Build and packaging

### 12.1 Development build

- pnpm orchestrates workspace scripts.
- TypeScript project references perform static checks.
- Vite builds the web application.
- Node packages build through a standard TypeScript bundling step.
- The CLI bundles internal workspace runtime code so learners do not need pnpm or separately published internal packages.

### 12.2 Packed CLI

The packed CLI contains:

- executable `synaploom` entry point;
- bundled daemon and domain runtime;
- Vite production assets;
- package metadata and README;
- no repository-only source files;
- no absolute build-machine paths.

A clean smoke test must:

1. pack the CLI;
2. install it into an isolated prefix with network access disabled;
3. run `synaploom doctor`;
4. validate and import the example course;
5. start the local daemon;
6. verify HTML, CSS, JavaScript, and API responses;
7. stop with `SIGINT` and confirm exit code `0`.

## 13. Testing strategy

### 13.1 Domain and infrastructure packages

- Vitest for unit and integration tests.
- Temporary real directories for filesystem behavior.
- Real SQLite databases in temporary directories where practical.
- Tests target public APIs and domain behavior.

### 13.2 React and design system

- React Testing Library for user interaction.
- Queries by role, label, and accessible name.
- No whole-page snapshot tests.
- Design-system tests cover keyboard, focus, disabled, and variant behavior.

### 13.3 End-to-end

Playwright verifies the complete local flow:

```text
Start CLI
→ Bootstrap local session
→ Open lesson 1
→ Run/check fails
→ Edit allowed file
→ Check passes
→ Complete lesson
→ Lesson 2 unlocks
→ Reload
→ Progress and workspace persist
```

### 13.4 Static gates

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:type-strip
pnpm test
pnpm build
pnpm test:e2e
pnpm verify:package
```

No gate may emit warnings treated as acceptable technical debt. Any intentional warning must be converted into a documented, testable exception.

## 14. Migration slices

### Slice 1: Workspace and engineering foundation

- Add `pnpm-workspace.yaml` and lockfile.
- Add shared TypeScript, ESLint, Prettier, and test configurations.
- Add engineering style guide.
- Preserve runtime behavior.

### Slice 2: Naming and package boundaries

- Rename product, package scopes, CLI command, cookie, data root, and documentation.
- Add one-time local-data migration.
- Convert internal dependencies to `workspace:*`.
- Replace source relative imports with package and private aliases.
- Add architecture boundary tests.

### Slice 3: Strict TypeScript pipeline

- Add project references and declaration outputs.
- Replace handwritten test and type-check orchestration.
- Keep type-strip compatibility as a separate portability gate.
- Preserve all security and progression tests.

### Slice 4: React/Vite shell

- Create React entry point, providers, router, and typed API client.
- Serve Vite output through the daemon.
- Preserve the current functional flow before visual migration.

### Slice 5: Design system foundation

- Implement tokens, typography, reset, and primitive components.
- Add accessibility and variant tests.
- Add an internal component showcase route available only in development.

### Slice 6: Focused learning workspace

- Migrate header, split panes, lesson rendering, editor, terminal output, actions, and completion flow.
- Render typed lesson blocks instead of HTML strings.
- Remove the old DOM application after parity and E2E verification.

### Slice 7: AI extension boundary

- Add AI contracts and daemon configuration boundary.
- Add disabled provider and React `AssistantDock` states.
- Ensure the product remains fully usable with AI disabled.

### Slice 8: Packaging integration

- Bundle CLI runtime and Vite assets.
- Verify offline install and startup.
- Verify no absolute paths or undeclared runtime dependencies.

### Slice 9: Cleanup and documentation

- Remove superseded scripts and old `@nova-learn` names.
- Update user, course-authoring, security, contributor, and architecture docs.
- Add migration notes and release checklist.

## 15. Acceptance criteria

The migration is complete only when all of the following are true:

- Product-facing name is Synaploom.
- CLI command is `synaploom`.
- Internal package scope is `@synaploom/*`.
- Existing local progress migrates safely from `~/.nova-learn` when no conflict exists.
- `pnpm install --frozen-lockfile` succeeds.
- Every internal dependency uses `workspace:*`.
- No authored TS or TSX source import starts with `./` or `../`.
- No package imports another package's private source path.
- Prettier check passes.
- ESLint passes with zero warnings.
- Strict TypeScript passes.
- Type-strip compatibility passes independently.
- The web UI uses React and contains no handwritten DOM application renderer.
- Shared primitives come from `@synaploom/ui`.
- Imported Markdown is rendered through a safe typed document model.
- Linear lesson progression remains daemon-authoritative.
- The browser can invoke only declared action IDs.
- AI can be disabled without degrading course playback or completion.
- The packed CLI installs and starts without pnpm, repository source, or network access.
- Existing unit, integration, security, and E2E behavior remains covered.
- The focused two-pane UI remains the primary learning workspace.

## 16. Non-goals

This migration does not add:

- a cloud backend;
- user accounts;
- course marketplace or public registry;
- social features or leaderboards;
- a full interactive unrestricted shell;
- MDX or arbitrary author-supplied React components;
- AI-controlled progression;
- mandatory remote AI services;
- multiple concurrent learner profiles;
- a new Course Schema major version.

## 17. Risks and mitigations

### Build-system expansion

**Risk:** More tools can make contributor setup heavier.  
**Mitigation:** Pin versions, use one lockfile, expose one `pnpm verify` command, and keep learner packages self-contained.

### Rename regression

**Risk:** Old paths, cookies, package names, or documentation remain.  
**Mitigation:** Add repository-wide forbidden-string tests and a local-data migration integration test.

### Alias inconsistency

**Risk:** TypeScript, Vite, tests, and Node resolve aliases differently.  
**Mitigation:** Define aliases from package metadata, reuse shared tooling config, and test built output rather than relying only on development resolution.

### React migration behavior drift

**Risk:** The visual rewrite changes progression or security behavior.  
**Mitigation:** Keep the daemon authoritative and preserve existing API-level and E2E tests before replacing the old UI.

### AI privacy leakage

**Risk:** Local source or secrets are sent to a remote provider unexpectedly.  
**Mitigation:** Keep provider calls daemon-side, require explicit provider configuration, show disclosure, and minimize transmitted context.

### Design-system overreach

**Risk:** Building too many primitives delays the learning workspace.  
**Mitigation:** Implement only components required by the approved MVP screens, then expand from demonstrated product needs.

## 18. Primary references

- pnpm workspace documentation: https://pnpm.io/workspaces
- pnpm 11 documentation: https://pnpm.io/
- React version documentation: https://react.dev/versions
- Vite guide and Node compatibility: https://vite.dev/guide/
- Tailwind CSS Vite integration: https://tailwindcss.com/docs/installation/using-vite
- Radix Primitives design-system and accessibility foundation: https://www.radix-ui.com/primitives/docs/overview/introduction
