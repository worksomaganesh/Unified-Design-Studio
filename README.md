# Unified Design Studio

An AI-native, local-first design workspace intended to connect product discovery, multi-screen UI generation, direct visual editing, design systems, interactive prototyping and frontend code handoff.

> **Project stage:** Phase 0 — research and product definition. The repository currently contains research and planning documents; application implementation has not started.

## Current status

- **Phase 0: 12 / 16 top-level tasks complete (75%).**
- Public-source desk research covers nine products: Claude Design, OpenDesign, Figma, Google Stitch, Penpot, Doop, Paper, v0 and UX Pilot.
- The consolidated comparison is in [the feature matrix](research/feature-matrix/FEATURE_MATRIX.md).
- **Direct REA browser validation: 0 / 9 targets completed.**
- Product and technical specifications remain drafts until the REA evidence pass is complete.

See [Phase 0 status](docs/PHASE_0_STATUS.md), [development roadmap](docs/DEVELOPMENT_ROADMAP.md) and [provisional decisions](docs/decisions/DECISIONS.md).

## Repository map

```text
unified-design-studio/
├── research/
│   ├── targets/                 # One research profile per target product
│   ├── evidence/                # Capture records, observations and evidence IDs
│   ├── screenshots/             # Research screenshots
│   ├── framework-analysis/      # Framework and implementation-pattern analysis
│   ├── feature-matrix/          # Cross-product comparison
│   └── REA-WINDOWS-ANTIGRAVITY.md
├── docs/                        # Product, architecture, security and API documents
│   └── decisions/               # Architecture decision records
├── apps/studio/                 # Main studio application (not implemented)
├── packages/                    # Reusable editor and engine packages (not implemented)
├── server/                      # Local API, persistence, storage and workers (not implemented)
├── tests/                       # Unit, integration, visual and end-to-end tests
└── README.md
```

## Core product direction

The proposed workflow is:

**Brief / PRD / reference → screen plan → generated screens → direct editing → responsive preview → clickable prototype → React/CSS export.**

The product is not intended to be nine embedded clones. The aim is one coherent workspace with a canonical, versioned design document shared by the canvas, renderer, AI patch engine, prototype and code exporter.

## Key documents

| Document | Purpose |
|---|---|
| [Product spec](docs/PRODUCT_SPEC.md) | Draft user journey, functional requirements and MVP acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Proposed system topology and implementation principles |
| [Tech stack](docs/TECH_STACK.md) | Candidate technologies; not yet frozen |
| [Design document model](docs/DESIGN_DOCUMENT_MODEL.md) | Conceptual shared document schema |
| [Security](docs/SECURITY.md) | Trust boundaries and safety requirements |
| [API contracts](docs/API_CONTRACTS.md) | Proposed internal operations and AI patch contract |
| [Development roadmap](docs/DEVELOPMENT_ROADMAP.md) | Phase gates and implementation sequence |
| [Decisions](docs/decisions/DECISIONS.md) | Provisional architecture decisions |

## Research targets

Claude Design · OpenDesign · Figma · Google Stitch · Penpot · Doop · Paper · v0 · UX Pilot.

Each target folder contains a profile template. Public-source comparisons are consolidated in the feature matrix; record direct browser observations separately from documented claims and inferences.

## Development principles

1. Keep all product and architecture decisions explicitly provisional until validated.
2. Use one versioned design document as the source of truth across editing, rendering, AI and export.
3. Make AI changes as validated, revision-aware patches rather than unrestricted document rewrites.
4. Start local-first and single-user; defer collaboration and cloud infrastructure until justified.
5. Keep generated/imported content isolated from the trusted editor and protect provider secrets.
6. Preserve evidence provenance: distinguish official documentation, direct observation, inference and unknowns.

## Contributing / implementation

No app, package or server runtime has been scaffolded yet. The directories under `apps/`, `packages/`, `server/` and `tests/` are reserved for the implementation phase. Start with Phase 0 exit criteria before treating the proposed stack or schema as final.
