# Nova Learn — Local Course Player MVP Design

**Date:** 2026-07-15  
**Status:** Approved concept; written specification awaiting final review  
**Target release:** MVP / v0.1  
**Product form:** Open-source, local-first CLI application with a browser UI

## 1. Decision Summary

Nova Learn v0.1 is a focused local learning runtime rather than a hosted learning platform.

The learner imports a course represented by Markdown, JSON, assets, and optional starter files. Nova Learn validates the course, starts a loopback-only local server, opens the browser, and presents one lesson at a time in a split learning workspace.

The learning sequence is strictly linear inside the standard product experience:

```text
Open current lesson
→ read instructions
→ run or edit the exercise
→ check the result
→ satisfy completion rules
→ unlock the next lesson
```

The MVP intentionally excludes the previous broader scope around VS Code integration, AI tutoring, evidence graphs, checkpoints, incident simulations, oral defense, social features, and cloud services.

## 2. Product Goals

Nova Learn v0.1 must allow one local learner to:

1. Install and run Nova Learn from a CLI.
2. Validate and import a local course folder.
3. Open the course in a browser on `127.0.0.1`.
4. Resume the first incomplete lesson automatically.
5. Study lesson content and use the practice area on the same screen.
6. Execute only predefined exercise actions such as `run` and `check`.
7. Complete lessons in the declared order without normal UI or API navigation skipping.
8. Persist progress and exercise work locally.
9. Reset an exercise without modifying the imported course source.
10. Continue operating without any public backend or internet connection after installation and course acquisition.

## 3. Non-Goals

The MVP does not include:

- user accounts or authentication;
- cloud sync;
- hosted execution;
- marketplace or remote course catalog;
- social features, leaderboards, XP, badges, or streaks;
- adaptive learning paths;
- arbitrary lesson navigation;
- full interactive shell access;
- Docker as a mandatory dependency;
- browser-only code sandbox abstraction;
- VS Code extension;
- AI tutor;
- automatic code patching;
- Git checkpoints or evidence portfolios;
- authoring CMS;
- advanced analytics;
- multiple learner profiles.

## 4. Primary User Flow

### 4.1 Import and start

```bash
nova-learn course validate ./frontend-performance-foundations
nova-learn course import ./frontend-performance-foundations
nova-learn start frontend-performance-foundations
```

For course authors:

```bash
nova-learn dev ./frontend-performance-foundations
```

`dev` reads directly from the source folder and reloads course content when supported files change. `import` creates a validated, versioned installed copy for learners.

### 4.2 Runtime sequence

```text
CLI starts
→ opens local database
→ loads installed course
→ validates supported schema version
→ resolves current lesson
→ prepares lesson workspace
→ starts HTTP and event server on loopback
→ opens browser
→ restores progress and workspace state
```

### 4.3 Lesson completion

```text
Learner opens current lesson
→ lesson is marked IN_PROGRESS
→ learner executes predefined actions
→ checks return pass/fail results
→ completion engine evaluates required checks
→ lesson becomes COMPLETED
→ next lesson becomes AVAILABLE
→ course current lesson is advanced atomically
```

## 5. Learning Workspace UI

