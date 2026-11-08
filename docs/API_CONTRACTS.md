# Internal API contracts — proposed v0

**Status:** Conceptual contracts for Phase 1; no API is implemented yet.

## 1. Principles

- Internal service commands are the single mutation boundary for UI, AI and later MCP clients.
- Validate all input/output at runtime.
- Scope every operation to an authorized local project/document.
- Use revision preconditions for mutations.
- Return typed errors; never silently discard unsupported operations.
- Long-running generation/import/export is asynchronous and reports status.

## 2. Command groups

| Group | Operations |
|---|---|
| Projects | create/list/open/rename/duplicate/archive/delete |
| Documents | load/save/validate/migrate/snapshot |
| Nodes | create/update/move/resize/reorder/delete |
| Design system | token/theme/component/variant operations |
| UX planning | parse brief, propose flow, approve screen inventory |
| Generation | generate direction, generate screen set, revise selection |
| Prototype | connect frames, configure triggers/actions, preview |
| Export | React/CSS, tokens, assets, image/SVG |
| Integrations | later Figma/Penpot/GitHub/MCP adapters |

## 3. AI patch envelope

```json
{
  "documentId": "doc_123",
  "baseRevision": 12,
  "operations": [
    {
      "op": "setText",
      "nodeId": "node_hero_title",
      "value": "Design, build and ship"
    },
    {
      "op": "setStyleToken",
      "nodeId": "node_primary_button",
      "property": "background",
      "tokenId": "color.action.primary"
    }
  ],
  "summary": "Updated the hero message and primary action"
}
```

This is illustrative, not the final operation union. Phase 1 defines allowed operations and Zod schemas.

## 4. Mutation lifecycle

1. Authenticate/authorize local project scope.
2. Validate envelope and operation types.
3. Check document ID and base revision.
4. Validate node IDs, token IDs, asset references and operation permissions.
5. Apply the complete operation batch transactionally.
6. Persist new document revision and operation log.
7. Return new revision, applied operations and summary.
8. If revision is stale, return a conflict; do not silently overwrite.

## 5. Error categories

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `REVISION_CONFLICT`
- `UNSUPPORTED_OPERATION`
- `ASSET_UNAVAILABLE`
- `PROVIDER_ERROR`
- `EXPORT_ERROR`
- `INTERNAL_ERROR`

## 6. Async jobs

Generation, import, screenshot, preview and export return a job ID and status stream. Events include accepted, progress, output-chunk, review-required, completed and failed. Persist job summaries; avoid logging secrets or full sensitive prompts by default.

## 7. MCP boundary

MCP is a thin adapter over the same internal command service. Initial read-only tools may expose project summary, document summary, selected nodes and design-system metadata. Write tools are added only after mutation validation and permission checks are stable. No arbitrary shell, filesystem or unrestricted network tool is exposed.
