# Design Core

`@uds/design-core` owns the versioned schema and runtime validation for UDS design documents.

The current schema (version 2) includes pages, recursive frame/container/text/image/shape nodes, typed design tokens, themes and modes. Color tokens support aliases and validated mode overrides; text and shape layers can reference color tokens. Containers store block, flex or grid intent and explicit dimensions. `migrateDocument` upgrades version-1 snapshots by adding the default design system, while `validateDocument` accepts the current schema before persistence or rendering.

```ts
import { migrateDocument, resolveDesignToken } from "@uds/design-core";

const document = migrateDocument(input);
const brandColor = resolveDesignToken(document.designSystem, "token-id", "mode-id");
```
