# Technical architecture draft — Unified Design Studio

**Status:** Provisional proposal after initial product desk research. Final choice is pending REA evidence and a prototype spike.  
**Date:** 2026-11-08

## 1. Architecture principles

1. **One canonical design document.** The canvas, AI, preview, prototyping and code export must operate on the same versioned data model.
2. **DOM/CSS-first for product UI.** Prioritize web layout, typography, components, responsive rules and code fidelity. Use SVG for vector primitives and editor overlays.
3. **AI produces validated patches.** Do not let an LLM freely mutate the whole application or inject arbitrary executable markup into the editor.
4. **Local-first MVP.** Start with a single-user local project workspace. Add hosted collaboration after core editing and persistence are stable.
5. **Provider-neutral AI.** Model APIs are adapters behind one internal contract.
6. **Security boundaries are explicit.** Preview, imported content, local filesystem, MCP and provider secrets are separate trust domains.
7. **Research tools stay out of product runtime.** REA is used during research and development; it is not a production dependency.

## 2. Proposed stack

| Layer | Initial choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces (Turborepo optional) | Shared types/contracts across app, server and packages. |
| Editor frontend | React + TypeScript + Vite | Fast local iteration and a client-heavy editor shell. |
| UI styling | CSS variables + CSS Modules/custom CSS | Tokens are explicit and exportable; avoid tying the document model to one UI kit. |
| Canvas renderer | DOM/CSS node renderer in a sandboxed iframe | Web-native layout and closer design-to-code mapping. |
| Editor controls | Parent-app overlays; SVG for selection bounds, handles, guides and vector paths | Keeps editor controls separate from rendered content. |
| State | Zustand for transient editor state; versioned document model for durable state | Separates UI selection/viewport from the design document. |
| Schema | TypeScript + Zod | Runtime validation of documents and AI patches. |
| Local service | Node.js + TypeScript + Fastify (candidate) | Local project/file operations and AI provider proxy boundary. |
| Persistence | SQLite + local asset directory | Good fit for single-user local-first mode. |
| AI | Provider adapters (Gemini/OpenAI-compatible initially, others later) | Provider independence and model choice. |
| Agent connectivity | Internal command API first; MCP adapter after stabilization | Avoid coupling the design model directly to MCP. |
| Preview/code runner | Isolated iframe/process with strict origin and CSP policy | Imported/generated code is untrusted. |
| Tests | Vitest + Playwright + screenshot regression | Validate document logic, user flows and visual output. |
| Desktop shell | Defer; evaluate Electron after browser MVP | Avoid installation and packaging risk during the first engineering slice. |

The chosen versions should be pinned only when implementation begins; the requirements are more important than speculative version numbers.

## 3. System topology

```text
React editor shell
  ├─ Project/workspace UI
  ├─ Chat + selection context
  ├─ Canvas viewport + transform
  ├─ Layer tree + property inspector
  └─ Preview/prototype mode
          │
          ├──────── Design Document API ────────┐
          │                                      │
          ▼                                      ▼
  Editor state (Zustand)                Versioned DesignDocument
  selection / viewport / tools         pages / frames / nodes / tokens
                                                 │
                           ┌─────────────────────┼──────────────────┐
                           ▼                     ▼                  ▼
                       Renderer            AI patch engine     Code exporter
                       iframe DOM/CSS       validated ops       React + CSS
                           │                     │                  │
                           └─────────────────────┴──────────────────┘
                                                 │
                                        Local Node service
                                  SQLite / assets / revisions / providers
                                                 │
                                     AI provider adapters / MCP adapter
```

## 4. Canonical design document (proposed v0)

