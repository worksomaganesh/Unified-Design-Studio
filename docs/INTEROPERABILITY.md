# Interoperability

Phase 8 adds bounded design-token exchange and an MCP connection with narrowly scoped read and write tools. These paths preserve supported information and report conversions that would be lossy.

## Design-token JSON

The Studio imports and exports DTCG 2025.10 token JSON. Penpot documents DTCG-compatible token import/export and supports single-file token sets and themes. Tokens Studio for Figma can also exchange DTCG JSON. The Studio imports Figma Variables REST `GET .../variables/local` responses and can call that endpoint directly from the Design System panel. It can export a `POST .../variables` create payload as JSON or submit it directly to Figma. Direct writes create new collections and variables; they do not update or delete existing Figma content. The panel asks before sending the payload and checks the current project revision. Figma tokens are kept in Windows Credential Manager; no account credential is stored in the project. The same panel can import file content through Figma's read-only file endpoint.

The import accepts:

- UDS version 1 design-system JSON, including tokens, themes, modes, and components.
- DTCG token JSON with nested groups and inherited `$type` values.
- Penpot/Tokens Studio set JSON using `$themes`, `$metadata`, `selectedTokenSets`, or legacy `value`/`type` token fields.

The external token import understands colors, numbers, dimensions, font families, font sizes, line heights, and radii. Simple legacy shadow and border values can also be read. Active token-set order determines which duplicate token value wins in each imported mode. Token names and same-typed existing IDs are retained where possible, so canvas references can survive a replacement import.

Figma Variables import keeps locally created collections and modes and skips remote library variables and extended collections. It maps color, float, and string values to supported UDS tokens; strings are treated as font-family values and reported. Aliases are resolved to their current values. Boolean values and composed-color expressions are skipped or reported. Figma FLOAT values cannot retain UDS units, and unsupported shadow/border types are omitted with warnings.

The Figma Variables REST API is available to full members of Enterprise organizations; reads require `file_variables:read`, and writes require edit access to the file plus `file_variables:write`. File content import calls `GET /v1/files/:key`, which requires `file_content:read`. A user must have an eligible account and file before the live integrations can be verified. The panel displays a clear error when Figma denies access. Direct sync has not yet been verified against a real authorized Figma file.

External aliases are resolved to their current values. This keeps the appearance when importing, but the link between aliased tokens is not retained. Unsupported token values are reported and omitted. If removing a token would break a canvas or component reference, the document validator rejects the import.

The DTCG export carries the current mode values as token sets and maps UDS themes to external theme groups. It supports colors representable as hex/sRGB, numbers, px/rem dimensions, font families, font sizes, line heights, and px/rem radii. CSS colors that cannot be converted to DTCG sRGB values, percentage dimensions, shadow/border tokens, and names that collide after path conversion are reported and omitted. The `com.unified-design-studio` token extension preserves UDS-specific token kinds such as `font-size` and `radius` for a round trip; other tools can ignore that extension.

Token files over 5 MB and files containing more than 5,000 tokens are rejected. Imports are local and replace the document's token set while retaining its component definitions.

## Asset references

PNG, JPEG, WebP, and GIF assets can be placed on the canvas. SVG and PDF files are signature-checked, stored with local-upload provenance, and offered as reference-only downloads. Penpot v3 `.penpot` ZIP exports preserve the original file and import pages, frames, groups, text, rectangles, ellipses, color tokens, and basic component definitions into the current project's next revision. The importer validates ZIP paths, size limits, entry integrity, and the resulting UDS document. It reports unsupported image/vector layers and token losses. Penpot v1 binary exports remain reference-only. Figma `.fig` uploads remain downloadable references.

## MCP adapter

The MCP server is separate from REA. REA is the browser observation integration; the UDS server exposes this Studio's saved project metadata to an MCP host.

From the repository root, run:

```powershell
pnpm --filter @uds/local-server mcp
```

The Studio must have been opened once so its local database exists. The MCP server uses the same default data folder as the Studio; set `UDS_DATA_DIR` in both processes only if the data folder was customized. Node.js 24 or newer and the workspace pnpm installation are required.

The three read-only tools are:

- `list_projects`: project IDs, names, and update times, with a 50-project maximum.
- `get_project_summary`: saved page/layer counts, revision, design-system counts, and prototype counts.
- `get_node_summaries`: up to 50 explicitly requested layer summaries from one saved page; text is truncated to 500 characters.

The server returns no credentials, local file paths, binary assets, full document snapshots, or arbitrary prototype data. Antigravity is connected from its user-level MCP configuration with an `enabledTools` allowlist containing only `list_projects`, `get_project_summary`, and `get_node_summaries`; this machine-specific config is not stored in the project. Two optional server write tools are available: `set_layer_text` and `rename_layer`; Antigravity does not expose them in the current connection. Each accepts one existing layer ID, page ID, project ID, and expected revision; it cannot add, delete, or move layers, and every successful change creates a new document revision. Stale revisions are rejected. The host should show the mutation and obtain user approval before either write tool is enabled.

## Native design files and remaining work

- Figma REST file import converts supported pages, frames, auto-layout containers, groups, text, rectangles, ellipses, lines, local component definitions/instances, and color-variable bindings. It skips unsupported vector paths and image bytes; it reports omitted strokes, clipping, rotation, rich-text runs, multiple fills, auto-layout padding, component property overrides, and component variant relationships. Direct `.fig` decoding is not implemented; `.fig` uploads remain downloadable references. File import requires `file_content:read`; local token values and bindings are included when the additional `file_variables:read` access is available.
- Full-fidelity Penpot conversion. The current v3 importer handles supported page/layer/token/component subsets; it skips embedded images, paths, boolean/vector shapes, component variants/instances, transforms, gradients, strokes, and other features outside the UDS model. The original file is retained for round-trip reference.
- Lossless conversion of every token type, arbitrary composite tokens, or multi-dimensional theme combinations.
- Live verification of Figma file/Variables import with an eligible account and file, review of a representative Penpot v3 export, and live Antigravity/REA review of token workflows in a temporary Studio project. The Antigravity read-only `list_projects` connection and REA capture of the running Studio home screen have been verified.
- Broader MCP writes such as adding, deleting, moving, or reordering layers. Any future write tools must use revision-checked application commands and expose their mutation behavior to the host.

## Format references

- [DTCG Design Tokens Format Module 2025.10](https://www.designtokens.org/TR/2025.10/format/) — stable Community Group report for cross-tool token files.
- [Penpot design-token import and export](https://help.penpot.app/user-guide/design-systems/design-tokens/) — Penpot supports token sets/themes and DTCG-compatible JSON.
- [Penpot v3 native file format](https://help.penpot.app/technical-guide/developer/data-model/penpot-file-format/) — archive structure, pages, shapes, tokens, components, media, and versioning.
- [Tokens Studio token format](https://docs.tokens.studio/manage-settings/token-format) — Figma plugin formats, including DTCG.
- [Figma Variables REST API](https://developers.figma.com/docs/rest-api/variables-endpoints/) — direct variables API access requirements and payload shape.
- [Google Antigravity MCP configuration](https://antigravity.google/docs/mcp) — workspace and user-level MCP server setup.
