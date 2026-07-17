# Security Model

## Trust boundary

Importing a course is safe with respect to execution: validation and copying do not run actions. Running a trusted course is equivalent to running reviewed local development commands under the learner's operating-system account.

Synaploom is not a strong sandbox. Course actions can access anything permitted to that OS account unless the learner adds an external sandbox such as a container or restricted user account.

## Controls in v0.1

- The daemon binds only to `127.0.0.1` and uses an ephemeral port.
- A random bootstrap token establishes an HttpOnly, SameSite=Strict local session cookie.
- The token is held in memory and accepted once.
- Protected APIs reject missing sessions.
- Course paths reject absolute paths, traversal, NUL bytes, and escaping symlinks.
- Imported course copies are made read-only; learner changes live in separate workspaces.
- The browser can edit only files listed in `workspace.editable`.
- The browser sends action IDs, never executable names, arguments, or raw shell commands.
- Processes use `spawn(executable, args, { shell: false })` with a filtered environment, timeout, output cap, and shutdown cleanup.
- Exact-hash trust is invalidated whenever course content changes.
- Evaluator files under `checks/` are refreshed into a non-editable internal workspace path before action execution.

## Explicit limitations

A learner owns the local machine, source code, database, and imported content. A technically capable learner can modify them and bypass progression. Linear locking is a pedagogical product rule, not DRM.

Filesystem permissions do not protect against the same local user. Evaluator synchronization prevents accidental edits through the normal UI; it cannot defend against deliberate host-level tampering.

Only import and trust courses from sources you understand. Review the displayed executable and action summary before approval.

## Native Go controls

The installed runtime is a native Go executable. Standard course actions use explicit executable and argument vectors without a shell, bounded output, cancellation, timeout enforcement, process-tree termination, loopback-only HTTP, and one-time bootstrap sessions.
