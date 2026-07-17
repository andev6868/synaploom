# Go Core Migration Verification

## Release matrix

- darwin/amd64
- darwin/arm64
- linux/amd64
- linux/arm64
- windows/amd64
- windows/arm64

## Compatibility evidence

- Existing version-1 courses are validated by canonical JSON Schema and imported without modification.
- Node-created database migration is covered by the archived `node-0.1.x.db` fixture and backup-before-migrate tests.
- Process contracts are compared against immutable Node 0.1.x fixtures.
- Playwright exercises the embedded React application against the native Go runtime.
- Contract generation and cross-language validation use the same schema catalog.
- AI-disabled reading, execution, checking, and progression remain functional.

## Verification commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
go test -race ./...
go vet ./...
go tool staticcheck ./...
pnpm test:e2e --project=go-runtime
pnpm go:release
pnpm go:verify-release
pnpm go:archive-source
```

Exact compiler versions, commit, schema version, binary sizes, checksums, Web inventory hash, database fixture hash, and test counts are captured in the final release artifact inventory generated from a clean commit.

## Hierarchical progression acceptance

The release gate validates Course Schema `1.1.0`, the migrated example course, restart persistence, chapter assessment completion, review navigation, and the invariant that a failed later attempt does not revoke `bestResult`. Native verification runs both `doctor --json` and `course validate examples/frontend-performance-foundations` on the host artifact.

In restricted build environments, `scripts/go/with-internal-toolchain.sh` installs Go 1.26.5 from the configured internal Artifactory and runs with `GOTOOLCHAIN=local`; normal CI continues to use the toolchain installed by `actions/setup-go`.
