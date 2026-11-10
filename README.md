# Unified Design Studio

An AI-native, local-first product design workspace combining UX planning, multimodal design generation, direct visual editing, reusable design systems, interactive prototypes and frontend handoff.

> **Current stage:** Phase 9 — Collaboration and AI-agent ecosystem — is 25% complete. Local review threads and saved-revision comparison are implemented; desktop review, verified identity/sharing, and scoped specialist-agent workflows remain. Phase 8 remains at 90%, with live Figma, Penpot, and token-workflow review pending.

## Project progress

| Phase | Progress | Current state |
|---|---:|---|
| 0 — Research and reverse engineering | 15/16 checklist items (94%) | REA is installed and connected to Antigravity (229 tools); the Notes demo DOM state change was observed. One dedicated browser-profile item remains. Direct REA workflows for the nine products remain 0/9. See [Phase 0 status](docs/PHASE_0_STATUS.md). |
| 1 — Product architecture and specification | 100% | Architecture, document model, API/security boundaries, schema and backlog are complete. |
| 2 — Application foundation and workspace | 100% | Local project creation, opening and persistence exit gate is met. |
| 3 — Design canvas and rendering | 90% | Desktop editing is implemented; hands-on laptop/desktop canvas review remains. Mobile and tablet are out of scope. |
| 4 — Design systems and components | 100% | Tokens, themes, aliases, components and versioned design-system exchange are implemented. |
| 5 — AI design generation | 95% | Implementation is complete; a live provider request needs the user’s key and model. |
| 6 — Prototyping and UX | 95% | Implementation is complete; hands-on preview and interaction review remains. |
| 7 — Code generation and handoff | 95% | React and HTML/CSS export are implemented; downloaded output review remains. |
| 8 — Interoperability | 90% | DTCG, Penpot v3 subset, Figma REST file/Variables exchange, asset provenance, and bounded MCP tools are implemented. Live Figma, Penpot, and token-workflow review remains. |
| 9 — Collaboration and AI-agent ecosystem | 25% | Local page/layer comments, thread replies/resolution, and revision comparison are implemented. Desktop review, project identity/sharing, synchronization, and specialist-agent task/review flows remain. See [Phase 9 collaboration](docs/PHASE_9_COLLABORATION.md). |
| 10 — Testing, optimization and release | Not started | — |

See the [development backlog](docs/DEVELOPMENT_BACKLOG.md) and [roadmap](docs/DEVELOPMENT_ROADMAP.md) for detailed gates and limitations.

## Implemented capabilities

- Nine product research dossiers, the comparative feature matrix, and fourteen architecture decisions are recorded.
- The workspace persists projects locally. The desktop canvas supports pages, nested layers, flex/grid controls, undo/redo, revision restore, reusable components and token links.
- AI Studio supports flow planning, editable screen inventories, design directions, reviewed selection-scoped patches, and local quality checks. See [AI generation](docs/AI_GENERATION.md).
- Prototype Studio supports validated interactions, variables, text bindings, component variants, sandboxed preview and local UX/accessibility checks. See [prototyping](docs/PROTOTYPING.md).
- Code handoff exports React, static HTML/CSS, tokens, images and a support report in a ZIP, with a script-free restricted preview. See [Code handoff](docs/CODE_HANDOFF.md).
- Phase 8 exchanges DTCG/Penpot/Tokens Studio tokens, imports supported Penpot v3 and Figma REST file content, and reads or creates Figma Variables. Figma `.fig` uploads remain reference-only. MCP provides bounded project/layer reads and revision-checked text/rename commands. See the [interoperability guide](docs/INTEROPERABILITY.md).
- Phase 9 adds local review threads anchored to saved pages/layers, reply and resolution controls, and revision comparison while preserving immutable design history. Multi-user sharing and agent orchestration are not yet enabled; see [Phase 9 collaboration](docs/PHASE_9_COLLABORATION.md).
- Product discovery adds a first-run welcome, searchable guide to 58 verified capabilities, eight short category tours, contextual tips, saved onboarding progress, and a structured What's New panel. See the [feature inventory](docs/PRODUCT_FEATURE_INVENTORY.md), [onboarding architecture](docs/ONBOARDING_ARCHITECTURE.md), [tour guide](docs/PRODUCT_TOUR_GUIDE.md), and [What's New system](docs/WHATS_NEW_SYSTEM.md).
- Workspace typecheck and Studio production build pass. Phase 3 desktop review and Phase 5–8 live checks remain as listed above.

## Product workflow

**Brief / PRD / reference → UX flow and screen plan → design directions → editable desktop screens → laptop/desktop preview → clickable prototype → React/CSS handoff.**

This is not nine embedded clones. UDS is being built as one coherent workflow with a canonical, versioned design document shared by the editor, AI, renderer, prototype engine and exporters.

## Research

| Target | Research dossier |
|---|---|
| Claude Design | [Dossier](research/targets/claude-design/README.md) |
| OpenDesign | [Dossier](research/targets/opendesign/README.md) |
| Figma | [Dossier](research/targets/figma/README.md) |
| Google Stitch | [Dossier](research/targets/google-stitch/README.md) |
| Penpot | [Dossier](research/targets/penpot/README.md) |
| Doop | [Dossier](research/targets/doop/README.md) |
| Paper | [Dossier](research/targets/paper/README.md) |
| v0 | [Dossier](research/targets/v0/README.md) |
| UX Pilot | [Dossier](research/targets/uxpilot/README.md) |

See the [comparative feature matrix](research/feature-matrix/FEATURE_MATRIX.md).

## Core technical direction

- TypeScript + React + Vite.
- Local-first single-user desktop workspace; mobile and tablet editing are out of scope.
- Canonical versioned design-document model.
- DOM/CSS-first editor for product UI; SVG for vector primitives.
- Structured, revision-aware AI patches.
- SQLite metadata/revisions and project-scoped filesystem assets.
- Provider-neutral model adapters.
- Isolated preview runtime.
- One command service shared by UI, AI and later MCP adapters.

The architecture and stack baseline is documented in [architecture](docs/ARCHITECTURE.md), [tech stack](docs/TECH_STACK.md), [design document model](docs/DESIGN_DOCUMENT_MODEL.md) and [decisions](docs/decisions/DECISIONS.md).

## Repository structure

```text
research/       Product dossiers, evidence, screenshots and feature matrix
docs/           Product spec, architecture, schema, API, security, roadmap, ADRs
apps/studio/    React/Vite workspace and canvas editor
packages/       Design schemas, provider-neutral AI engine and deterministic renderer
server/         Local API, SQLite persistence, revisions and project asset storage
tests/          Unit, integration, visual and E2E tests
```

## Run the workspace foundation

Requirements: Node.js 24 or newer and pnpm 10 or newer.

```powershell
pnpm install
pnpm dev
```

The Vite studio runs on `127.0.0.1:5173` and proxies to the local API on `127.0.0.1:4318`. Project records and document revisions use SQLite; project assets are stored in per-project folders under the OS application data directory. Set `UDS_DATA_DIR` to choose a different local data root. Provider selections and workspace preferences are persisted. Provider keys pass from the password field to dedicated local-service routes, are stored in Windows Credential Manager, and are not returned to the browser after saving.

## Phase 0 evidence note

REA is installed and connected to Antigravity. A Notes demo export confirmed the page's DOM status change; the capture recorded no network requests because REA attached after the initial fetch. Direct REA workflows for the nine researched products remain unvalidated (0/9), and the dedicated research browser profile is still open. See [Phase 0 status](docs/PHASE_0_STATUS.md).
