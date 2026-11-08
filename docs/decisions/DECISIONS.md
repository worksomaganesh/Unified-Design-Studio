# Provisional architecture decisions

**Date:** 2026-11-08. All decisions below are provisional until direct REA investigation and implementation spikes are complete.

## D-001 — One product, not nine embedded clones

**Decision:** Build one coherent workspace around the user's workflow: brief → structured screens → direct editing → prototype → code handoff. Do not reproduce every product's unrelated features.

**Reason:** The target applications have different centers of gravity. A common product journey gives us a manageable scope and a consistent user experience.

## D-002 — Canonical versioned design document

**Decision:** Every engine operates on a shared versioned document model.

**Reason:** Screenshots, arbitrary generated HTML and independent editor state cannot reliably support direct editing, components, AI patches and code export at once.

## D-003 — DOM/CSS-first canvas for the first release

**Decision:** Prioritize web-native layout and component editing; use SVG for vector primitives and editor overlays.

**Reason:** Our primary output is product UI that must become working frontend code. This favors Paper/Doop/Penpot-style web standards over an initial attempt to reproduce a full general-purpose vector editor.

## D-004 — Structured AI patches, not free-form editor mutation

**Decision:** AI generation and edits return validated operations against document node IDs and revision numbers.

**Reason:** Prevents unrelated screen rewrites, reduces invalid output, enables undo and creates an auditable change history.

## D-005 — Local-first, single-user MVP

**Decision:** Persist projects locally first; defer cloud accounts and multiplayer editing.

**Reason:** The initial goal is an internal tool used on one Windows laptop. Collaboration introduces distributed-state, identity and infrastructure work before the core editor is proven.

## D-006 — Provider-neutral model layer

**Decision:** Define a model provider interface and keep editor business logic independent of Gemini, OpenAI or another vendor.

**Reason:** Subscriptions, API access and model availability can change; the app should not be locked to one vendor.

## D-007 — REA is a research tool, not a runtime dependency

**Decision:** Use REA for controlled website observation and evidence collection; do not embed it in the shipped product.

**Reason:** REA's browser inspection uses powerful CDP access and is intentionally passive. The final product needs its own narrowly scoped import/integration features, not a reverse-engineering engine.

## D-008 — Reuse open-source code only after license/security review

**Decision:** Treat OpenDesign and Penpot as source-available research candidates, not code to copy wholesale.

**Reason:** OpenDesign declares Apache-2.0 and Penpot is open source, but dependencies, notices, code boundaries and product fit must be reviewed before importing code. Proprietary apps are studied through documented/observable behavior only.

## D-009 — Defer real-time collaboration

**Decision:** Implement a stable local revision model first; add Yjs/CRDT later only if the MVP needs simultaneous editing.

**Reason:** Collaborative merge semantics are difficult to retrofit into a weak document model, but implementing them before the editor works is premature.

## D-010 — MVP is an end-to-end vertical slice

**Decision:** MVP must support prompt-to-three-screens, actual editing, AI refinement, responsive preview, clickable prototype and React/CSS export.

**Reason:** This proves the unified product delivers a complete useful workflow rather than a polished shell with disconnected demos.
