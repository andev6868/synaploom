# Migrating to Course Schema 1.2

Course Schema 1.2 adds hierarchical rich content and the generic Activity Engine while preserving runtime support for existing 1.0 and 1.1 packages. Migration can be incremental: an existing coding exercise continues to run through the compatibility adapter, while new non-coding practice is authored as activity sets.

## Manifest version

Change the root manifest to:

```json
{ "schemaVersion": "1.2.0", "id": "my-course", "version": "1.2.0" }
```

Keep chapter, lesson, assessment, and required flags from 1.1. Version 1.0 linear courses remain valid and are normalized into a default chapter by the runtime.

## Lesson migration

A legacy lesson may contain:

```yaml
exercise: exercise/exercise.json
```

You may retain that field. The runtime adapts it to a `coding` activity and keeps the editor, terminal, run/check actions, workspace persistence, and progression semantics.

For new content, create `activities/practice.json`, activity files, and replace or supplement the front matter with:

```yaml
activitySets:
  - activities/practice.json
```

Use `:::activity id="..."` in Markdown to place an activity between explanation blocks. Unembedded activities are appended in set order.

## Assessment migration

Legacy coding assessments remain supported through an adapter. A native 1.2 assessment directory contains `assessment.json` with an `activitySet` path and one activity set whose policy purpose is `assessment`. The assessment appears in the same learning workspace shell as lessons and derives completion from set progress rather than a synthetic pass button.

## Behavioral differences

- Attempts are persistent, revisioned, immutable after submission, and idempotent.
- Activity IDs are scoped by lesson or assessment owner.
- Answer keys are removed from browser payloads.
- Writing completes by submission and has no fabricated automatic score.
- `course validate` parses lesson documents and local media in strict mode.
- Navigation titles come from authored lesson and assessment titles rather than technical IDs.

## Recommended migration sequence

1. Run the current validator and preserve a passing baseline.
2. Upgrade the root schema version.
3. Convert one practice at a time to an activity set.
4. Verify attempt restart and progression behavior.
5. Convert chapter assessments after their lesson activities are stable.
6. Add rich directives and media with complete accessibility metadata.
7. Run the old example, the migrated course, and the multi-domain example in CI.

No migration should delete learner workspaces or progress databases. Course identity and version determine persistence ownership; publish a deliberate version change when content identity or required progression changes.
