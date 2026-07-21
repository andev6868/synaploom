# Git Bundle Build Design

## Goal

Provide one repository script that creates a portable Git bundle containing all
local refs and proves that the artifact can be cloned and restored.

## Scope

- Add a `pnpm git:bundle` command.
- Create the bundle under `artifacts/source/` using the current commit in its
  filename.
- Include every local ref with `git bundle create <path> --all`.
- Verify the bundle contains refs, can be cloned to a temporary directory, and
  restores the current `HEAD` commit.
- Do not push, fetch, modify refs, or change existing source-archive/release
  commands.

## Script Contract

`scripts/git/build-bundle.mjs` will:

1. Resolve the repository root and current `HEAD` SHA.
2. Create `artifacts/source/synaploom-repository-<short-sha>.bundle`.
3. Delete only a pre-existing output file with that exact filename.
4. Run `git bundle create <bundle-path> --all` from the repository root.
5. Run `git bundle list-heads <bundle-path>` and require at least one ref.
6. Clone the bundle into a unique temporary directory outside the repository.
7. Compare cloned `HEAD` with the original full SHA, then remove that temporary
   clone.
8. Print the absolute bundle path on success.

## Package Interface

Add this package script:

```json
"git:bundle": "node scripts/git/build-bundle.mjs"
```

The command writes only generated artifacts under `artifacts/source/` and a
temporary verification clone. It is safe to rerun for the same commit.

## Verification

- Add Node tests that mock no Git state: invoke the script in a real temporary
  Git repository with two refs, then assert the bundle exists and is cloneable.
- Run the script in this repository and inspect `git bundle list-heads`.
- Run lint, typecheck, unit tests, and the new focused script test.

## Self-review

The design is a standalone packaging helper, preserves every repository ref,
and confines all generated files to established artifact or temporary paths.
