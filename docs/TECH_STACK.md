# Technical stack proposal

**Status:** Provisional. These are candidate technologies from the architecture draft, not installed dependencies or frozen version selections. Validate them through implementation spikes before pinning versions.

| Layer | Candidate | Rationale / boundary |
|---|---|---|
| Monorepo | pnpm workspaces; Turborepo optional | Shared contracts and types across the app, server and packages. |
| Studio frontend | React + TypeScript + Vite | Client-heavy editor shell and fast local iteration. |
| Styling | CSS variables + CSS Modules / custom CSS | Explicit, exportable tokens without coupling the document model to a UI kit. |
| Canvas renderer | DOM/CSS renderer inside a sandboxed iframe | Web-native layout and closer mapping to frontend code. |
| Editor controls | Parent-app overlays; SVG for bounds, handles, guides and vector primitives | Keeps editor chrome separate from rendered design content. |
| Transient editor state | Zustand | Selection, viewport, active tools and interaction state. |
| Durable document schema | TypeScript + Zod | Runtime validation for documents, migrations and AI patches. |
| Local service | Node.js + TypeScript + Fastify (candidate) | Project/file operations and the provider proxy boundary. |
| Persistence | SQLite + local asset directory | Local-first, single-user MVP. |
| AI | Provider adapters (Gemini / OpenAI-compatible initially; others later) | Provider-neutral editor logic. |
| Agent access | Internal command API first; MCP adapter after stabilization | Avoid coupling the design model directly to MCP. |
| Preview / code runner | Sandboxed iframe or isolated process with restrictive CSP | Imported and generated content is untrusted. |
| Tests | Vitest + Playwright + screenshot regression | Document logic, user flows and visual output. |
| Desktop packaging | Defer; evaluate Electron after browser MVP | Avoid early packaging complexity. |

## Validation spikes

1. Render 100–300 nested nodes from a design JSON document.
2. Implement selection, drag, resize and inline text editing across the iframe boundary.
3. Validate flex/grid layout behavior and parent-frame resizing.
4. Apply a scoped AI patch while preserving unrelated node IDs and styles.
5. Export a document to React/CSS and compare it with the editor preview.
6. Test autosave, undo/redo, revision restore and crash recovery.

Do not pin package versions until implementation begins and compatibility is verified. The product requirements and trust boundaries take precedence over speculative version numbers.
