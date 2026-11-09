# Figma — research dossier

**Research status:** Public-source documentation review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08

## Product role

Figma is the professional visual-editing reference in this project. Its important contribution is not just the canvas; it is the structured design model around pages, frames, layers, reusable components, variables, modes, libraries and interactive prototypes.

## Capabilities worth studying

- Hierarchical file/page/frame/layer editing.
- Vector shapes and paths, text, layout constraints and reusable components.
- Component properties, variants and shared libraries.
- Variables with string, number, color and boolean types; collections and modes.
- Prototyping actions that can update variable values, change component variants and alter visibility/layout.
- Dev Mode and design inspection.
- Plugin and widget APIs.
- REST API access to file/node JSON, images, versions, comments, components/styles, variables, webhooks and related resources, subject to endpoint scopes and plan/access requirements.

## Architectural lessons for UDS

1. The layer tree and canvas must represent the same node graph.
2. Components require definitions, instances, variants and explicit instance overrides.
3. Design tokens need typed values, semantic aliases and modes—not just a color palette.
4. Prototyping must model actions and state, not only static links between frames.
5. An importer must preserve supported semantics and report unsupported/lossy constructs.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Frames, layers, selection, properties | Canvas/editor engine | P0 |
| Components and variants | Component engine | P0 |
| Variables, aliases and modes | Token engine | P0 |
| Prototype actions and states | Prototype engine | P1 |
| SVG/vector paths and boolean operations | Vector subsystem | P2 |
| Figma file import/export | Integration adapter | P1 |

The Figma REST API is useful for reading structured files and resources, but we must not assume it provides arbitrary full-fidelity editing of every design object. Validate each endpoint and scope before promising round-trip editing. Figma is proprietary; use its official APIs and user-authorized exports rather than copying private implementation code or assets.

## Direct REA validation plan

In an authorized file, inspect a representative flow: create a frame; add text and vector objects; create a component and variant; bind a variable; switch modes; build a variable-driven prototype; inspect in Dev Mode; export or retrieve a file through approved API access. Record plan restrictions and the fidelity of each operation.

## Sources

- [Figma Developer Platform](https://developers.figma.com/)
- [Figma REST API introduction](https://developers.figma.com/docs/rest-api/)
- [Guide to variables](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
- [Use variables in prototypes](https://help.figma.com/hc/en-us/articles/14506587589399-Use-variables-in-prototypes)
- [Variables in Dev Mode](https://help.figma.com/hc/en-us/articles/27882809912471-Variables-in-Dev-Mode)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Official docs/API review | Links above | Documented research; direct REA validation pending |

## Open questions

- Which editing/prototyping properties are represented in REST responses?
- Which variables and component fields can be written through APIs versus plugin APIs?
- What export/import path best preserves Auto Layout and variable modes?
- Which features are plan-gated for the account available to the researcher?
