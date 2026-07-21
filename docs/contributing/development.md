# Contributing to Synaploom

1. Install the Node version declared in `package.json`.
2. Run `corepack enable` and `pnpm install`.
3. Add behavior through a failing test first.
4. Keep package dependencies explicit with `workspace:*`.
5. Run `pnpm verify` before opening a pull request.

Do not weaken daemon authority, accept raw browser shell commands, add arbitrary MDX/HTML execution, or make AI mandatory for course playback.

## Frontend HMR with the real runtime

Run `pnpm dev:full -- examples/frontend-performance-foundations`, then open the printed
`127.0.0.1:5173/bootstrap?...` URL. Vite reloads React and CSS changes immediately while
`/bootstrap` and `/api` are served by the local Go runtime. Restart `dev:full` after Go
changes, course manifest changes, or course structure changes. Production preview and release
workflows still use `pnpm go:stage-web` followed by a Go build.

## Final native verification

Core changes require Go 1.26.5 and the staged production Web build. Run `pnpm go:stage-web`, `go test -race ./...`, `go vet ./...`, `go tool staticcheck ./...`, and the Go-backed Playwright project before release.
