# Unified Design Studio

An AI-native, local-first product design workspace combining UX planning, multimodal design generation, direct visual editing, reusable design systems, interactive prototypes and frontend handoff.

> **Current stage:** Phase 8 is 90% complete. DTCG/Penpot/Tokens Studio exchange, supported Penpot v3 import, Figma Variables exchange, Figma REST file import, provenance-aware assets, and bounded MCP read/write tools are implemented. Review with an eligible Figma account/file, a representative Penpot archive, and a temporary token-workflow project remains. Phase 7 is set aside at 95%, with hands-on output review pending.

## Status

- Nine product dossiers expanded: Claude Design, OpenDesign, Figma, Google Stitch, Penpot, Doop, Paper, v0 and UX Pilot.
- Comparative feature matrix and implementation priorities updated.
- Architecture and technology recommendations reviewed.
- Fourteen architecture decisions recorded.
- Phase 1 database schema and development backlog specified.
- Initial design-core and renderer packages started; see [Phase 1 backlog](docs/DEVELOPMENT_BACKLOG.md).
- Workspace shell now supports local project creation, listing, and reopening the saved starter document through the local service.
- Canvas editor supports laptop/desktop artboards, page management, nested layer grouping, flex/grid controls, node creation and transforms, undo/redo, revision restore, design-token color links, reusable components with typed properties/variants, and versioned design-system JSON import/export; see the [development backlog](docs/DEVELOPMENT_BACKLOG.md).
- Code handoff downloads React, static HTML/CSS, design-system tokens, project images, and an export support report in a ZIP; its current canvas can be reviewed in a script-free restricted preview. See [Code handoff](docs/CODE_HANDOFF.md).
- Phase 8 supports DTCG/Penpot/Tokens Studio exchange, supported editable Penpot v3 imports, Figma REST file conversion and Variables API reads/create-only writes, and MCP project/layer summaries plus revision-checked text and rename commands. Raster assets record provenance; SVG/PDF and native source files retain provenance and conversion notes. Figma `.fig` files remain reference-only; file API conversion limits and scopes are documented in the [interoperability guide](docs/INTEROPERABILITY.md) and [Phase 8 backlog](docs/DEVELOPMENT_BACKLOG.md).
- AI Studio supports provider setup, brief-to-flow planning, editable screen inventories, alternative editable desktop directions, image references, reviewed selection patches, and local deterministic quality checks; see [AI generation](docs/AI_GENERATION.md).
- Prototype Studio supports validated interactions, variables and text bindings, component variant changes, sandboxed clickable preview, and local UX/accessibility checks; see [prototyping](docs/PROTOTYPING.md).
- Phase 5 implementation, workspace typecheck, and Studio production build are complete. A live provider smoke request remains operational verification; see the [Phase 5 backlog](docs/DEVELOPMENT_BACKLOG.md).
- The Phase 3 browser connection issue and recovery sequence are documented in [local preview troubleshooting](docs/LOCAL_PREVIEW_TROUBLESHOOTING.md).
- REA setup and the Notes demo DOM observation are complete; direct competitor-product validations remain 0/9 and are tracked separately in [Phase 0 status](docs/PHASE_0_STATUS.md).
- See [Phase 0 status](docs/PHASE_0_STATUS.md).

## Product workflow

**Brief / PRD / reference → UX flow and screen plan → design directions → editable desktop screens → laptop/desktop preview → clickable prototype → React/CSS handoff.**

This is not nine embedded clones. UDS will implement one coherent workflow with a canonical, versioned design document shared by the editor, AI, renderer, prototype engine and exporters.

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

The detailed stack remains subject to Phase 1 spikes. See [architecture](docs/ARCHITECTURE.md), [tech stack](docs/TECH_STACK.md), [design document model](docs/DESIGN_DOCUMENT_MODEL.md) and [decisions](docs/decisions/DECISIONS.md).

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

## Phase 0 caveat

Public-source research and architecture consolidation are complete for this pass. REA is a powerful browser-observation tool, not a sandbox. Do not disable endpoint protection or create exclusions to force an installer download. Resolve the exact McAfee detection using the file hash, official release signature/checksum and vendor guidance before installation. REA/Antigravity/CDP validation requires the user's local Windows environment.
