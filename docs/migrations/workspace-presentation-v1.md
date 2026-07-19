# Workspace Presentation v1 migration

Workspace Presentation v1 replaces the coding-only split decision with owner-scoped backend state. The migration does not alter Activity Engine answers, attempts, scoring, reveal rules, progression requirements, or canonical lesson and assessment URLs.

## Persistence model

SQLite migration `005_workspace_presentation.sql` creates one row per `profile_id + course_id + owner_kind + owner_id`. Version 1 uses profile `local`. A row stores `focusedActivityId`, pane mode, Theory Pane `splitRatio`, `userCollapsed`, optimistic `revision`, and `updatedAt`. It never stores answers, source code, essay text, prompts, feedback bodies, tokens, or keys.

Every update supplies the expected revision. A stale update returns HTTP 409 with code `WORKSPACE_PRESENTATION_CONFLICT` and `details.currentWorkspacePresentation`. Clients retain their mounted activity and retry the original intent only after surfacing the conflict.

## Legacy pane ratio

The previous `/api/v1/preferences/pane-ratio` route was a constant compatibility stub, so there is no user value to migrate. The new split default is `0.45` Theory Pane width and is clamped to `[0.32, 0.68]`. The compatibility route remains available during this release, but the current frontend no longer calls it.

## First-open behavior

When no row exists, normalized activity presentation determines the initial state. The first required activity whose policy resolves to practice is focused in split mode; an optional candidate is used only when no required candidate exists. Existing coding lessons therefore focus their first required coding activity with ratio `0.45`. Reading-only and inline-only owners start collapsed with `focusedActivityId = null`.

After a learner explicitly collapses a focused activity, `userCollapsed = true` is persisted. That learner preference outranks later authored defaults. Opening or restoring practice clears `userCollapsed`. Returning inline clears `focusedActivityId` and keeps the pane collapsed.

## Invalid references and restart

If course authoring removes an activity referenced by persisted state, or its normalized policy no longer allows practice, the service clears the invalid `focusedActivityId`, stores collapsed state with one revision increment, and emits a redacted recovery event. Theory content remains usable. SQLite state is authoritative and survives refresh, runtime restart, and reopening the owner; no localStorage or IndexedDB migration is introduced.

## Course authoring compatibility

Activity definitions may omit `presentation`. Public views always expose a normalized policy, so old activity packages require no data rewrite. Legacy coding exercises adapted into Activity Engine continue to receive coding defaults. Authors should add explicit policy only when the desired surface differs from system behavior or when deterministic example and assessment coverage is required.
