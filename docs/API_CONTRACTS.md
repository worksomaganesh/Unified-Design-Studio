# Internal API contracts — v0 baseline

**Status:** Project/document APIs, Phase 5 AI routes, Phase 7 code export routes, provenance-aware asset uploads, DTCG and Figma Variables adapters, Figma REST file import, supported Penpot v3 import, and bounded MCP read/write tools are implemented as described below. Live Figma and representative Penpot verification remain open.

## 1. Principles

- Internal service commands are the single mutation boundary for UI, AI, and MCP clients.
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
| Integrations | DTCG/Penpot/Tokens Studio exchange; credential-backed Figma Variables reads and create-only writes; Figma REST file import; supported Penpot v3 import; bounded MCP summaries and revision-checked text/rename commands; live external-file verification remains |

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

`POST /api/projects/:id/assets` accepts PNG, JPEG, WebP, GIF, SVG, PDF, Figma `.fig`, and Penpot `.penpot` files up to 20 MB. SVG is capped at 5 MB. Raster signatures are checked before files become canvas images; SVG, PDF, Figma `.fig`, and Penpot `.penpot` sources are retained as reference attachments with conversion metadata. Supported Penpot v3 archives also append converted pages to the project document. `GET /api/projects/:id/assets` returns the asset kind and provenance record, including source, original name, import time, hash, and intended usage. Existing assets are migrated as legacy local uploads. See migration `003_asset_provenance.sql` and [`INTEROPERABILITY.md`](INTEROPERABILITY.md).

## 8. Figma import and Variables routes

| Route | Purpose |
|---|---|
| `PUT/DELETE /api/integrations/figma/credential` | Store/remove the Figma access token in Windows Credential Manager. |
| `POST /api/integrations/figma/file/import` | Read one Figma file via the REST API, optionally read local Variables, and return converted pages/design tokens for the editor's local draft. Requires `file_content:read`; variable binding import also requires `file_variables:read`. |
| `POST /api/integrations/figma/variables/read` | Read local Variables collections, modes, and values. |
| `POST /api/integrations/figma/variables/write` | Create new Variables collections and values after an explicit UI confirmation and revision check; existing remote Variables are not updated or deleted. |

File import caps the Figma document response at 20 MB and Variables JSON at 5 MB. The editor checks its local change version before applying a returned import, then persists through its normal Save action. Figma file reads are read-only; `.fig` archive uploads remain downloadable references. See [`INTEROPERABILITY.md`](INTEROPERABILITY.md) for conversion losses and account requirements.

## 9. Error categories

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `REVISION_CONFLICT`
- `UNSUPPORTED_OPERATION`
- `ASSET_UNAVAILABLE`
- `PROVIDER_ERROR`
- `EXPORT_ERROR`
- `INTERNAL_ERROR`

## 10. Planned async jobs

Long-running generation, import, screenshot, preview and export may later return a job ID and status stream. Current Phase 5 AI requests are synchronous and non-streaming. Any future job system should persist summaries and avoid logging secrets or full sensitive prompts by default.

## 11. MCP boundary

`pnpm --filter @uds/local-server mcp` starts the local `stdio` server. The Studio must have created the database first. `UDS_DATA_DIR` can point both processes at the same data folder. Read tools are `list_projects`, `get_project_summary`, and `get_node_summaries`. Optional writes are `set_layer_text` and `rename_layer`. Inputs are schema-validated, project IDs are UUIDs, output is capped, and text is truncated. It does not return local file paths, binary assets, credentials, full document snapshots, or arbitrary prototype payloads.

Both write tools call the schema-validated, revision-checked document save command used by the Studio. They affect only one existing layer's text or name, create a revision, and reject stale revisions. Their descriptions and annotations mark them as mutating; the host should show the change and obtain user approval before invocation. No arbitrary shell, filesystem, or unrestricted network tool is exposed. See [`INTEROPERABILITY.md`](INTEROPERABILITY.md) for DTCG/Penpot/Tokens Studio exchange limits and local Antigravity configuration guidance.
