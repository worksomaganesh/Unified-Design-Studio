# Development roadmap

**Current phase:** Phase 0 — research and architecture baseline consolidated; local REA validation pending.  
**No delivery dates are committed.**

## Phase 0 — Research and architecture validation

Completed in repository:
- Public-source research for all nine target products.
- Nine expanded product dossiers, with sources, architecture lessons, implementation mapping and direct-observation test plans.
- Updated feature comparison and priorities.
- Reconciled architecture decisions and technology recommendation.
- Updated product requirements, architecture, design model and security/API boundaries.

Remaining local-only gate:
- Verify REA installer/package and resolve endpoint-protection detection safely.
- Install and verify REA on the HP Victus if the artifact is trusted.
- Connect REA to Antigravity through MCP.
- Configure a dedicated browser profile and loopback-only CDP.
- Run reproducible observations for accessible products; record plan/access limitations for unavailable products.
- Update dossiers with screenshots, evidence IDs and observed behavior.

**Exit gate:** Public claims, source evidence, direct observation, inference and unknowns are distinguished; local REA setup is verified or explicitly waived; product/technical requirements are approved. Phase 0 documentation is consolidated, but the full REA evidence gate is still open.

## Phase 1 — Design model and renderer spike

Build a small technical proof, not the full application:
- TypeScript package for document schema, Zod validation and migrations.
- Node types: document/page/frame/container/text/image/shape/component instance.
- Layout semantics: fixed, flex and grid.
- Stable IDs and document revision.
- Deterministic DOM/CSS renderer.
- SVG selection/transform overlays.
- Pan/zoom, selection, drag, resize and inline text editing.
- Visual regression tests at desktop and mobile widths.

**Exit gate:** A saved schema-valid document renders deterministically and can be edited without losing node identity.

## Phase 2 — Studio editing vertical slice

- React/Vite application shell.
- Canvas, layer tree, property inspector and asset panel.
- Project create/open/rename/duplicate.
- SQLite persistence and project-scoped asset storage.
- Autosave, undo/redo and revision restore.
- Desktop/tablet/mobile viewport presets.

**Exit gate:** Create, edit, save, close and reopen a multi-screen project.

## Phase 3 — AI design generation and patching

- Provider-neutral model adapters.
- PRD/brief parser and UX-flow/screen-plan schema.
- Generate at least three related screens and alternative directions.
- Structured, revision-aware AI patches.
- Selection-scoped edit and change summary.
- Validation and visual review.

**Exit gate:** AI can generate a coherent editable screen set and safely modify selected regions.

## Phase 4 — Prototyping and code handoff

- Prototype graph, triggers, actions and state.
- Clickable preview and responsive rendering.
- React/CSS/token/asset export.
- Restricted code preview and unsupported-feature reporting.
- Local project/repository handoff.

**Exit gate:** Complete idea-to-editable-design-to-prototype-to-code workflow.

## Later phases

- Figma/Penpot import/export.
- Advanced vector editing and richer design tooling.
- MCP agent operations over the shared command service.
- GitHub branch/PR integration.
- Real-time collaboration and hosted sync.
- Team permissions and integrations marketplace.

These are deliberately deferred until the MVP proves its core value.