The learning view uses a compact split-pane layout optimized for sustained study.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Thin application header                                            │
├───────────────────────────────┬────────────────────────────────────┤
│ Lesson pane                   │ Practice pane                      │
│                               │                                    │
│ Breadcrumb and progress       │ Action toolbar                     │
│ Lesson title                  │ Terminal/editor output             │
│ Explanation                   │                                    │
│ Objectives                    │                                    │
│ Exercise instructions         │                                    │
│                               │                                    │
│ Optional compact helper dock  │ Check result / Submit              │
└───────────────────────────────┴────────────────────────────────────┘
```

### 5.1 UI principles

- The lesson and practice panes are the dominant surfaces.
- Both panes scroll independently.
- The divider is resizable and its position is saved locally.
- No dashboard cards are displayed inside the learning flow.
- The primary action remains visible at the bottom of the practice pane.
- Locked lessons are not selectable.
- Direct navigation to a locked lesson redirects to the current available lesson.
- The UI remains usable when an exercise has no editor and only needs command output.

### 5.2 MVP routes

```text
/                              → redirect to the active course/lesson
/courses                       → installed course list
/courses/:courseId             → redirect to current lesson
/courses/:courseId/lessons/:id → focused learning workspace
```

The course list is operational navigation, not a feature-rich dashboard.

## 6. System Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Browser — React Web App                                      │
│                                                              │
│ Learning Workspace                                           │
│ Course and lesson queries                                    │
│ File editor / output terminal                                │
│ Progress and check-result UI                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP + server-sent events/WebSocket
┌──────────────────────────▼───────────────────────────────────┐
│ Nova Learn CLI + Local Daemon                                │
│                                                              │
│ CLI Commands                                                 │
│ Local HTTP Server                                            │
│ Course Loader and Validator                                  │
│ Markdown Renderer Pipeline                                   │
│ Linear Progression Engine                                    │
│ Workspace Manager                                            │
│ Allowlisted Exercise Runner                                  │
│ Local Progress Repository                                    │
└───────────────┬───────────────────────┬──────────────────────┘
                │                       │
┌───────────────▼──────────────┐  ┌─────▼─────────────────────┐
│ Installed Course Files       │  │ Local Application State   │
│ MD / JSON / assets / starter │  │ SQLite + workspaces       │
└──────────────────────────────┘  └───────────────────────────┘
```

### 6.1 Deployment units

MVP ships as one CLI package containing or locating:

- the CLI entry point;
- the local daemon;
- the built web application;
- bundled JSON Schemas;
- database migrations.

There is no independently deployed backend.

### 6.2 Loopback policy

The daemon binds to `127.0.0.1` by default, not `0.0.0.0`.

The CLI selects an available port and opens a URL containing an ephemeral bootstrap token. The web application removes the token from the visible URL and keeps it in memory only for that daemon session.

This token prevents unrelated browser pages from casually calling the local daemon. It is not a user-authentication system.

## 7. Module Boundaries

### 7.1 CLI

Responsibilities:

- parse commands and flags;
- locate configuration and local state;
- import, remove, list, validate, and start courses;
- start and stop the daemon;
- open the browser;
- provide diagnostics through `nova-learn doctor`.

### 7.2 Course Loader

Responsibilities:

- load `course.json`;
- resolve lesson paths inside the course root;
- parse lesson front matter and Markdown;
- load optional `exercise.json`;
- expose an immutable normalized course model.

It does not own learner progress or execute commands.

### 7.3 Course Validator

Responsibilities:

- validate schemas;
- reject duplicate course or lesson IDs;
- require contiguous lesson order;
- ensure referenced files exist;
- prevent absolute paths and path traversal;
- reject unsafe symlinks;
- validate action commands and runtime requirements;
- provide actionable author-facing diagnostics.

### 7.4 Progression Engine

Responsibilities:

- determine the current lesson;
- calculate lesson status;
- reject access to locked lessons;
- evaluate theory, practice, and mixed completion rules;
- complete one lesson and unlock the next in one transaction;
- complete the course after its final lesson.

The progression engine is authoritative. The React client never decides whether a lesson is complete.

### 7.5 Workspace Manager

Responsibilities:

- create a learner-owned working copy from lesson starter files;
- restrict file APIs to that workspace;
- read and save editable files;
- reset a lesson from the installed immutable course copy;
- preserve drafts between application restarts.

### 7.6 Exercise Runner

Responsibilities:

- resolve an action by action ID, never by raw command from the browser;
- start local child processes in the lesson workspace;
- stream bounded stdout and stderr;
- enforce timeout and output limits;
- terminate running processes when the lesson, browser session, or daemon closes;
- return normalized exit and check results.

### 7.7 Progress Repository

Responsibilities:

- run SQLite migrations;
- store installed courses and active versions;
- store course and lesson progress;
- store attempts and normalized check results;
- store UI preferences such as pane ratio;
- support export, backup, and safe recovery later without changing domain rules.

## 8. Course Package Format v1

