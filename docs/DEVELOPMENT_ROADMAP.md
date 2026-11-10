# Development roadmap

**Current phase:** Phase 9 — Collaboration and AI-agent ecosystem (25% complete). Local page/layer review threads, replies/resolution, and saved-revision comparison are implemented; runtime/desktop review is pending. Identity, shared-project permissions/synchronization, and specialist-agent task/review workflows remain open. Phase 8 remains at 90% with live Figma/Penpot/token review open. Phase 7 is set aside at 95%, with hands-on output review pending; Phase 6 preview review, Phase 5 live provider smoke verification, and Phase 3 desktop visual review are also open.
Phase names and numbering follow the project owner's 0–10 plan. No delivery dates are committed.

## Phase 0 — Intelligence gathering and reverse engineering

Research nine design products with source-backed dossiers, comparative feature matrix and documented direct observations. Desk research is recorded; direct REA evidence is still a separate validation track.

## Phase 1 — Product architecture and technical specification

Define system boundaries, canonical design document, layer/component hierarchy, AI and rendering pipelines, storage/versioning, API/security contracts, database schema and development backlog. The architecture baseline is in `ARCHITECTURE.md`, `DESIGN_DOCUMENT_MODEL.md`, `API_CONTRACTS.md`, `SECURITY.md`, `DATABASE_SCHEMA.sql` and `DEVELOPMENT_BACKLOG.md`.

## Phase 2 — Application foundation and workspace

Deliver a local project workspace with creation, opening, rename/archive, initial persistence, assets, preferences, navigation and keyboard command access. The project shell and local service are implemented; the create/open project exit gate is in place.

## Phase 3 — Core design canvas and rendering engine (desktop visual review pending)

Build the non-AI visual editor for laptop and desktop use: viewport pan/zoom, laptop/desktop artboards, pages, nested layers, text/shapes/images, transforms/alignment, flex/grid controls, property inspector, undo/redo and persisted revisions. Editing features are implemented. The desktop visual review is still open because Chrome and a separate shell timed out reaching the sandboxed loopback server. See [`LOCAL_PREVIEW_TROUBLESHOOTING.md`](LOCAL_PREVIEW_TROUBLESHOOTING.md) for the evidence-based recovery sequence; mobile and tablet artboards are out of scope.

## Phase 4 — Design systems and component engine (implementation complete)

Add typed tokens/themes, component definitions, instances, variants and portable design-system import/export. Typed tokens, modes, aliases, component definitions with editable typed properties and named variants, rendered instances, and versioned JSON import/export are implemented. See the Phase 4 exit gate in the [development backlog](DEVELOPMENT_BACKLOG.md).

## Phase 5 — AI design generation engine

Provider-neutral adapters for OpenAI, Anthropic, and Google Gemini, brief and screenshot to editable multi-screen directions, three distinct desktop layouts, selection-scoped reviewed patches, and deterministic design-quality review are implemented. Workspace typecheck and Studio production build pass. See [`AI_GENERATION.md`](AI_GENERATION.md). A live provider smoke request remains after a key/model is available.

## Phase 6 — Prototyping and UX engine

The document stores a validated interaction graph with click/double-click/hover triggers, navigation and overlays, typed variables bound to text, and component variant actions. A sandboxed desktop iframe preview applies changes only to temporary preview state. Local UX checks report reachability, missing entry points, hidden/locked triggers, hover-only interactions, missing image descriptions, and unused variables. See [`PROTOTYPING.md`](PROTOTYPING.md). Hands-on preview review remains open.

## Phase 7 — Code generation and developer handoff

Export React and HTML/CSS with tokens and project images; show support findings and a restricted static preview. The downloadable ZIP, optional Git-ready packaging, and both render formats are implemented. Hands-on review remains; GitHub publishing is not part of the local export flow.

## Phase 8 — Imports, exports and interoperability

Add supported Figma/Penpot exchange, reference and asset imports, document exports and MCP integration. Project uploads record provenance, verify raster and Penpot archive signatures, and preserve SVG/PDF plus native source files. Penpot v3 imports the supported editable subset and reports unsupported content. DTCG-compatible token sets, credential-backed Figma Variables exchange, Figma REST file conversion, and bounded MCP reads plus revision-checked text/rename commands are implemented. Hands-on Figma/Penpot/token-workflow review remains; see the [Phase 8 backlog](DEVELOPMENT_BACKLOG.md).

## Phase 9 — Collaboration and AI-agent ecosystem

The local review foundation now stores comments separately from design snapshots and anchors them to a validated saved revision, page, and optional layer. The editor can resolve/reopen threads and compare saved revisions, with restores appended to immutable history. Current progress is 25%; identity, membership/roles, invitations, shared-project synchronization, and scoped specialist-agent task/review workflows remain. See [`PHASE_9_COLLABORATION.md`](PHASE_9_COLLABORATION.md). Do not expose review routes beyond loopback while the app has no verified user identity or project authorization model.

## Phase 10 — Testing, optimization and release

Complete unit/integration/interaction/visual coverage, security/accessibility/performance review, recovery, packaging, docs and release management.
