# Technical stack — Phase 0 recommendation

**Status:** Recommended baseline; implementation spikes in Phase 1 may change individual choices.  
**Target environment:** Windows 11 laptop; local-first single-user MVP.

## Recommended stack

| Concern | Recommendation | Why / caveat |
|---|---|---|
| Language | TypeScript | Shared types across app, local service and packages. |
| Frontend | React + Vite | Mature ecosystem; fast local development. |
| Monorepo | pnpm workspaces | Keep shared packages/contracts without adding Turborepo until build orchestration needs it. |
| UI styling | CSS variables + CSS Modules or scoped styles | Avoid tying the document model to a utility-class framework. |
| Accessible primitives | Radix UI where useful | Use primitives, not a prebuilt visual design language. |
| Canvas state | Zustand | UI/editor interaction state only; persisted document remains separate. |
| Schema validation | Zod | Runtime validation for document, patches and API inputs. |
| Renderer | DOM/CSS for web-layout nodes; SVG for vector nodes and overlays | Validate in a Phase 1 spike. |
| Local backend | Node.js + TypeScript + Fastify (or Express if MCP/library fit proves better) | Local API, jobs, persistence and provider adapters. Select one after a minimal benchmark/spike. |
| Metadata/revisions | Node.js `node:sqlite` synchronous SQLite API (Node 24+) | Local-first, transactional metadata and revision records without a native addon build step; keep database calls short and inside the local service. |
| Assets | Project-scoped filesystem storage | Avoid storing large binary assets in SQLite. |
| AI provider adapters | Provider SDKs behind internal interface | API keys and model capabilities vary; do not assume subscription includes API quota. |
| Structured output | Zod-validated JSON operations | Never trust raw model output. |
| Preview | Sandboxed iframe for HTML/CSS; isolated process/container for executable server code | Iframe alone is not a sufficient sandbox for arbitrary backend code. |
| Tests | Vitest + Playwright | Unit, integration and end-to-end visual interaction coverage. |
| Collaboration later | Yjs only after single-user revision model is proven | CRDT adds complexity and must be justified. |
| MCP later | Official MCP TypeScript SDK | Expose narrow operations over the internal command service. |

## Explicitly not frozen yet

- Electron vs Tauri vs browser-only local app. Start with browser-based local development; choose packaging after MVP usability and OS integration needs are known.
- Fastify vs Express. Choose after a minimal local-service and streaming prototype.
- Tailwind vs CSS Modules. The design document must be framework-independent; exporter adapters can target Tailwind if desired.
- Zustand vs another UI state store. Keep document state separate so this can change.
- Dedicated migration library. The local service currently applies ordered, checked-in SQL migrations transactionally.

## Runtime support

Use Node.js 24 or newer for the built-in SQLite API and pin the package manager/runtime in project configuration. Do not copy version numbers from target products as UDS requirements.

## Architecture constraints

1. Design nodes must not store framework-specific class strings as their semantic layout.
2. The canonical model must describe CSS-like layout intent and export it to supported frameworks.
3. Every persisted document is schema-versioned and migratable.
4. The renderer must be deterministic for a given document and renderer version.
5. Generated code executes in a restricted preview boundary.
6. API keys never enter the browser bundle or design file.
