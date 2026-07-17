# Synaploom Course Format v1

A course is a normal directory that can be version controlled and distributed as an archive.

```text
course/
├── course.json
├── README.md
└── lessons/
    └── 01-example/
        ├── lesson.md
        ├── exercise.json
        ├── starter/
        └── checks/
```

## `course.json`

Required fields:

- `schemaVersion`: exactly `"1.0"`.
- `id`: stable kebab-case course identifier.
- `title`: display title.
- `description`: concise course description.
- `version`: semantic version such as `1.0.0`.
- `language`: course language code.
- `lessons`: ordered array of `{ id, position, path }`; positions must be contiguous from 1.

Optional fields: `$schema`, `author`.

## `lesson.md`

Each lesson begins with front matter:

```markdown
---
id: event-loop
title: Event Loop
position: 2
type: mixed
estimatedMinutes: 20
exercise: exercise.json
---
```

`type` is `theory`, `practice`, or `mixed`. Standard Markdown is supported: headings, paragraphs, lists, links, images, fenced code, and known callouts such as `[!NOTE]`, `[!HINT]`, and `[!WARNING]`.

MDX and arbitrary embedded components are not executed. Raw HTML is escaped by the lesson renderer.

## `exercise.json`

Required fields:

- `schemaVersion`: `"1.0"`.
- `id`, `title`.
- `runtime.kind`: `"local"`.
- `runtime.requires`: executable names learners need.
- `workspace.starter`: optional starter directory.
- `workspace.editable`: relative files the web editor may modify.
- `actions`: map from safe action ID to `{ label, executable, args, timeoutMs, maxOutputBytes? }`.
- `checks`: `{ id, title, required }` entries.
- `completion.requireAllRequiredChecks`: completion policy.

Executable values must be command names, not shell strings or paths. Arguments are passed directly with `shell: false`. The browser sends only the action ID.

## Starter and checks

Starter files are copied only when a learner workspace is first created or reset. Learner edits never modify the imported course.

A lesson-level `checks/` directory is synchronized to `.synaploom/checks/` inside the runtime workspace before actions run. It is not exposed as editable through the web API. A check action can therefore use:

```json
{
  "executable": "node",
  "args": [".synaploom/checks/example.test.js"]
}
```

The learner can still inspect or modify local files outside Synaploom because this is an open-source local application, not a hostile-code security boundary.

## Native runtime compatibility

Course format version 1 remains backward-compatible across the Node 0.1.x reference runtime and the native Go core. Existing manifests and Markdown lessons require no modification.
