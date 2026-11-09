# Unified Design Studio

An AI-native, local-first product design workspace combining UX planning, multimodal design generation, direct visual editing, reusable design systems, interactive prototypes and frontend handoff.

> **Current stage:** Phase 2 — application foundation and workspace. The first React/Vite shell and local project service are scaffolded; canvas editing is planned for Phase 3.

## Status

- Nine product dossiers expanded: Claude Design, OpenDesign, Figma, Google Stitch, Penpot, Doop, Paper, v0 and UX Pilot.
- Comparative feature matrix and implementation priorities updated.
- Architecture and technology recommendations reviewed.
- Fourteen architecture decisions recorded.
- Phase 1 database schema and development backlog specified.
- Initial design-core and renderer packages started; see [Phase 1 backlog](docs/DEVELOPMENT_BACKLOG.md).
- Workspace shell now supports local project creation, listing, and reopening the saved starter document through the local service.
- **Direct REA validations: 0/9.** Local setup must be completed before claiming browser evidence.
- See [Phase 0 status](docs/PHASE_0_STATUS.md).

## Product workflow

**Brief / PRD / reference → UX flow and screen plan → design directions → editable screens → responsive preview → clickable prototype → React/CSS handoff.**

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
- Local-first single-user MVP.
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
apps/studio/    Main studio application (not implemented)
packages/       Reusable document, renderer, editor and AI packages (not implemented)
server/         Local service, persistence, storage and workers (not implemented)
tests/          Unit, integration, visual and E2E tests
```

## Run the workspace foundation

Requirements: Node.js 24 or newer and pnpm 10 or newer.

```powershell
pnpm install
pnpm dev
```

The Vite studio runs on `127.0.0.1:5173` and proxies to the local API on `127.0.0.1:4318`. Project records and document revisions use SQLite; project assets are stored in per-project folders under the OS application data directory. Set `UDS_DATA_DIR` to choose a different local data root. Provider selections and workspace preferences are persisted; provider secrets are not accepted by the workspace API.

## Phase 0 caveat

Public-source research and architecture consolidation are complete for this pass. REA is a powerful browser-observation tool, not a sandbox. Do not disable endpoint protection or create exclusions to force an installer download. Resolve the exact McAfee detection using the file hash, official release signature/checksum and vendor guidance before installation. REA/Antigravity/CDP validation requires the user's local Windows environment.
