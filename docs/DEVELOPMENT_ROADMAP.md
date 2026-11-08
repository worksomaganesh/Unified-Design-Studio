# Development roadmap

**Status:** Phase 0 is in progress. Phases after research are proposed sequencing, not committed delivery dates.

## Phase 0 — Research and product definition

**Current status: 12 / 16 top-level tasks complete (75%).**

Completed:
- GitHub repository created and project scaffold organized.
- Public-source desk research compared nine target products.
- Consolidated feature matrix created.
- Product requirements, architecture, design-document model, security boundaries and provisional decisions drafted.

Remaining:
- Install and verify REA locally on the Windows laptop.
- Connect REA to Antigravity through MCP.
- Configure a dedicated Chromium profile with loopback-only CDP and exact-origin allowlisting.
- Perform reproducible browser observations for all nine products; save screenshots, evidence IDs, limitations and per-target notes.
- Reconcile the findings and freeze product/technical requirements.

**Exit gate:** Each target has a reproducible observation and evidence record (or a documented access limitation); claims distinguish public documentation, direct observation, inference and unknowns; requirements and architecture are reviewed and approved.

## Phase 1 — Core model and renderer spike

Proposed scope:
- Finalize the versioned design-document schema and migrations.
- Implement document validation, node identity and revision semantics.
- Render a supported DOM/CSS node subset inside an isolated preview frame.
- Prove selection overlays, pan/zoom, drag, resize and inline text editing.
- Establish unit and visual-regression tests.

**Exit gate:** A saved document can be rendered deterministically and edited without losing stable node identity.

## Phase 2 — Studio editing vertical slice

Proposed scope:
- Build the React studio shell, canvas viewport, layer tree and property inspector.
- Add project creation, local persistence, autosave, undo/redo and revision restore.
- Support core text, image, shape, frame and layout editing.
- Add desktop/tablet/mobile preview presets.

**Exit gate:** A user can create, edit, save, close and reopen a multi-screen project.

## Phase 3 — AI generation and patching

Proposed scope:
- Add provider adapters behind a provider-neutral interface.
- Generate a screen plan and multiple related screens from a brief.
- Validate and apply scoped, revision-aware AI patches.
- Display generation status, errors and available usage/cost metadata.

**Exit gate:** AI can create a coherent editable screen set and safely update a selected region without rewriting unrelated content.

## Phase 4 — Prototyping and code handoff

Proposed scope:
- Add screen connections, basic interactions, overlays and prototype preview.
- Export React/CSS, tokens and assets from the canonical document.
- Run exported output in a restricted preview and report unsupported constructs.

**Exit gate:** A user can move from brief to editable screens, clickable prototype and usable frontend export.

## Later — Interoperability and collaboration

Defer Figma/Penpot importers, advanced vector editing, multiplayer/CRDT collaboration, hosted accounts, billing and organization administration until the single-user end-to-end workflow is reliable and user evidence justifies the added complexity.