```text
frontend-performance-foundations/
├── course.json
├── README.md
├── assets/
├── lessons/
│   ├── 01-main-thread/
│   │   ├── lesson.md
│   │   ├── exercise.json          # optional
│   │   ├── starter/               # optional
│   │   ├── checks/                # optional
│   │   └── solution/              # optional, not exposed by default
│   └── 02-event-loop/
│       └── ...
└── LICENSE
```

### 8.1 `course.json`

```json
{
  "$schema": "https://nova-learn.dev/schemas/course-v1.json",
  "schemaVersion": "1.0",
  "id": "frontend-performance-foundations",
  "title": "Frontend Performance Foundations",
  "description": "Learn frontend performance from first principles.",
  "version": "1.0.0",
  "language": "vi",
  "lessons": [
    {
      "id": "main-thread",
      "position": 1,
      "path": "lessons/01-main-thread"
    },
    {
      "id": "event-loop",
      "position": 2,
      "path": "lessons/02-event-loop"
    }
  ]
}
```

The array order is canonical. `position` must match the array index plus one and must be contiguous.

### 8.2 `lesson.md`

````markdown
---
id: event-loop
title: Event Loop
position: 2
type: mixed
estimatedMinutes: 25
exercise: exercise.json
---

# Event Loop

Event Loop is the mechanism that coordinates synchronous work and queued callbacks.

## Learning objectives

- Explain the call stack.
- Distinguish tasks and microtasks.
- Predict execution order.

## Exercise

Run:

```bash
node event-loop-demo.js
```
````

````

MVP supports standard Markdown plus a restricted set of known callout directives. It does not execute MDX or arbitrary embedded components.

### 8.3 `exercise.json`

