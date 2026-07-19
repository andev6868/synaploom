# Synaploom

**Community-crafted learning, guided by AI.**

Synaploom is an open-source, local-first course player for structured, hands-on learning. It ships as a single native Go executable with an embedded React interface. Courses are imported from trusted local Markdown/JSON sources, progress is stored locally in SQLite, and exercises run inside isolated learner workspaces.

The Go runtime is authoritative for course validation, lesson progression, workspace access, local process execution, persistence, diagnostics, HTTP/SSE delivery, and optional AI integrations. The browser UI cannot unlock lessons, mark checks as passed, or submit arbitrary shell commands.

## Current release

- Synaploom: `0.2.0`
- Course schema: `1.2.0`
- Native targets:
  - macOS: `amd64`, `arm64`
  - Linux: `amd64`, `arm64`
  - Windows: `amd64`, `arm64`

See [`docs/releases/go-core-migration-verification.md`](docs/releases/go-core-migration-verification.md) for the migration and release evidence.

## Install

Download the native binary for your platform, rename it to `synaploom` (`synaploom.exe` on Windows), and place it on your `PATH`.

On macOS or Linux:

```bash
chmod +x ./synaploom
./synaploom version
./synaploom doctor
```

On Windows PowerShell:

```powershell
.\synaploom.exe version
.\synaploom.exe doctor
```

Synaploom does not require Node.js, Docker, a public server, or an online account for normal course playback. A course may still declare local actions that require tools such as Node.js, Go, Python, or another executable on the learner machine.

## Quick start

Validate and import a course:

```bash
synaploom course validate ./my-course
synaploom course import ./my-course
synaploom course list
```

Start an imported course:

```bash
synaploom start <course-id>
```

Preview a course directly from its source directory:

```bash
synaploom dev ./my-course
```

`start` and `dev` bind only to loopback. Synaploom prints a one-time bootstrap URL, exchanges it for an HTTP-only session cookie, and serves the embedded React application from the native process.

Useful commands:

```bash
synaploom version
synaploom doctor
synaploom doctor --json
synaploom course validate <course-path>
synaploom course import <course-path>
synaploom course list
synaploom start <course-id> [--port <port>]
synaploom dev <course-path>
```

## Local data

By default, Synaploom stores local state under:

```text
~/.synaploom/
├── courses/       immutable imported course copies
├── workspaces/    learner-editable exercise files
├── state/         SQLite database
├── runtime/       local runtime state
└── logs/          bounded diagnostic logs
```

Override the root with `SYNAPLOOM_HOME`:

```bash
SYNAPLOOM_HOME=/another/path synaploom course list
```

Imported courses, progress, submissions, and learner workspaces survive process restarts.

## Course format

A course v1 source contains a `course.json` manifest and lesson Markdown content. Lessons may combine rich typed Markdown with activity sets for quizzes, mathematics, writing, matching, ordering, and isolated coding workspaces. Existing starter files, checks, and explicitly declared local actions remain supported through the coding compatibility adapter.

Start with:

- [`docs/course-authoring/course-format-v1.md`](docs/course-authoring/course-format-v1.md)
- [`docs/authoring/rich-lesson-content.md`](docs/authoring/rich-lesson-content.md)
- [`docs/authoring/activity-engine.md`](docs/authoring/activity-engine.md)
- [`docs/authoring/activity-kinds.md`](docs/authoring/activity-kinds.md)
- [`examples/frontend-performance-foundations`](examples/frontend-performance-foundations)
- [`examples/multi-domain-foundations`](examples/multi-domain-foundations)

Synaploom treats imported content as data. Import does not execute course actions.

## Architecture

```text
cmd/
  synaploom/              authoritative native CLI and runtime entry point
internal/
  app/                    runtime composition and shutdown lifecycle
  cli/                    command parsing and exit-code contracts
  course/                 validation, import, Markdown normalization, watching
  progression/            sequential lesson progression invariants
  storage/                SQLite migrations, repositories, backup and restore
  workspace/              isolated learner working copies and path containment
  runner/                 allowlisted process execution and bounded event streams
  server/                 loopback HTTP, SSE, sessions and compatibility routes
  webassets/              embedded production React assets
  ai/                     optional provider-neutral AI boundary
  diagnostics/, logging/  doctor reports and bounded structured logs
apps/
  web/                    React/Vite learner interface
packages/
  contracts/              canonical TypeScript domain contracts
  protocol/               typed browser/runtime payloads
  course-*/               authoring-side schema, loading and validation tools
  lesson-renderer/         safe Markdown document rendering
  web-client/             browser API transport
  ui/                     Synaploom design system
schemas/v1/                canonical JSON Schema 2020-12 contracts
generated/                 checked-in generated Go and TypeScript declarations
```

For the full design, see:

- [`docs/architecture/go-core.md`](docs/architecture/go-core.md)
- [`docs/architecture/overview.md`](docs/architecture/overview.md)
- [`docs/architecture/security-model.md`](docs/architecture/security-model.md)

## Security model

Synaploom enforces these boundaries:

- HTTP binds to `127.0.0.1` only.
- Browser sessions use a one-time bootstrap exchange and an HTTP-only, SameSite cookie.
- The browser submits declared action IDs, never raw shell commands.
- The Go runner resolves an explicit executable and argument vector; standard actions do not invoke a shell.
- Workspace paths are contained under trusted roots, and traversal or symlink escape is rejected.
- Imported course code runs with the learner's operating-system permissions and must be reviewed as trusted local code.
- AI is optional, disabled by default, and cannot control progression or assessment state.

## Development

### Prerequisites

- Go `1.26.5`
- Node.js `>=22.13.0`
- Corepack
- pnpm `11.13.0`

Install dependencies:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Run the fast repository checks:

```bash
pnpm verify:fast
```

Run native Go checks:

```bash
pnpm go:stage-web
pnpm go:verify
```

Run the Go-backed browser flow:

```bash
pnpm test:e2e --project=go-runtime
```

Run the complete verification flow:

```bash
pnpm verify
```

Additional contract and Activity Engine gates:

```bash
pnpm contracts:check
pnpm conformance:contracts
pnpm conformance:runner
pnpm validate:multi-domain
pnpm test:activity-engine
pnpm test:activity-engine-docs
```

See [`docs/contributing/development.md`](docs/contributing/development.md) for the contributor workflow.

## Build and release

Build a native binary for the host platform:

```bash
pnpm go:stage-web
pnpm go:build
```

Build and verify all six release targets:

```bash
pnpm go:release
pnpm go:verify-release
```

Create the deterministic tracked-source archive:

```bash
pnpm go:archive-source
```

Release artifacts include a SHA-256 inventory. Generated Web assets must be staged before compiling because the native binary embeds the production React build.

## AI integrations

AI support is provider-neutral and optional. The runtime can assemble selected context, redact secrets, disclose outbound context, stream bounded responses, and cancel requests. Disabled mode remains a first-class provider, and AI cannot unlock lessons, pass checks, or complete progression steps.

## License

A license has not yet been selected. Add an OSI-approved license before public distribution.

## Hierarchical learning progression

Synaploom supports `schemaVersion 1.1.0`, required and optional lessons, chapter assessments, and Course Schema 1.0 implicit chapter migration. The daemon distinguishes `currentLessonId and viewedLessonId`; review mode does not rollback progression. Persistence keeps `bestResult and latestResult` separately so a failed review does not revoke previously earned completion.
