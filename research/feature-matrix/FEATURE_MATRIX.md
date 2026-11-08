# Comparative feature matrix — Unified Design Studio

**Research date:** 2026-11-08  
**Evidence:** Official product documentation, public announcements and source repositories. Not all capabilities have been hands-on tested.  
**Legend:** Core = defining documented strength; Strong = clearly documented; Partial = limited/secondary; Unknown = not established. Blank/unknown does not mean absent.

| Capability | Claude Design | OpenDesign | Figma | Stitch | Penpot | Doop | Paper | v0 | UX Pilot |
|---|---|---|---|---|---|---|---|---|---|
| Prompt-to-design | Core | Core | Agent/plugin ecosystem | Core | AI/plugin ecosystem | Core via agents | Strong via agents | Core | Core |
| PRD / UX flow | Strong | Brief-to-artifact | Partial | Context-driven | Partial | Agent-assisted | Agent-assisted | App brief | Core |
| Infinite canvas | Canvas/artifact | Workspace | Core | Core | Core | Core | Canvas | Unknown | Partial |
| Direct visual editing | Strong | Artifact editing | Core | Strong | Core | HTML frame editing | HTML/CSS editing | Code/design mode | Strong |
| Structured layers | Artifact model | Project/files | Core | Canvas objects | Core | HTML frames/layers | HTML/CSS frames | Code structure | Figma-native layers via Nodey |
| Vector editing | Unknown | Not primary | Core | Unknown | Core | SVG/HTML content | Web primitives | Not primary | Not primary |
| Responsive layout | Design/code | HTML/CSS output | Auto Layout | Responsive generation | Flex/Grid | HTML/CSS | HTML/CSS | Generated apps | Strong |
| Tokens/design systems | Strong | Core + DESIGN.md | Core variables | DESIGN.md portability | Core | Canvas tokens/guides | Tokens/styles/components | Design Systems 2.0 | Figma import |
| Components/variants | Design system | Templates/systems | Core | Design system context | Core | Reusable frame patterns | Components | Code components | Figma component sync |
| Interactive prototype | Strong | Live artifact | Core | Prototype workflow | Core | Live HTML/prototype wiring | Live HTML/CSS preview | Live app preview | Core |
| Scoped AI edits | Strong | Agent refinement | Agent ecosystem | Steering/iteration | Agent workflows | MCP frame edits | Agent canvas edits | Code edits | Section edits |
| Code handoff | Claude Code | Agent/HTML export | Dev Mode | AI Studio/Antigravity/Netlify | Inspect/export | HTML/agent workflow | Design-code sync | Core | React/code export |
| MCP/agent interface | Claude/Code | CLI, skills, MCP/adapters | APIs/plugins | MCP/SDK | MCP/plugins | Core MCP | Core MCP | MCP integrations | MCP/Nodey |
| Collaboration | Share/comments | Team workflows | Core | Live agent collaboration | Core | Multiplayer | Team canvas | Git/PR workflow | Team workflow |
| Version history | Artifact history | Project workflow | Core | Project evolution | History | Frame versions | Not fully verified | Project versions | Review/version features |
| Import/context | Image/assets/codebase | Website/repo/Figma workflows | APIs/imports | Text/image/code | Files/assets | Website/Figma | Code/repo/data | Repo/mockup/Figma/Paper | PRD/screens/site/Figma |
| Open-source code | No | Apache-2.0 | No | No public editor source verified | MPL-2.0 | AGPL-3.0 | No | No | No |

## Source and licensing notes

- **OpenDesign:** upstream `nexu-io/open-design` LICENSE declares Apache-2.0. Its architecture docs describe Next.js/React web UI, Express daemon, SQLite persistence, streaming and agent runtime adapters.
- **Penpot:** upstream `penpot/penpot` LICENSE and package manifest declare MPL-2.0. Its technical architecture is ClojureScript/React frontend with Clojure backend and PostgreSQL persistence.
- **Doop:** upstream `kgoedecke/doop` LICENSE declares AGPL-3.0. Current package manifest identifies React/Vite/Zustand frontend, TypeScript/Express server, Drizzle with PGlite/Postgres-compatible database, WebSockets and MCP Streamable HTTP. Recheck license and dependencies at the exact commit before any code reuse.
- **Proprietary targets:** Claude Design, Figma, Google Stitch, Paper, v0 and UX Pilot are studied through public documentation and authorized observable behavior. Their internal implementation is not assumed to be known.

## Capability clusters

1. **AI ideation/generation:** Claude Design, Stitch, UX Pilot, OpenDesign and v0.
2. **Professional visual editing/design systems:** Figma and Penpot.
3. **Agent-native canvas:** Doop and Paper, with OpenDesign as a broader agent workspace.
4. **Design/code continuity:** Paper, v0, Claude Code handoff and Doop's HTML frames.
5. **Local-first agent workspace:** OpenDesign.

## UDS priorities

| Priority | Capability | Reason |
|---|---|---|
| P0 | Canonical versioned design document | Shared source of truth |
| P0 | Brief/PRD → UX plan and multi-screen generation | Product-design workflow |
| P0 | Editable DOM/CSS canvas with frames/layers/properties | Real editable output |
| P0 | Tokens, themes, components and variants | Consistency and reuse |
| P0 | Local projects, autosave, revisions, undo/redo | Dependable local-first workflow |
| P0 | Responsive preview and basic clickable prototype | Usable design validation |
| P0 | React/CSS/token export | Design-to-code outcome |
| P1 | MCP interface over shared commands | Agent-native operation |
| P1 | Figma/Penpot import and richer SVG | Interoperability |
| P1 | Reference-site and repository context | Context-aware design |
| P2 | Multiplayer/CRDT collaboration | Defer complexity |
| P2 | Advanced vector tools, voice, deployment automation | Add after core workflow |

## Evidence discipline

Every per-product dossier labels public documentation, source-code evidence, direct observation, inference and unknowns separately. No browser observation is claimed until REA evidence is captured.
