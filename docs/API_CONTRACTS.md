# Internal API contracts — v0 baseline

**Status:** Phase 1 contract baseline. Project/document APIs, Phase 5 AI routes, Phase 7 code export routes, and provenance-aware asset uploads are implemented as described below. Figma/Penpot interchange and MCP adapter commands remain planned.

## 1. Principles

- Internal service commands are the single mutation boundary for UI, AI and later MCP clients.
- Validate all input/output at runtime.
- Scope every operation to an authorized local project/document.
- Use revision preconditions for mutations.
- Return actionable HTTP errors; never silently discard unsupported operations.
- Future long-running generation/import/export should report status; current Phase 5 AI requests are synchronous.

## 2. Command groups

| Group | Operations |
|---|---|
| Projects | create/list/open/rename/duplicate/archive/delete |
| Documents | load/save/validate/migrate/snapshot/revision-history/restore |
| Assets | upload, list with provenance, download, remove; SVG/PDF are reference-only |
| Nodes | create/update/move/resize/reorder/delete |
| Design system | token/theme/component/variant operations |
| UX planning | parse brief, propose flow, approve screen inventory |
| Generation | generate direction, generate screen set, revise selection |
| Prototype | configure document-stored interactions, variables/bindings and component-state actions; run isolated preview |
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
      "op": "setFill",
      "nodeId": "node_primary_button",
      "value": "#5948dd"
    }
  ],
  "summary": "Updated the hero message and primary action"
}
```

Phase 5 currently accepts `setText`, `setFill`, `setColor`, `setFontSize`, and `setName`. The server validates the proposal, selection scope, node type, and base revision. Applying approved operations happens in the editor as one undoable change; normal document save persists a new revision.

## 4. Mutation lifecycle

1. Validate the project, document schema, selected node IDs, and base revision.
2. Send a compact document summary and selected layer summaries to the chosen provider.
3. Validate the returned proposal and ensure every operation targets a selected node of the expected type.
4. Check the persisted revision again after the provider responds.
5. Let the user accept or reject proposed operations individually.
6. Check the editor's local change counter and current document revision before applying accepted operations as one undoable edit.
7. Save through the normal revision-checked document route to persist the edit.

If a persisted or local revision is stale, return a conflict or reject application; do not silently overwrite.

## 5. Implemented AI routes

| Route | Purpose |
|---|---|
| `GET /api/ai/providers` | List adapter capabilities and configured-key status. |
| `PUT /api/ai/provider` | Persist selected provider (`openai`, `anthropic`, `google`, or `none`). |
| `PUT/DELETE /api/ai/credentials/:provider` | Store or remove a provider key through the local service. |
| `POST /api/projects/:id/ai/plan` | Create a validated flow and screen inventory from a brief and selected images. |
| `POST /api/projects/:id/ai/generate` | Generate distinct, schema-validated design directions for an approved inventory. |
| `POST /api/projects/:id/ai/revise` | Return a selection-scoped patch proposal for review. |

Generation and revision calls are synchronous with a 120-second provider timeout. They do not mutate or persist the document. AI implementation and data-scope details are in [`AI_GENERATION.md`](AI_GENERATION.md).

Validation and payload errors return `400` (or `413` for oversized reference selections), stale revisions return `409`, and provider/structured-output failures return `502`. Missing provider credentials or model IDs return `400` with a setup message.

Document saves require the current revision and append an immutable snapshot. Restore copies an earlier snapshot into a new revision; it never rewinds or deletes revision history.

Prototype graphs are embedded in the version 2 design document and saved through `PUT /api/projects/:id/document`; Phase 6 does not add a separate prototype API route.

## 6. Code export routes

| Route | Purpose |
|---|---|
| `GET /api/projects/:id/code-export/report?gitReady=true` | Summarize the current saved revision, supported/limited constructs, image availability, and bundle files; include Git handoff files in the outline when requested. |
| `GET /api/projects/:id/code-export?gitReady=true` | Return a ZIP with React/Vite, static HTML/CSS, design-system JSON, a support report, setup notes, and available project images. The optional query adds `.gitignore` and local Git setup instructions. |

Export reads the latest persisted document revision. The Studio saves pending edits before requesting the ZIP. The exporter omits external or unavailable images, limits each image to 20 MB and the total assets to 100 MB, and packages only supported raster image MIME types. Export is local and does not initialize Git or modify project files. The optional Git-ready archive includes ignore rules and commands for the user to run after extraction. See [`CODE_HANDOFF.md`](CODE_HANDOFF.md) for current renderer limits and preview policy.

## 7. Asset import and provenance

`POST /api/projects/:id/assets` accepts PNG, JPEG, WebP, GIF, SVG, and PDF uploads up to 20 MB. SVG is capped at 5 MB. Raster signatures are checked before files become canvas images; SVG and PDF are stored as reference-only attachments and are served with download disposition and `nosniff`. `GET /api/projects/:id/assets` returns the asset kind and provenance record, including source, original name, import time, hash, and intended usage. Existing assets are migrated as legacy local uploads. See migration `003_asset_provenance.sql`.

## 8. Error categories

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `REVISION_CONFLICT`
- `UNSUPPORTED_OPERATION`
- `ASSET_UNAVAILABLE`
- `PROVIDER_ERROR`
- `EXPORT_ERROR`
- `INTERNAL_ERROR`

## 9. Planned async jobs

Long-running generation, import, screenshot, preview and export may later return a job ID and status stream. Current Phase 5 AI requests are synchronous and non-streaming. Any future job system should persist summaries and avoid logging secrets or full sensitive prompts by default.

## 10. MCP boundary

MCP is a thin adapter over the same internal command service. Initial read-only tools may expose project summary, document summary, selected nodes and design-system metadata. Write tools are added only after mutation validation and permission checks are stable. No arbitrary shell, filesystem or unrestricted network tool is exposed.
