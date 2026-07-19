# Activity Engine manual verification

Use this guide after automated checks pass. Start with a clean `SYNAPLOOM_HOME` so prior attempts do not hide initialization defects.

## Prepare

```bash
pnpm install --frozen-lockfile
pnpm go:stage-web
pnpm validate:example
pnpm validate:multi-domain
bash scripts/go/with-internal-toolchain.sh run ./cmd/synaploom dev examples/multi-domain-foundations
```

Open the one-time bootstrap URL printed by the runtime.

## Navigation and rich content

Confirm the top step bar shows only items from the viewed chapter. Previous, next, chapter selector, item selector, and curriculum popover must still cross chapter boundaries. Inspect tables, nested lists, callouts, definitions, worked examples, inline and display math, safe links, figures, transcripts, attachments, and embedded activities. Missing or invalid local media should be caught by validation before runtime.

## Ten activity kinds

Complete every activity in the multi-domain course: single choice, multiple choice, true/false, short answer, fill blanks, ordering, matching, numeric, writing, and coding. Use keyboard only for a second pass. Ordering must work through move controls; matching must work with labeled selects; radio and checkbox groups must expose their legends; feedback must receive focus or be announced after submission.

For writing, verify submission records completion without a numeric score or invented correctness claim. For coding, edit the starter file, save, run, check, inspect terminal output, restart the runtime, and confirm workspace persistence.

## Attempts and security

Save a draft, restart, and confirm restoration. Submit an answer, repeat the same request through normal retry behavior, and verify no duplicate attempt is created. Exhaust a limited assessment attempt policy and verify the server rejects further attempts. Inspect network responses and confirm answer-key fields are absent before reveal policy permits them.

## Progression and assessment

Complete required lesson activities before reading acknowledgement. Confirm the next lesson or assessment remains locked until all required work is satisfied. Enter the final assessment from the same learning shell, complete its activities, and verify the course completion state appears without a synthetic summary route. Review an earlier lesson and confirm current progression does not move backward.

## Commands to capture when reporting a failure

Provide the first failing command, complete output, current commit, `node --version`, `pnpm --version`, `go version`, `GOTOOLCHAIN=local go env GOVERSION GOOS GOARCH`, the browser URL, screenshot, and Playwright trace path. For coding failures, include the action ID, exit code, bounded terminal output, and owner/activity route.
