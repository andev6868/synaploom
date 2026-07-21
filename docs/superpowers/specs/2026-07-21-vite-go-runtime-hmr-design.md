# Vite HMR with the Go runtime

## Goal

Allow frontend work to reload immediately while using the real Synaploom Go
runtime for course data, session handling, progression, activities, SSE, and
AI routes. A frontend edit must not require staging Web assets or rebuilding a
native binary.

## Scope

This is a development-only workflow. The production executable continues to
embed the staged Vite build and remains the only process exposed to learners.

The preferred developer entry point is:

```bash
pnpm dev:full -- examples/frontend-performance-foundations
```

It starts a Go preview runtime on `127.0.0.1:4174` and Vite on
`127.0.0.1:5173`, then prints the Vite-facing bootstrap URL.

## Architecture

```text
Browser (127.0.0.1:5173)
  ├─ HTML, JavaScript, CSS, HMR ───────────> Vite
  └─ /bootstrap and /api/v1/* ─────────────> Vite proxy ───> Go runtime (127.0.0.1:4174)
```

The browser always uses the Vite origin during this workflow. The API client
continues to make relative requests, so it requires no production-path branch
or environment-specific client code.

Vite proxies both `/api` and `/bootstrap` to the Go runtime. It preserves the
original host, forwards session cookies unchanged, and must support streaming
responses so existing SSE endpoints remain usable. The Go bootstrap redirect
uses a relative location, allowing the browser to return to Vite after the
session cookie is created.

## Developer workflow

`dev:full` accepts exactly one course directory. It performs the following:

1. Starts the Go preview entry point with `dev <course-path> --port 4174`.
2. Waits for its one-time bootstrap URL.
3. Starts Vite with `SYNAPLOOM_DAEMON_ORIGIN=http://127.0.0.1:4174`.
4. Prints the bootstrap URL rewritten to `http://127.0.0.1:5173`.
5. Sends termination signals to both children and returns their meaningful
   exit status.

The Go CLI's `dev` command gains the same optional `--port` flag as `start`.
The existing default (`0`, an automatically assigned loopback port) remains
available for direct CLI use. `dev:full` uses fixed ports only to give Vite a
stable proxy target.

The script passes through `SYNAPLOOM_HOME` when supplied, preserving the
current local-state model. It does not set or delete a developer's data root.

## File and component changes

- `apps/web/vite.config.ts`: add a development proxy controlled by
  `SYNAPLOOM_DAEMON_ORIGIN`, defaulting to `http://127.0.0.1:4174`.
- `internal/cli/dispatcher.go` and its tests: accept `--port` for `dev`.
- `scripts/dev/full.mjs`: own process startup, readiness, bootstrap URL
  rewriting, error reporting, and coordinated shutdown.
- Root `package.json`: expose `dev:full`.
- Contributor documentation: distinguish UI-only Vite usage from the real
  runtime HMR workflow.

No production server routing, browser API-client paths, cookie attributes, or
embedded-asset code changes are required.

## Error handling

- If port `4174` or `5173` is unavailable, identify which process failed and
  stop the other child.
- If Go exits before emitting a bootstrap URL, forward its stderr and return a
  nonzero status without starting Vite.
- If Vite exits after Go is ready, stop Go and return Vite's status.
- A bootstrap token is printed only as the intended Vite URL; the original Go
  origin URL is not echoed a second time.

## Verification

Add targeted coverage for CLI parsing and Vite proxy configuration. Add a
development integration test that starts the Go runtime and Vite, opens the
Vite bootstrap URL, confirms a lesson response is JSON-backed, and verifies a
frontend source change is reflected through HMR without rebuilding Go.

The existing Go-runtime browser suites remain the production integration
regression. Fast checks must include the new script/config tests; the focused
HMR integration test runs wherever the loopback browser environment is
available.

## Non-goals

- Hot-reloading Go code or course schema changes.
- Changing native release packaging.
- Mocking the Go API or weakening session authority.
- Exposing either development server beyond loopback.
