# API contracts (proposed)

**Status:** Draft interface boundaries only. No API routes, server processes or MCP tools are implemented in this repository yet. Final transport, authentication and exact request/response schemas must be decided during the implementation spikes.

## Contract principles

- The internal command API is the stable application boundary; MCP is an adapter over selected commands, not the source of business logic.
- All document mutations identify the document and base revision.
- Inputs are schema-validated; mutations return the new revision and a structured result.
- Errors must be machine-readable and distinguish validation failures, missing resources, permission failures and revision conflicts.
- Long-running generation, import, preview and export work must expose asynchronous status rather than blocking editor input.

## Proposed command groups

| Domain | Responsibilities |
|---|---|
| Projects | Create, list, rename, duplicate, archive, reopen and delete projects. |
| Documents | Load, save, validate, migrate and snapshot versioned design documents. |
| Nodes | Read and edit selected nodes; create, move, resize, reorder and delete supported node types. |
| Design systems | Manage token sets, themes, component definitions, variants and instances. |
| Generation | Produce screen plans and design directions from user-provided context. |
| AI patches | Validate and apply revision-aware operations against stable node IDs. |
| Preview / prototype | Render a document, manage viewport presets and resolve prototype navigation. |
| Export | Produce React/CSS, tokens, assets and preview artifacts; report unsupported constructs. |
| Integrations | Expose selected project/document actions to agent clients through a later MCP adapter. |

## AI patch envelope (illustrative)

```json
{
  "documentId": "doc_123",
  "baseRevision": 12,
  "operations": [
    {
      "op": "setText",
      "nodeId": "text_9",
      "value": "Book a pod"
    },
    {
      "op": "setStyleToken",
      "nodeId": "button_2",
      "property": "background",
      "token": "color.action.primary"
    }
  ],
  "summary": "Updated the hero CTA and button treatment"
}
```

The identifiers and values above are examples only. The actual operation union, validation rules and response envelope are not frozen.

## Required mutation behavior

1. Validate the request schema and operation types.
2. Confirm the document exists and the requested project scope is authorized.
3. Compare `baseRevision` with the current document revision.
4. Validate every referenced node and token.
5. Apply the operation set atomically where practical.
6. Persist the new revision and patch record.
7. Return the new revision, applied operations and summary.

If the base revision is stale, return a conflict and do not apply the patch. The editor can then request a rebase or ask the user to resolve the conflict.

## MCP boundary

Expose only selected commands after the internal API is stable. Keep permissions narrow and require confirmation for destructive, external-network and export operations. REA is a research tool and is not part of the product's MCP runtime.
