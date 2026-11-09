# Penpot — research dossier

**Research status:** Official product, architecture and license review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08 · **Upstream:** [penpot/penpot](https://github.com/penpot/penpot)

## Product role

Penpot is the open-source professional design-editor reference. It is especially relevant for web standards, vector editing, responsive layout and the relationship between design objects and code.

## Capabilities worth studying

- Vector and interface design, frames, layers and reusable components.
- Responsive layout with CSS Grid and Flex Layout.
- Interactive prototyping and design-system libraries/tokens.
- Open design file format and standards-based output such as CSS, HTML, SVG and JSON.
- Self-hosting and extensibility for developers and agents.

## Upstream architecture evidence

Penpot's technical guide describes a SPA frontend written in ClojureScript using React, communicating with a Clojure backend; PostgreSQL persists data. The frontend uses an RPC-style HTTP interface and persistent WebSockets for file collaboration/presence. This architecture is powerful but much heavier than our initial single-user MVP needs.

The current upstream repository declares **MPL-2.0**. This is not the same as MIT or Apache-2.0: covered modified files distributed as source remain under MPL terms, and notices/source obligations must be evaluated before code reuse.

## Architectural lessons for UDS

1. Use CSS Grid and Flex semantics as actual layout primitives in our document model.
2. Keep vector geometry and web-layout nodes interoperable but distinct.
3. Define an explicit portable file format; do not make the runtime DOM the only source of truth.
4. Defer multiplayer infrastructure while still designing stable node IDs and revision semantics.
5. Learn from Penpot's open file format and exportability without adopting its entire Clojure/PostgreSQL stack.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Flex/Grid and constraints | Layout engine | P0 |
| Components/libraries/tokens | Design-system engine | P0 |
| SVG shapes and paths | Vector subsystem | P1/P2 |
| Prototype links/actions | Prototype engine | P1 |
| Penpot import/export | Interoperability adapter | P1 |
| Full vector boolean operations | Advanced editor | P2 |

## Direct REA validation plan

On an authorized design file, create a responsive frame; test flex/grid; create a reusable component; bind tokens; connect prototype screens; inspect SVG/vector editing; export CSS/SVG/HTML; and compare exported semantics with the editor's document representation. Separate documented features from account- or version-specific availability.

## Sources

- [Penpot official website](https://penpot.app/)
- [Penpot technical architecture](https://help.penpot.app/technical-guide/developer/architecture/)
- [Penpot frontend architecture](https://github.com/penpot/penpot-docs/blob/main/technical-guide/developer/architecture/frontend.md)
- [Penpot source repository](https://github.com/penpot/penpot)
- [Penpot license](https://github.com/penpot/penpot/blob/develop/LICENSE)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Product, architecture and license review | Links above | Source review complete; direct REA observation pending |

## Open questions

- What parts of the file format should map directly to our canonical document?
- Which SVG operations and layout constraints have reliable import/export paths?
- Which MPL-covered files or dependencies would be affected by reuse?
