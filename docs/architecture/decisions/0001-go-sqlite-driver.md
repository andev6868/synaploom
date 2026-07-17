# ADR 0001: Pure-Go SQLite driver

- Status: Accepted
- Date: 2026-07-17

## Decision

Synaploom uses `modernc.org/sqlite` v1.53.0 through `database/sql` for the native runtime.

## Context

The installed product must ship as one native executable for macOS, Linux, and Windows on amd64 and arm64. A CGO-backed driver would require platform C toolchains and platform-specific SQLite linking during release builds, which conflicts with the current `CGO_ENABLED=0` release goal.

## Evidence

The storage spike verifies foreign keys, WAL mode, busy timeout, transaction rollback, closed-database file backup, read-only reopen, and `PRAGMA integrity_check`.

The release matrix is compiled with:

```bash
for target in darwin/amd64 darwin/arm64 linux/amd64 linux/arm64 windows/amd64 windows/arm64; do
  GOOS=${target%/*} GOARCH=${target#*/} CGO_ENABLED=0 \
    go test -c ./internal/storage -o /tmp/storage-${target//\//-}.test
 done
```

Native CI executes the platform-specific storage tests; cross-build jobs prove that the package and driver compile without CGO for every required target.

## Consequences

The first clean build is heavier than CGO wrappers because the SQLite translation is compiled as Go. Build caches and release jobs should prewarm module and build caches. The repository pins the driver version and verifies `go.sum` before release.
