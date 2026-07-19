# Activity Engine security boundaries

Activity Engine treats imported courses as trusted local data with tightly constrained execution boundaries. Rich content is data, not application code. The browser is untrusted for progression, scoring, answer keys, filesystem access, and process execution.

## Content boundary

The Go parser converts Markdown into allowlisted typed nodes. Raw HTML and scripts are never executed. Links accept safe local destinations and approved schemes. Media paths must remain inside the course package; strict validation rejects remote media, traversal, missing files, and incomplete accessibility metadata. The React renderer renders known node kinds and fails closed for unknown structures.

## Answer-key boundary

Private activity definitions contain correct answers and evaluator configuration. Public activity views are produced by an explicit allowlist and omit `correctOptionId`, `correctOptionIds`, `correctMatches`, expected numeric values, and accepted text answers. Evaluation happens in Go. Correct answers appear in feedback only when `revealAnswers` permits them for the current attempt.

## Attempt boundary

Every attempt is keyed by course, owner kind, owner ID, activity ID, and attempt number. Draft updates require the latest revision. Submitted and evaluated attempts are immutable. Idempotency keys prevent duplicate submissions when the browser retries a request. Maximum-attempt rules are enforced by the service, not by disabled browser controls alone.

## Coding boundary

Coding activity configuration may name an executable, argument vector, timeout, output limit, starter directory, and editable files. The browser sends an action ID only. The native runtime resolves the authored allowlist, contains paths under the activity workspace, rejects traversal and symlink escape, avoids shell interpolation, limits output and runtime, and terminates the process tree. Lesson-owned and assessment-owned coding workspaces are isolated by owner and activity identity.

Imported code runs with the learner operating-system permissions. Authors and distributors must review coding packages as trusted local code. Synaploom does not claim container or virtual-machine isolation.

## AI and open responses

AI cannot mark an activity passed, unlock progression, choose an authoritative score, or execute a coding action. Long-form writing v1 is stored as inert text or safe Markdown and completes by submission. Future AI rubric grading, speech analysis, uploads, peer review, and simulations require explicit consent, retention, redaction, and review policies before they can become authoritative.

## Operational controls

Runtime HTTP binds to loopback, uses a one-time bootstrap token and HTTP-only session cookie, and returns structured error codes. Release verification must include contract generation, Go tests, DOM accessibility tests, multi-domain browser acceptance, native artifact checks, and validation of legacy plus 1.2 example courses.

## Workspace presentation boundary

Workspace presentation persistence contains layout state only: owner/profile identifiers, `focusedActivityId`, pane mode, split ratio, `userCollapsed`, revision, and timestamp. Structured workspace events use an explicit allowlist and must not include answers, source code, essay text, prompts, evaluator feedback bodies, tokens, or keys. Save-before-switch calls Activity Engine persistence first; a failed save blocks the presentation mutation so the editable renderer and learner content remain mounted.