```json
{
  "$schema": "https://nova-learn.dev/schemas/exercise-v1.json",
  "schemaVersion": "1.0",
  "id": "event-loop-practice",
  "title": "Observe Event Loop ordering",
  "runtime": {
    "kind": "local",
    "requires": ["node>=20"]
  },
  "workspace": {
    "starter": "starter",
    "editable": ["event-loop-demo.js"]
  },
  "actions": {
    "run": {
      "label": "Run",
      "executable": "node",
      "args": ["event-loop-demo.js"],
      "timeoutMs": 10000
    },
    "check": {
      "label": "Check result",
      "executable": "node",
      "args": ["--test", "checks/event-loop.test.js"],
      "timeoutMs": 20000
    }
  },
  "checks": [
    {
      "id": "script-runs",
      "title": "Program exits successfully",
      "required": true
    },
    {
      "id": "expected-order",
      "title": "Output has the expected ordering",
      "required": true
    }
  ],
  "completion": {
    "requireAllRequiredChecks": true
  }
}
````

The browser sends `run` or `check`. It never sends `node --test ...` as an arbitrary string.

## 9. Linear Progression Model

### 9.1 Lesson states

```text
LOCKED
AVAILABLE
IN_PROGRESS
COMPLETED
```

### 9.2 Access rule

- Lesson 1 is `AVAILABLE` when a course is started.
- Lesson N is accessible only when lesson N-1 is `COMPLETED`.
- A completed lesson may be reopened for review.
- Reopening a completed lesson does not change the current course lesson.
- The standard UI exposes only the current lesson and completed lessons; future lessons remain locked.

### 9.3 Completion rules

| Lesson type | Required completion condition                                      |
| ----------- | ------------------------------------------------------------------ |
| `theory`    | Learner reaches the end and explicitly selects **Complete lesson** |
| `practice`  | All required checks pass                                           |
| `mixed`     | Reading acknowledgement and all required checks pass               |

### 9.4 Atomic completion

The following changes occur in one SQLite transaction:

1. save the passing attempt;
2. set current lesson to `COMPLETED`;
3. set the next lesson to `AVAILABLE`, when one exists;
4. update `course_progress.current_lesson_id`;
5. mark the course complete when there is no next lesson.

Repeated completion requests are idempotent.

## 10. Local Storage Layout

```text
~/.nova-learn/
├── config.json
├── courses/
│   └── <course-id>/<version>/
├── workspaces/
│   └── <course-id>/<version>/<lesson-id>/
├── state/
│   └── nova-learn.db
├── logs/
└── runtime/
```

The imported course copy is immutable from Nova Learn's learner workflow. Exercises modify only their workspace copy.

Removing an installed course does not delete learner work unless the learner explicitly requests workspace deletion.

## 11. Local Database Model

### 11.1 Installed courses

```text
installed_courses
- course_id
- version
- title
- source_path
- install_path
- content_hash
- trusted_at
- installed_at
```

### 11.2 Course progress

```text
course_progress
- course_id
- course_version
- current_lesson_id
- started_at
- completed_at
```

### 11.3 Lesson progress

```text
lesson_progress
- course_id
- course_version
- lesson_id
- status
- reading_acknowledged
- started_at
- completed_at
- last_opened_at
```

### 11.4 Attempts

```text
exercise_attempts
- id
- course_id
- course_version
- lesson_id
- action_id
- exit_code
- timed_out
- result_json
- created_at
```

### 11.5 Preferences

```text
preferences
- key
- value_json
- updated_at
```

## 12. Local API and Event Protocol

### 12.1 HTTP endpoints

```text
GET    /api/runtime
GET    /api/courses
POST   /api/courses/import
GET    /api/courses/:courseId
GET    /api/courses/:courseId/current-lesson
GET    /api/courses/:courseId/lessons/:lessonId
POST   /api/courses/:courseId/lessons/:lessonId/start
POST   /api/courses/:courseId/lessons/:lessonId/reading-complete
GET    /api/courses/:courseId/lessons/:lessonId/workspace/files
PUT    /api/courses/:courseId/lessons/:lessonId/workspace/files/:path
POST   /api/courses/:courseId/lessons/:lessonId/workspace/reset
POST   /api/courses/:courseId/lessons/:lessonId/actions/:actionId
POST   /api/courses/:courseId/lessons/:lessonId/complete
```

The `complete` endpoint re-evaluates stored authoritative results. Client-provided `passed: true` is never accepted as evidence.

### 12.2 Process events

```text
process.started
process.stdout
process.stderr
process.exited
process.timed_out
process.killed
```

Every event contains a runtime session ID and lesson ID. Output is capped to prevent unbounded browser or daemon memory growth.

## 13. Trust and Security Model

Local execution reduces infrastructure complexity but does not make imported courses safe.

### 13.1 Trust confirmation

Before a course can execute actions, Nova Learn displays:

- source path;
- declared author and version;
- required executables;
- every executable and argument template;
- editable and readable workspace paths;
- warning that imported course code executes with the learner's operating-system account.

The learner must explicitly trust the exact installed course version and content hash.

A content change invalidates prior trust until the learner approves the new hash.

### 13.2 Execution restrictions

MVP enforces:

- no raw shell command from the browser;
- executable and arguments are stored separately;
- `shell: false` for child processes;
- action IDs must exist in validated course content;
- working directory must resolve inside the lesson workspace;
- environment variables are filtered;
- command duration and output are bounded;
- all child processes are terminated on daemon shutdown;
- paths cannot escape through `..`, absolute paths, or symlinks.

These restrictions reduce accidental and opportunistic abuse. They do not provide a strong sandbox against a malicious executable intentionally trusted by the learner.

### 13.3 Open-source limitation

Because Nova Learn, its SQLite database, and course files are local and modifiable, linear progression is a product rule rather than a tamper-proof security boundary. A technically capable user can modify local state or source code. The MVP does not attempt DRM or anti-cheat controls.

## 14. Error Handling

The UI must provide recoverable states for:

- unsupported course schema;
- broken course references;
- missing required runtime;
- untrusted course version;
- locked lesson URL;
- workspace creation failure;
- file changed externally;
- command start failure;
- timeout;
- excessive output;
- daemon restart or browser reconnect;
- corrupted SQLite database;
- occupied port.

Examples:

```text
RUNTIME_MISSING
Node.js >= 20 is required for this exercise.
Detected: Node.js 18.18.0
```

```text
LESSON_LOCKED
Complete “Event Loop” before opening “Long Tasks”.
```

```text
COURSE_TRUST_REQUIRED
The imported course content changed after it was trusted.
Review the new executable actions before continuing.
```

## 15. Recommended Monorepo Structure

```text
nova-learn/
├── apps/
│   ├── cli/
│   ├── daemon/
│   └── web/
├── packages/
│   ├── contracts/
│   ├── course-schema/
│   ├── course-loader/
│   ├── course-validator/
│   ├── lesson-renderer/
│   ├── progression/
│   ├── workspace/
│   ├── exercise-runner/
│   ├── local-database/
│   ├── security/
│   └── ui/
├── examples/
│   └── frontend-performance-foundations/
├── docs/
│   ├── architecture/
│   ├── course-authoring/
│   └── user/
└── tests/
    ├── e2e/
    ├── fixtures/
    └── security/
