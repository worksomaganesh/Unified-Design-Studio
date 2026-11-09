# Development backlog

This backlog translates the product architecture into independently reviewable slices. Phase completion is based on the roadmap exit gates, not on a count of tickets.

## Phase 1 — Product architecture and technical specification

- [x] Architecture and trust boundaries documented.
- [x] Canonical document and initial layer/node hierarchy documented.
- [x] AI provider and revision-aware mutation architecture documented.
- [x] Rendering and export pipeline documented.
- [x] Storage/versioning architecture and SQLite schema specified.
- [x] API contracts and security boundaries specified.
- [x] Initial Zod document model and deterministic HTML renderer scaffolded.
- [x] Phase 1 backlog established.
- [ ] Run schema/renderer validation and resolve implementation issues.
- [ ] Approve package/tooling decisions and migration ownership before Phase 2.

## Phase 2 — Application foundation and workspace

- [x] Create pnpm workspace and shared TypeScript configuration.
- [x] Bootstrap React/Vite studio shell with workspace navigation and responsive project views.
- [x] Implement local project create/list/open endpoints and project shell.
- [x] Add SQLite-backed project/document/revision creation and schema migration marker.
- [x] Complete project rename/archive UI and project reopening of document snapshots.
- [x] Implement project-scoped asset upload/list/remove service for common raster formats.
- [x] Add persistent workspace settings and reject unknown settings fields; provider secrets are deliberately never accepted by the UI/API.
- [x] Add keyboard command palette and project CRUD interactions.
- [x] Install dependencies and typecheck the studio, local API and design core.
- [ ] Complete an end-to-end browser workflow check for project and asset operations.

**Current implementation slice:** React/Vite shell plus Fastify/SQLite local service; workspace and project landing/detail pages; project create/list/open/rename/archive; initial blank document snapshot persisted as a revision; project-scoped image asset upload/list/remove; persistent appearance/provider preferences with a strict API allowlist that rejects credential fields; Ctrl+K command palette and Ctrl+N new-project shortcut. Phase exit gate (create and reopen a local project) is implemented. Browser-level workflow verification remains; OS credential-vault integration belongs with provider execution in Phase 5, before the app accepts any API key.

## Phase 3 — Core design canvas and rendering engine

- [ ] Implement canvas viewport with pan/zoom and responsive frame presets.
- [ ] Implement selection, layer tree, grouping, keyboard commands and property inspector.
- [ ] Implement node create/move/resize/alignment commands.
- [ ] Add undo/redo and transactional revision persistence.
- [ ] Add visual checks at desktop and mobile sizes.

## Phase 4 — Design systems and component engine

- [ ] Add typed tokens, aliases, themes/modes and style resolution.
- [ ] Add component definitions, variants, typed properties and instances.
- [ ] Add import/export for the UDS design-system format.

## Phase 5 — AI design generation engine

- [ ] Implement provider-neutral adapter interface and capability negotiation.
- [ ] Add brief-to-flow and screen inventory schemas.
- [ ] Generate related editable screens and alternative directions.
- [ ] Apply validated, revision-aware patches with review summaries.
- [ ] Add screenshot/image input and design-quality evaluation.

## Phase 6 — Prototyping and UX engine

- [ ] Add prototype graph, triggers, actions, variables and component state.
- [ ] Build isolated clickable preview and UX/accessibility checks.

## Phase 7 — Code generation and developer handoff

- [ ] Export supported documents to React, HTML/CSS, tokens and assets.
- [ ] Report unsupported constructs and offer restricted live preview.
- [ ] Add optional local Git handoff.

## Phase 8 — Imports, exports and interoperability

- [ ] Add supported Figma/Penpot interoperability and reference imports.
- [ ] Add SVG, image, PDF and PNG flows with explicit asset provenance.
- [ ] Add narrow MCP adapter over validated application commands.

## Phase 9 — Collaboration and AI-agent ecosystem

- [ ] Add comments, shared projects and revision review.
- [ ] Add collaboration only after single-user revision semantics are stable.
- [ ] Add scoped specialist agents and task/review workflows.

## Phase 10 — Testing, optimization and release

- [ ] Add unit, integration, canvas interaction and visual regression coverage.
- [ ] Audit security, accessibility, performance, recovery and packaging.
- [ ] Complete user documentation and release checklist.
