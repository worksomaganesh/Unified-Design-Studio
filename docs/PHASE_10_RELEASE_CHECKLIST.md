# Phase 10 — Testing, optimization and release checklist

**Progress:** 20% complete; 80% remains. Automated checks and the first editor-loading optimization are complete. This checklist distinguishes those machine-verified results from the manual and broader release checks that are still open.

## Completed and verified in this work session

- [x] Run the configured automated suite: **34 tests passed, 0 failed** (`pnpm test`). This includes review migration/recovery coverage and HTTP mutation-origin integration tests.
- [x] Typecheck the Studio, local API, AI engine, design core, and renderer (`pnpm typecheck`).
- [x] Build the Studio for production (`pnpm --filter @uds/studio exec vite build`).
- [x] Split the design system, AI Studio, prototype, preview, handoff, and review panels into on-demand chunks. The main JavaScript bundle changed from 518.39 kB (148.96 kB gzip) to 424.72 kB (122.01 kB gzip), about an 18% decrease; the oversized-chunk warning cleared.
- [x] Add automated checks for allowed and rejected loopback Origins, Fetch Metadata, all four HTTP mutation methods, and unaffected read requests; reject writes at request start before body parsing.
- [x] Document the local-only request guard as CSRF defense-in-depth, not authentication.

## Manual review for the project owner

- [ ] Open the local Studio in Chrome and exercise project creation, canvas editing, save, review comments, revision comparison/restore, and stale-save recovery.
- [ ] Confirm the first-use loading state and each on-demand panel opens correctly in the running app.
- [ ] Review canvas and panels at laptop and desktop sizes; check keyboard use, focus return, Escape behavior, screen-reader labels, contrast, and reduced-motion behavior.
- [ ] Review one representative Figma import/Variables workflow and one Penpot import; live account and sample-file verification remains open in Phase 8.
- [ ] Review generated React/HTML handoff output and sandboxed prototype interactions.

## Technical release checks still open

- [ ] Add browser-level interaction tests and visual regression coverage using a chosen browser-test environment.
- [ ] Complete a security review covering path traversal/symlinks, upload limits and signatures, preview CSP/message handling, secrets, dependency advisories, and the local-only service boundary. Current automated Origin tests are not a full security audit.
- [ ] Run accessibility tooling and resolve findings; no automated browser accessibility audit was run in this pass.
- [ ] Measure startup and interaction performance on the target laptop and decide whether further splitting or rendering work is needed.
- [ ] Verify clean install, Windows startup/credential behavior, app data backup/restore, and packaged launch behavior.
- [ ] Complete the release notes, known-limitations list, final smoke checks, and release/version decision.

## Current release boundary

The project is not production-ready yet. In particular, Phase 9 still has no verified user identity, project roles, shared-project synchronization, or specialist-agent task/approval flow. The local Origin guard reduces browser-based cross-site request risk but does not authenticate local processes or authorize users. Desktop review and live external-provider workflows are also still pending.
