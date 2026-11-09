# Design Document Model — conceptual schema v0

**Status:** Phase 6 implementation baseline; schema version 2 is implemented in `packages/design-core` with a version-1 migration. Phase 4 design-system data and Phase 6 prototype data are validated document fields. Project asset binaries and provenance remain project-scoped database/filesystem records, outside document snapshots.

## 1. Purpose

The Design Document Model (DDM) is the canonical representation shared by the canvas, renderer, AI patch engine, prototype runtime and code exporters. Rendered DOM/SVG is a projection, not the persisted source of truth.

## 2. Top-level structure

```text
DesignDocument
├── schemaVersion
├── documentId
├── metadata
├── revision
├── pages[]
│   └── Page
│       └── children[]
│           └── Node
│               ├── Frame
│               ├── Container
│               ├── Text
│               ├── Image
│               ├── Shape
│               ├── Vector
│               ├── ComponentDefinition
│               └── ComponentInstance
├── designSystem
│   ├── tokens[]
│   ├── themes[]
│   ├── modes[]
│   ├── components
│   └── variants
├── prototype
│   ├── variables
│   └── connections[]
└── (project assets are stored separately from the document snapshot)
```

## 3. Node invariants

Every node has a stable globally unique `id`, `type`, `name`, parent/child relationship, visibility/lock state, semantic properties and optional metadata. Parent-child cycles are forbidden. IDs must survive moves, reordering and non-destructive edits.

Node types in the first renderer subset:
- Frame: viewport/artboard boundary and root layout context.
- Container: block/flex/grid layout.
- Text: text content and typography.
- Image: project asset reference, fit and crop.
- Shape: rectangle, ellipse and line.
- Component definition/instance: reusable structure and explicit overrides.

Vector paths and boolean geometry are later extensions, not a reason to overload the initial node union.

## 3.1 Project asset records

Asset binaries are stored under the project directory and referenced by project-scoped URLs from image nodes. SQLite records the content hash, MIME type, byte size, original filename, asset kind, and provenance JSON. Raster PNG/JPEG/WebP/GIF files are canvas images after signature validation. SVG and PDF uploads are reference-only attachments: they keep source provenance but are not rendered as image nodes. These binaries are not copied into each document revision.

## 4. Layout semantics

Layout is expressed as framework-independent intent:
- Positioning: flow, absolute, fixed-to-frame.
- Display: block, flex, grid.
- Flex: direction, wrap, gap, align, justify.
- Grid: tracks, gaps, placement and spans.
- Sizing: fixed, fill, hug/content, min/max constraints.
- Spacing: padding, margin/gap.
- Desktop artboard widths: laptop, standard desktop and wide desktop presets.

Do not persist Tailwind class names as the semantic layout model. Exporters may generate Tailwind or plain CSS from the same semantics.

The schema stores explicit width and height for frames, images, shapes and containers. Container width/height default to 320×220 when migrating schema-v1 snapshots. Block containers position children locally; flex/grid containers place children in flow. UDS targets laptop and desktop screens; mobile and tablet artboards are out of scope.

## 5. Styles and tokens

Style values can be literals or typed token references. Token types include color, number, dimension, font family, font size, line height, radius, shadow and border. Tokens support semantic aliases, themes/modes and fallback values. Each mode belongs to a theme; a token can override its base value by mode. Alias targets must exist and share a type, and alias cycles are rejected. The renderer resolves text and shape color references for a selected mode. Component definitions contain one root layer, typed text/color/number/boolean properties and named variants; an instance stores its definition ID, selected named variant, and explicit property overrides. Nested component definitions and multi-axis variants are future extensions.

## 6. Prototype model

A prototype graph stores typed variables, text bindings and page/layer interactions. Triggers include click, double-click and hover. Actions include navigation, opening/closing overlays, setting a variable and changing a named component variant. References are validated against pages, nodes, variables and component definitions. Prototype preview state is temporary and separate from editor selection/viewport state.

## 7. Revisions and migrations

Every persisted document has a schema version and monotonic revision. Mutations produce operation records and snapshots. Migrations are deterministic and tested. A stale AI patch cannot be silently applied to a newer revision.

## 8. Renderer boundary

Renderer maps validated nodes to DOM/CSS/SVG. Editor overlays (selection outlines, handles, guides) are transient and not serialized. Preview receives a read-only document projection and an allowlisted asset set.

## 9. Phase 1 proof

Schema version 2 adds the design-system resource and color-token references. Version-1 snapshots migrate by adding a default theme and mode. Future fields require an explicit schema version and migration path. Desktop canvas review covers laptop and desktop artboards; mobile/tablet rendering is not a product target.
