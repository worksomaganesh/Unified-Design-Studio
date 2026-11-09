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
- [x] Typecheck the schema/renderer packages and build the app's renderer dependency graph.
- [x] Pin workspace/tooling choices and establish ordered SQL migration ownership.

## Phase 2 — Application foundation and workspace

- [x] Create pnpm workspace and shared TypeScript configuration.
- [x] Bootstrap React/Vite studio shell with workspace navigation and laptop/desktop project views.
- [x] Implement local project create/list/open endpoints and project shell.
- [x] Add SQLite-backed project/document/revision creation and schema migration marker.
- [x] Complete project rename/archive UI and project reopening of document snapshots.
- [x] Implement project-scoped asset upload/list/remove service for common raster formats.
- [x] Add persistent workspace settings and reject unknown settings fields; provider secrets are deliberately never accepted by the UI/API.
- [x] Add keyboard command palette and project CRUD interactions.
- [x] Install dependencies, typecheck all packages and production-build the studio; API startup/migrations verified.

**Phase 2 exit gate:** Met. The project workspace creates and reopens projects with a saved starter document. Browser-level visual QA is tracked in Phase 10; the current in-app browser could not reach the sandboxed loopback server. OS credential-vault integration belongs with provider execution in Phase 5, before any provider key is accepted.

## Phase 3 — Core design canvas and rendering engine (implementation complete; desktop visual review pending)

- [x] Implement initial canvas viewport with zoom, pan and desktop-only Laptop, Desktop and Wide Desktop artboard presets.
- [x] Implement basic selection, layer list, keyboard commands and property inspector.
- [x] Implement grouping and nested layer hierarchy editing for layers sharing a parent; adding to a selected frame/container also creates nested children.
- [x] Implement frame, text, shape and container creation plus node move/resize/alignment.
- [x] Wire project assets into image nodes and support real image placement.
- [x] Render nested container children with the document's flex/grid semantics.
- [x] Add block/flex/grid controls, flex direction/alignment/spacing, and grid column/gap controls to the property inspector.
- [x] Add undo/redo and transactional document revision persistence.
- [x] Add revision restore and multi-page canvas switching, creation, rename and deletion.
- [ ] Complete desktop visual review at laptop/desktop sizes.

**Phase 3 exit gate:** Desktop editing features are implemented. Visual review is still open because Chrome and a separate shell timed out when reaching the dev processes' loopback addresses. The likely cause is separate network namespaces; follow [`LOCAL_PREVIEW_TROUBLESHOOTING.md`](LOCAL_PREVIEW_TROUBLESHOOTING.md) to run both services in Chrome's host environment or use the supported preview bridge, then complete laptop/desktop review. Mobile and tablet artboards are out of scope.

## Phase 4 — Design systems and component engine (implementation complete)

- [x] Add typed token values, themes/modes, aliases, reference validation and mode-aware resolution.
- [x] Add a design-system panel for token creation/editing, themes/modes, aliases and color-token links on text/shape layers.
- [x] Add component definitions from selected layers, typed text/color/number/boolean properties, named variants and editable instances.
- [x] Render resolved component instances in the canvas and deterministic HTML renderer; validate definition, variant and override references.
- [x] Add versioned JSON import/export for themes, modes, tokens, aliases and components; reject imports that would break current document references.

**Phase 4 exit gate:** Met. Component definitions and instances now render and accept typed overrides/variant selection; design systems can be exchanged in the versioned UDS JSON format. Component definitions currently use a single root layer and one named variant selection per instance; nested component definitions and multi-axis variants remain future extensions.

## Phase 5 — AI design generation engine

- [x] Implement provider-neutral adapter interface and capability negotiation for OpenAI, Anthropic, and Google Gemini.
- [x] Add validated brief-to-flow and screen inventory schemas.
- [x] Generate related editable screens in distinct desktop layouts and alternative directions.
- [x] Return validated, selection-scoped, revision-aware patch proposals with review summaries and per-operation approval.
- [x] Add project-scoped screenshot/image input and deterministic design-quality evaluation.

**Phase 5 implementation gate:** Met. All five feature items are implemented, workspace typecheck passes, and the Studio production build passes. A live provider request remains as the final operational check because provider credentials and model selection are user supplied. See [`AI_GENERATION.md`](AI_GENERATION.md) for routes, payload scope, setup, and limits.

## Phase 6 — Prototyping and UX engine

- [x] Add a persisted prototype graph with click/double-click/hover triggers, navigation/overlay actions, typed variables and text bindings, and component-variant state.
- [x] Build a sandboxed clickable desktop preview and local UX/accessibility preflight.

**Phase 6 implementation gate:** Met. Prototype definitions are part of the validated design document, edits are undoable and revision-persisted, and preview behavior stays local to a sandboxed iframe session. The preview and panel still need hands-on visual/interaction review. See [`PROTOTYPING.md`](PROTOTYPING.md).

**Phase 6 progress:** 95% complete; 5% remains for hands-on preview and interaction review.

## Phase 7 — Code generation and developer handoff

- [x] Export supported documents to React, HTML/CSS, tokens and project assets as a downloadable ZIP.
- [x] Report unsupported constructs and offer a script-free restricted static preview.
- [x] Add optional Git-ready handoff with safe ignore rules and local initialization instructions; Git commands are never executed by the Studio.

**Phase 7 implementation gate:** Met. React/HTML exports, project assets and tokens, unsupported-feature reporting, restricted static preview, and optional Git-ready packaging are implemented. The remaining 5% is hands-on review of the generated output in the user's browser. See [`CODE_HANDOFF.md`](CODE_HANDOFF.md).

**Phase 7 progress:** 95% complete; 5% remains for hands-on preview and downloaded-bundle review.

## Phase 8 — Imports, exports and interoperability

- [ ] Add supported Figma/Penpot interoperability and reference imports.
- [x] Add raster-image placement plus reference-only SVG/PDF imports with signature checks and explicit local-upload provenance.
- [ ] Add narrow MCP adapter over validated application commands.

**Phase 8 progress:** 35% complete. Project assets now distinguish canvas-safe raster images from reference-only SVG/PDF attachments, verify uploaded file signatures, and record provenance. Figma/Penpot interchange and the narrow MCP adapter remain. SVG/PDF import is intentionally reference-only; converting them into editable canvas nodes remains future work.

## Phase 9 — Collaboration and AI-agent ecosystem

- [ ] Add comments, shared projects and revision review.
- [ ] Add collaboration only after single-user revision semantics are stable.
- [ ] Add scoped specialist agents and task/review workflows.

## Phase 10 — Testing, optimization and release

- [ ] Add unit, integration, canvas interaction and visual regression coverage.
- [ ] Audit security, accessibility, performance, recovery and packaging.
- [ ] Complete user documentation and release checklist.