```ts
type DesignDocument = {
  schemaVersion: number;
  id: string;
  name: string;
  metadata: { createdAt: string; updatedAt: string; platform: "web" };
  themeIds: string[];
  tokenSets: TokenSet[];
  components: ComponentDefinition[];
  pages: Page[];
  assets: AssetReference[];
  prototype: PrototypeGraph;
};

type Page = { id: string; name: string; frameIds: string[] };

type Frame = {
  id: string;
  name: string;
  width: number;
  height: number;
  breakpoint?: string;
  rootNodeIds: string[];
};

type DesignNode = {
  id: string;
  type: "frame" | "group" | "text" | "image" | "rect" | "ellipse" | "line" | "component-instance";
  name: string;
  parentId: string | null;
  children: string[];
  layout: LayoutSpec;
  style: StyleSpec;
  content?: unknown;
  componentRef?: string;
  variantProps?: Record<string, string | number | boolean>;
};
```

This is a conceptual sketch, not a final implementation schema. Before coding, add normalized ID ownership, constraints, token references, asset provenance, interaction state, accessibility metadata, z-order, text runs, component overrides and migration rules.

## 5. Rendering and editing strategy

- Render the model into a dedicated iframe using a renderer package; include stable `data-node-id` attributes.
- Keep editor chrome, toolbars, panels and overlays in the parent React app to prevent style leakage.
- Use a transformable viewport for pan/zoom; maintain world coordinates separately from screen coordinates.
- Use pointer capture and explicit interaction state machines for select, drag, resize, text edit, pan and marquee selection.
- Use an SVG overlay for selection outlines, anchors, resize handles, guides and snapping indicators.
- The iframe communicates with the parent through a narrow message protocol. Validate message origin/source and node IDs; do not expose arbitrary `eval` or unrestricted parent access.
- Start with a supported subset of CSS properties/layout rather than pretending to implement every CSS feature. Unsupported constructs must be surfaced in the editor/export report.

## 6. AI patch contract

AI output should be structured operations, for example:

```json
{
  "documentId": "doc_123",
  "baseRevision": 12,
  "operations": [
    { "op": "setText", "nodeId": "text_9", "value": "Book a pod" },
    { "op": "setStyleToken", "nodeId": "button_2", "property": "background", "token": "color.action.primary" }
  ],
  "summary": "Updated the hero CTA and button treatment"
}
```

The server validates schema, operation type, target IDs, user permission and base revision. If the base revision is stale, return a conflict and ask the model to rebase or ask the user to resolve it. Apply all-or-nothing transactions where practical; record the patch and before/after revision for undo.

## 7. Persistence and versioning

- SQLite tables for projects, documents, revisions, asset metadata and provider configuration references.
- Assets stored as files with content hashes and database metadata.
- Save document snapshots plus compact operations between snapshots.
- Keep undo/redo local to an editor session; persist stable revision checkpoints.
- Store provider API keys in OS-appropriate secure storage or an encrypted local secret store, never in design JSON or Git.

## 8. Security model

- Generated/ imported HTML and JavaScript must not execute in the trusted editor origin.
- Prefer a sandboxed iframe with restrictive CSP and a narrow message bridge; consider separate process/container isolation for code execution.
- Imported URLs require explicit user action and an SSRF-safe fetch policy if processed server-side.
- MCP tools use scoped project permissions and confirmation for destructive/export/network operations.
- No tokens, cookies or credentials in logs, screenshots, research evidence or repository history.
- REA browser observation remains in a dedicated profile with exact origin allowlisting and loopback-only CDP.

## 9. Implementation spikes required before final stack freeze

1. Render 100-300 nested nodes from a design JSON document without editor overlay.
2. Add selection, drag, resize and inline text editing across iframe boundary.
3. Implement flex/grid layout and resize parent frames without losing user intent.
4. Apply an AI patch to a selected region while preserving unrelated node IDs and styles.
5. Export the same document to React/CSS and compare rendered output against editor preview.
6. Test autosave, undo/redo and crash recovery.

## 10. Deferred architecture

- Collaboration: evaluate Yjs/CRDT only after single-user editing semantics are stable.
- Vector editing: expand SVG path/boolean operations after product-UI editing MVP.
- Cloud hosting: add auth, multi-tenant PostgreSQL and object storage only when there is a real collaboration requirement.
- Desktop packaging: evaluate Electron/Tauri after browser-first workflow is proven.
- Importers: Figma/Penpot and HTML/site import use dedicated adapters with explicit loss reports.
