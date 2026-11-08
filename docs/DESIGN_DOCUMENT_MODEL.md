# Design Document Model — conceptual schema v0

**Status:** Phase 0 conceptual contract; exact TypeScript/Zod schema is a Phase 1 deliverable.

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
│   ├── tokens
│   ├── themes
│   ├── components
│   └── variants
├── prototype
│   ├── variables
│   └── connections[]
└── assets[]
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

## 4. Layout semantics

Layout is expressed as framework-independent intent:
- Positioning: flow, absolute, fixed-to-frame.
- Display: block, flex, grid.
- Flex: direction, wrap, gap, align, justify.
- Grid: tracks, gaps, placement and spans.
- Sizing: fixed, fill, hug/content, min/max constraints.
- Spacing: padding, margin/gap.
- Responsive overrides: breakpoint-scoped property patches.

Do not persist Tailwind class names as the semantic layout model. Exporters may generate Tailwind or plain CSS from the same semantics.

## 5. Styles and tokens

Style values can be literals or typed token references. Token types include color, number, dimension, font family, font size, line height, radius, shadow and border. Tokens support semantic aliases, themes/modes and fallback values. Component definitions declare typed properties and variant axes; instances store only explicit overrides plus a definition reference.

## 6. Prototype model

A prototype is a graph of frame references and interactions. Each interaction has a trigger, action, target and optional condition. Initial actions: navigate, open/close overlay, set variable and change component variant. Prototype state is separate from editor selection/viewport state.

## 7. Revisions and migrations

Every persisted document has a schema version and monotonic revision. Mutations produce operation records and snapshots. Migrations are deterministic and tested. A stale AI patch cannot be silently applied to a newer revision.

## 8. Renderer boundary

Renderer maps validated nodes to DOM/CSS/SVG. Editor overlays (selection outlines, handles, guides) are transient and not serialized. Preview receives a read-only document projection and an allowlisted asset set.

## 9. Phase 1 proof

Before freezing v1, implement a sample document with a frame, nested flex/grid containers, text, image, shape and component instance. Validate schema, render at desktop/mobile widths, select and resize nodes, persist/reload, and compare deterministic screenshots. Adjust schema based on the spike.