```

This is a modular monolith. Package boundaries exist for ownership and testing, not independent deployment.

## 16. Testing Strategy

### 16.1 Unit tests

- course and exercise schema validation;
- path normalization and traversal rejection;
- contiguous lesson order;
- lesson-state transitions;
- completion rules;
- executable and argument validation;
- output and timeout limits;
- workspace reset behavior.

### 16.2 Integration tests

- import course into a temporary local home;
- initialize and migrate SQLite;
- create a workspace from starter files;
- start an allowlisted process and stream output;
- save a passing attempt and unlock the next lesson;
- restart the daemon and restore progress;
- reject a changed course until re-trusted.

### 16.3 End-to-end tests

```text
Start a fresh application
→ import a valid two-lesson course
→ open lesson 1
→ attempt direct navigation to lesson 2 and get redirected
→ complete lesson 1
→ verify lesson 2 unlocks
→ edit a starter file
→ run check and fail
→ fix the file
→ run check and pass
→ restart the CLI
→ verify lesson 2 remains current and the workspace is preserved
```

### 16.4 Security regression tests

- `../` workspace path;
- absolute file path;
- symlink escaping the workspace;
- raw command injection attempt;
- unknown action ID;
- browser request without a daemon session token;
- daemon accidentally binding to external interfaces;
- unbounded process output;
- orphan child process after shutdown.

## 17. MVP Acceptance Criteria

The MVP is complete when a fresh machine with the documented prerequisites can:

1. install the CLI;
2. run `nova-learn doctor`;
3. validate and import the example course;
4. review and trust the course's declared actions;
5. start Nova Learn and open the browser locally;
6. display the approved focused split-pane learning interface;
7. open only lesson 1 on a fresh course;
8. reject direct access to lesson 2 before lesson 1 completion;
9. read a Markdown lesson with code, lists, images, and callouts;
10. edit a file in the lesson workspace;
11. run predefined `run` and `check` actions with streamed output;
12. fail and retry a check without losing work;
13. complete lesson 1 and unlock lesson 2 atomically;
14. restart the CLI without losing progress or workspace files;
15. reset the lesson workspace from starter files;
16. operate without a public internet connection;
17. pass unit, integration, E2E, content-validation, and security tests.

## 18. Deferred Evolution

Possible later additions, each designed as a separate feature rather than an MVP dependency:

- interactive shell mode;
- local Docker/Podman runtime;
- VS Code integration;
- AI assistant;
- richer lesson blocks;
- quizzes;
- course update and migration support;
- signed course releases;
- course discovery and optional public registry;
- progress export/import;
- multiple learner profiles;
- evidence and project checkpoints.

## 19. Resolved Decisions

- Local-first open-source application.
- CLI starts a loopback-only daemon and browser UI.
- Courses are imported from Markdown and JSON packages.
- Imported course content is validated and copied into a versioned installation.
- Learner edits occur only in separate workspaces.
- SQLite stores local operational state.
- Lessons progress linearly without normal skipping.
- Only validated, predefined action IDs can start processes.
- Courses require explicit trust before any code execution.
- The MVP uses a command runner, not a full interactive shell.
- The focused light split-pane learning workspace is the UI baseline.
- No cloud backend, authentication, AI, VS Code extension, or advanced simulation is required for v0.1.
