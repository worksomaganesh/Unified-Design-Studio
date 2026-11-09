# Architecture decision records — Unified Design Studio

**Last reviewed:** 2026-11-08  
**Status:** Decisions below are accepted as Phase 0 architectural direction, subject to implementation spikes. They are not claims of implemented functionality.

## ADR-001 — Build one coherent product, not nine embedded clones
**Decision:** UDS implements a unified workflow: brief/PRD/reference → UX plan → design directions → editable screens → prototype → frontend handoff.  
**Reason:** The references solve different parts of the workflow. We should combine capabilities, not reproduce nine product shells.  
**Consequences:** No attempt at complete Figma parity, video/slide editing or every vendor integration in MVP.

## ADR-002 — Canonical, versioned Design Document Model
**Decision:** The document model is the source of truth for pages, frames, nodes, layout, tokens, components, variants, interactions and revisions.  
**Reason:** Canvas, AI, preview, prototype and exporters need a shared semantic artifact.  
**Consequences:** Renderer DOM is a projection, not the only persisted representation. Schema versions and migrations are mandatory.

## ADR-003 — DOM/CSS-first product canvas; SVG for vector primitives
**Decision:** Prioritize web-native UI layout using explicit box, flex and grid semantics. Use SVG for paths/shapes and editor overlays.  
**Reason:** UDS's main output is desktop product UI and frontend code. Paper/Doop/Penpot show the value of web-native semantics; Penpot also demonstrates why vector editing should be a distinct subsystem.
**Consequences:** Advanced Bézier editing, boolean geometry and general-purpose illustration tools are deferred. A renderer spike must validate layout fidelity before freezing the schema.

## ADR-004 — Structured, revision-aware AI patches
**Decision:** AI returns typed operations against stable node IDs and a base document revision. Validate and apply atomically; reject or rebase stale revisions.  
**Reason:** Enables localized edits, undo/redo, auditability and safe concurrency.  
**Consequences:** No arbitrary LLM execution inside the trusted editor. Generated markup is treated as untrusted input.

## ADR-005 — Local-first, single-user MVP
**Decision:** Begin with a local desktop/web workspace and local project storage. Use SQLite for metadata/revisions and filesystem-managed assets.  
**Reason:** The first user is the project owner on one Windows machine; collaboration would add distributed-state complexity before editor value is proven.  
**Consequences:** Design stable IDs and revision boundaries now; defer cloud sync and multiplayer.

## ADR-006 — Provider-neutral AI adapters
**Decision:** Define a provider-neutral model interface with capability metadata (text, image input, structured output, streaming, tool use).  
**Reason:** Models, subscriptions and API entitlements change. Consumer subscriptions must not be assumed to grant API access.  
**Consequences:** Provider credentials stay in the local service/secure store; model-specific behavior remains behind adapters.

## ADR-007 — REA is a development research tool only
**Decision:** Use REA for controlled, authorized browser observation. Do not ship REA or CDP access in UDS.  
**Reason:** Browser debugging protocols grant powerful access to the inspected profile and are not a production import mechanism.  
**Consequences:** REA validation remains a local task on the user's machine; keep a dedicated browser profile, loopback-only CDP and strict origin allowlisting.

## ADR-008 — Open-source reuse requires per-file and dependency review
**Decision:** Prefer independent implementations based on observed behavior and public standards. Reuse upstream code only after a documented license, dependency, security and attribution review.  
**Evidence:** OpenDesign repository declares Apache-2.0; Penpot declares MPL-2.0; Doop declares AGPL-3.0.  
**Consequences:** Do not copy Doop code casually; MPL-covered modifications and AGPL network/distribution obligations need specific legal review. Licenses do not grant product trademarks or third-party assets.

## ADR-009 — One command/mutation layer for UI, AI and MCP
**Decision:** Human UI, AI patches and later MCP tools call the same validated application command service.  
**Reason:** Doop's MCP/action design demonstrates why agents should operate on the same artifact and mutation semantics as humans.  
**Consequences:** MCP is an adapter over internal commands, not a second business-logic implementation. Expose narrow operations and scoped permissions.

## ADR-010 — Design systems are portable, typed resources
**Decision:** Store tokens, aliases, themes, component definitions, variants and usage metadata as structured resources, with a human-readable `DESIGN.md` companion.  
**Reason:** Figma/Penpot variables and components, Paper synchronization and Stitch/OpenDesign portable design-system context all point to this requirement.  
**Consequences:** Do not use a markdown file as the sole machine-readable design-system representation.

## ADR-011 — Isolate preview and generated code
**Decision:** Generated/imported HTML and executable code run outside the trusted editor, in a sandboxed iframe and stronger isolated runtime for server-side code.  
**Reason:** Generated code, external assets and imported sites are untrusted.  
**Consequences:** CSP, origin checks, restricted bridge, network policy and resource limits are release gates.

## ADR-012 — MVP is a complete vertical slice
**Decision:** MVP: brief → UX flow/screen plan → three editable desktop screens → direct + AI editing → laptop/desktop preview → clickable prototype → React/CSS export.
**Reason:** Proves the product end-to-end rather than creating disconnected demos.  
**Consequences:** Advanced collaboration, vector tooling and broad import/export are post-MVP.

## ADR-013 — Renderer/editor separation
**Decision:** Keep document semantics, renderer, editor interaction overlays and preview runtime as separate packages with explicit contracts.  
**Reason:** Rendering a document and editing it are different responsibilities; this enables deterministic rendering and isolated previews.  
**Consequences:** The canvas must not mutate DOM as the authoritative state.

## ADR-014 — Evidence provenance is mandatory
**Decision:** Every research statement is labelled as official documentation, source-code evidence, direct observation, inference or unknown.  
**Reason:** Public marketing pages do not reveal private internals, and REA cannot prove backend architecture from a browser.  
**Consequences:** Phase 0 remains open until local REA workflows and evidence are recorded.
