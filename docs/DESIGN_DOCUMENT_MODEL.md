# Design document model (conceptual v0)

**Status:** Conceptual proposal only. This is not an implemented schema or stable public contract. It must be validated against canvas, responsive-layout, component, prototype and export spikes.

## Design principles

- One canonical, versioned document is shared by the editor, renderer, AI patch engine, prototype and code exporter.
- Stable node IDs survive edits and exports.
- Durable design content is separate from transient editor state (selection, viewport, active tool) and preview runtime state.
- Every persisted document carries a schema version and supports migration.
- AI changes are validated operations against a document ID, base revision and target node IDs.

## Proposed TypeScript shape

```ts
type DesignDocument = {
  schemaVersion: number;
  id: string;
  name: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    platform: "web";
  };
  themeIds: string[];
  tokenSets: TokenSet[];
  components: ComponentDefinition[];
  pages: Page[];
  assets: AssetReference[];
  prototype: PrototypeGraph;
};

type Page = {
  id: string;
  name: string;
  frameIds: string[];
};

type Frame = {
  id: string;
  name: string;
  width: number;
  height: number;
  breakpoint?: string;
  rootNodeIds: string[];
};

type DesignNode = {
  id: string;
  type:
    | "frame"
    | "group"
    | "text"
    | "image"
    | "rect"
    | "ellipse"
    | "line"
    | "component-instance";
  name: string;
  parentId: string | null;
  children: string[];
  layout: LayoutSpec;
  style: StyleSpec;
  content?: unknown;
  componentRef?: string;
  variantProps?: Record<string, string | number | boolean>;
};
```

The names `TokenSet`, `ComponentDefinition`, `AssetReference`, `PrototypeGraph`, `LayoutSpec` and `StyleSpec` are conceptual placeholders; their field-level schemas have not been designed yet.

## Model areas to resolve before implementation

- ID ownership, parent/child consistency and z-order.
- Layout constraints, flex/grid semantics and breakpoint overrides.
- Token references, semantic aliases, themes and modes.
- Component definitions, variants, instances and instance overrides.
- Text runs, typography and accessibility metadata.
- Asset provenance, local storage, external references and import policy.
- Prototype edges, interactions, overlays and component states.
- Revision snapshots, patch history and schema migrations.
- Export behavior for unsupported or lossy constructs.

## AI patch requirements

An AI response should identify the document, the revision it was based on, a list of typed operations, and a human-readable summary. The server must validate the operation schema, target IDs and base revision before applying changes. A stale base revision must produce a conflict rather than silently overwriting newer edits.

See [Architecture](ARCHITECTURE.md) for the renderer and patch-engine proposal, and [API contracts](API_CONTRACTS.md) for the draft operation envelope.
