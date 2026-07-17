# ADR 0003: Hierarchical progression

## Status

Accepted.

## Decision

Course `schemaVersion 1.1.0` introduces chapters, required and optional lessons, and chapter assessments. V1 uses strict sequential progression for required content. Optional content never blocks required progression.

The Go requirement engine is authoritative. It persists `bestResult and latestResult` separately: the best passing result satisfies requirements, while a later failed review remains informational. The browser receives backend-authored navigation and next actions.

`currentLessonId and viewedLessonId` are separate. Opening completed content enters review mode; review mode does not rollback progression or mutate the persisted current target.

Course Schema 1.0 implicit chapter migration normalizes the existing linear lesson list into an internal `default` chapter.

## Rejected alternatives

All-open chapters weaken the guided learning contract. A prerequisite DAG adds authoring and diagnostic complexity that is not justified for V1. Client-side unlock evaluation would duplicate policy and create inconsistent state.
