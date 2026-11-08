# Penpot — research dossier

**Canonical source:** https://github.com/penpot/penpot  
**Research status:** Official documentation, architecture guide and source metadata reviewed 2026-11-08.  
**Direct REA validation:** Pending.  
**License:** MPL-2.0 (verified from repository package metadata and LICENSE).

## Product role

Penpot is an open-source professional design platform with vector editing, responsive layout, components, design tokens, libraries, inspection and interactive prototyping. It is the strongest open-source reference for standards-based design.

## Source-inspected/documented architecture

- Frontend: ClojureScript with React.
- Backend: Clojure on the JVM.
- Persistence: PostgreSQL.
- Collaboration/presence: persistent WebSocket connections associated with a file, with Redis pub/sub in the documented backend architecture.
- Design model: SVG-oriented vector objects and a structured document format.
- Native `.penpot` export: ZIP package containing JSON metadata/pages/shapes/components/tokens and binary assets. The format is explicitly versioned and includes feature flags and migrations.

## Design capabilities

- SVG-based vector editing and boolean operations.
- Flex Layout and CSS Grid.
- Components, variants, libraries and design tokens.
- Responsive behavior and constraints.
- Prototype flows, overlays, navigation and transitions.
- Code inspection and developer workflows.

## Architectural lessons for UDS

1. Keep the design format open, versioned, inspectable and migration-aware.
2. Represent vector primitives and paths explicitly even if the first release prioritizes product UI.
3. Treat layout semantics as first-class document data rather than baking everything into absolute coordinates.
4. Plan component libraries, variants, token sets and prototype flows into the model.
5. Build a `.penpot` importer/exporter as a later adapter, not as our canonical internal format.

## License and reuse boundary

MPL-2.0 is a file-level copyleft license. Reuse of Penpot code is possible only with a careful review of covered files, notices, modifications and distribution obligations. We will initially learn from its architecture and open file format; no code will be copied into UDS until the exact files and obligations have been reviewed.

## Evidence status

| Finding | Classification |
|---|---|
| ClojureScript/React frontend and Clojure/JVM backend | Documented |
| PostgreSQL and Redis/WebSocket collaboration topology | Documented |
| SVG and layout features | Documented |
| ZIP + JSON + assets `.penpot` format | Documented |
| License MPL-2.0 | Source-inspected |
| Direct runtime behavior in UDS research browser | Pending |

## UDS capability mapping

- Vector node types and SVG paths
- CSS Grid/Flex layout semantics
- Components, variants and design tokens
- Prototype graph
- Open-format import/export adapter

## Sources

- https://penpot.app/features
- https://help.penpot.app/technical-guide/developer/architecture/
- https://help.penpot.app/technical-guide/developer/architecture/frontend/
- https://help.penpot.app/user-guide/export-import/penpot-file-format/
- https://github.com/penpot/penpot
- https://github.com/penpot/penpot/blob/develop/LICENSE
