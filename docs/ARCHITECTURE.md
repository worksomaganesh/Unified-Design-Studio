# Technical architecture — Unified Design Studio

**Status:** Phase 1 baseline. Package boundaries and data contracts are specified; implementation remains incremental.

## 1. System overview

UDS is a local-first, AI-native product design environment. Its core pipeline is:

`Brief / PRD / references → UX plan → DesignDocument → editable canvas → prototype → code export`

The canonical `DesignDocument` is the shared source of truth. The DOM renderer is a projection of that model; it is not the model itself.

## 2. Logical components

- **Studio UI:** project navigation, conversation, canvas, layers, inspector, asset panel and preview.
- **Document core:** typed node graph, schema validation, stable IDs, migrations, tokens, components and revisions.
- **Renderer:** deterministic mapping from supported document nodes/layout semantics to DOM/CSS and SVG.
- **Editor interaction engine:** selection, hit testing, pan/zoom, drag, resize, snapping, keyboard actions and undo/redo.
- **AI orchestration:** provider adapters, context assembly, UX planning, screen generation, structured patch generation and review.
- **Prototype runtime:** navigation graph, triggers, actions, variables and component state.
- **Code exporter:** maps the canonical model to React/CSS and assets; unsupported constructs are reported.
- **Local service:** project operations, SQLite metadata, revision persistence, asset paths, background jobs and provider secrets.
- **Integration adapters:** Figma/Penpot import/export, GitHub and MCP; add only after core command contracts stabilize.

## 3. Trust and data flow

```text
Studio UI ──commands──> Application command service
  │                           │
  │                           ├──> Document core + validator
  │                           ├──> SQLite revisions + local assets
  │                           ├──> AI orchestration ──> model provider adapters
  │                           ├──> Renderer ──> isolated preview
  │                           └──> Code exporter ──> restricted code preview
  │
  └──> Editor interaction state (selection, viewport, transient drag)

Later adapters:
MCP ──> same application command service
GitHub/Figma/Penpot adapters ──> explicit import/export services
REA ──> separate research browser only; never production runtime
```

## 4. Document and renderer boundary

- Persist semantic nodes, layout properties, style/token references and relationships.
- Renderer resolves tokens and layout into DOM/CSS/SVG.
- Editor overlays are not serialized as design nodes.
- Direct manipulation emits typed document commands.
- Preview is isolated from the trusted editor and receives only the minimum document/assets needed.
- Exporter consumes the same validated document and reports unsupported semantics.

## 5. AI mutation lifecycle

1. Assemble context from brief, approved screen plan, selected node(s), relevant tokens/components and current document revision.
2. Ask model adapter for a structured operation list.
3. Validate schema, operation permissions, node references, asset references and base revision.
4. Show a change summary/diff for material changes.
5. Apply atomically to a new revision.
6. Render and run structural/visual checks.
7. Keep undo/restore path.

AI never receives unrestricted authority to mutate the local filesystem or execute code in the editor process.

## 6. Rendering approach

Start with DOM/CSS for application UI nodes: frames, containers, text, images, buttons, forms and layout groups. Use CSS Grid/Flex as first-class layout semantics. Use SVG for paths, icons and geometric primitives. Do not initially attempt a complete vector editor.

Phase 1 must prove:
- deterministic render of a schema-valid document;
- selection overlay and stable node hit testing;
- pan/zoom without changing document geometry;
- drag/resize translated into document commands;
- inline text editing;
- responsive layout at two viewport widths;
- visual regression tests.

## 7. Local persistence

SQLite stores project metadata, document revision metadata, operation history, asset metadata and asynchronous job summaries. The canonical document snapshot is versioned JSON; relational records index project/document/revision boundaries without duplicating the node graph. The initial schema is specified in [DATABASE_SCHEMA.sql](DATABASE_SCHEMA.sql). Binary assets live under project-scoped directories and are addressed by relative path plus SHA-256 metadata. Database writes and revision creation are transactional; filesystem writes use temporary files followed by atomic rename before the DB transaction references them.

Autosave writes new revisions transactionally. Undo/redo uses command history; named snapshots provide restore points. Do not use localStorage as the authoritative project database.

## 8. AI provider architecture

A provider adapter exposes model capabilities, structured generation, streaming, image input and tool support. Model selection is independent from the editor and document model. The orchestrator owns task planning, context assembly, schema validation, revision preconditions and user review; provider adapters only translate requests/responses. Consumer chat subscriptions are not assumed to provide API access. Keys stay in the local service/OS secure store and never enter browser state, logs or project documents.

## 9. Collaboration and MCP

The first release is single-user. Stable IDs, revision checks and command boundaries prepare for later collaboration. Yjs/CRDT is deferred until actual simultaneous editing is required.

MCP is a thin adapter over the same command service used by the UI. It must expose scoped tools, not arbitrary shell or filesystem access. REA is not the product's MCP implementation.

## 10. Explicit non-goals

No private backend reverse engineering, credential extraction, unauthorized scraping, full Figma parity, video/slide editor, real-time collaboration or cloud marketplace in MVP.
