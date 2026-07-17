# Native Go Core Architecture

Synaploom ships one native Go executable. React and TypeScript remain responsible for the browser UI, design system, authoring utilities, generated contracts, and browser tests.

The executable owns CLI dispatch, loopback HTTP and SSE, embedded Web assets, course import and validation, workspace lifecycle, trusted process supervision, sequential progression, SQLite persistence, optional AI providers, diagnostics, and graceful shutdown.

Canonical JSON Schema 2020-12 files under `schemas/v1` define all wire and persisted compatibility contracts. Generated Go and TypeScript declarations are checked in and protected by drift gates.

## Security boundaries

The browser sends trusted action identifiers rather than command strings. Go resolves an explicit program and argument vector and never invokes a shell for standard actions. Local HTTP binds to `127.0.0.1`, uses a one-time bootstrap exchange, validates Host and Origin, and stores the session in an HTTP-only SameSite cookie. Imported course actions execute with the learner's OS permissions and are trusted code, not sandboxed workloads.

## Runtime lifecycle

Application shutdown cancels runner sessions, stops HTTP listeners, closes storage, and flushes bounded logs. Process streams emit exactly one terminal event and close without replay loops.

## Requirement engine and learner navigation

The Go progression engine owns completion, unlocks, review navigation, and backend-authored next actions. It stores `bestResult and latestResult` independently. The browser never infers unlock state. `currentLessonId and viewedLessonId` remain separate, and review mode does not rollback progression.
