# Getting Started

## Prerequisites

- Node.js 22.13.0 or newer.
- A local course directory containing `course.json` and lesson Markdown files.
- Any runtime required by the course actions, such as `node`, installed on the learner machine.

Synaploom does not require a public server, user account, Docker, or internet access after the CLI and course have been acquired.

## Install and diagnose

```bash
Download the native Synaploom binary for your platform.
synaploom doctor
```

`doctor` verifies the Node version, write access to the Nova home directory, and local SQLite availability.

Default local data location:

```text
~/.synaploom/
├── courses/       immutable imported copies
├── workspaces/    learner-editable lesson files
├── state/         synaploom.db
├── runtime/
└── logs/
```

Override it with `SYNAPLOOM_HOME=/another/path`.

## Validate, import, and trust

```bash
synaploom course validate ./frontend-performance-foundations
synaploom course import ./frontend-performance-foundations
```

Before trust is granted, the CLI prints the exact SHA-256 hash, required executables, and every declared action. Trust applies only to that course ID, version, and content hash.

For a source you have already reviewed:

```bash
synaploom course import ./frontend-performance-foundations --trust
```

Import never executes course actions.

## Learn

```bash
synaploom course list
synaploom start frontend-performance-foundations
```

The CLI starts a loopback-only daemon on a random port and opens a one-time bootstrap URL. Lessons are unlocked in order. Progress and workspaces survive restart.

Course authors can preview a source directory directly:

```bash
synaploom dev ./frontend-performance-foundations
```

The current MVP validates before startup; restart `dev` after changing course structure or manifests.

## Reset and uninstall

The web workspace can reset the current exercise to its starter files. Removing the global package does not delete `~/.synaploom`. Delete that directory separately only when you intentionally want to remove installed courses, progress, and learner work.

## Chapters, assessments, and review

The navigator marks required and optional lessons explicitly. After all required lesson requirements are satisfied, chapter assessments become available. Opening a completed lesson enters review mode; review mode does not rollback progression. Use the return action to go back to the current learning target.
