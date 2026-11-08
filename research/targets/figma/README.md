# Figma — research dossier

**Research status:** Official product and developer documentation reviewed 2026-11-08.  
**Direct REA validation:** Pending.  
**Implementation policy:** Proprietary product; use official APIs and user-authorized imports. Do not copy source code or proprietary assets.

## Product role

Figma is the reference for a professional node-based design editor and its ecosystem: frames, layers, vector objects, reusable components, variants, variables, prototyping, libraries, collaboration and developer handoff.

## Documented technical surface

- The Plugin API can read and modify file contents, including nodes, hierarchy, properties, positions, colors and text.
- The REST API can return a file's JSON document tree, nodes and rendered images, subject to scopes, file permissions and rate limits.
- The Variables REST API supports querying, creating, updating and deleting variables, but write requirements are more restrictive: Enterprise plan access and an eligible Full seat/admin permission are required for relevant operations.
- OAuth is the recommended integration pattern when acting on behalf of individual users. Personal access tokens are suitable for personal tooling; plan access tokens are organization/enterprise scoped.
- Rate limits vary by seat type, endpoint tier and resource plan. UDS must batch, cache, expose 429 errors and respect Retry-After.

## Architectural lessons for UDS

1. Use a typed node tree with stable identifiers and explicit parent/child ownership.
2. Separate component definitions from component instances and preserve instance overrides.
3. Treat design tokens/variables as referenced values with modes and publication state, not just hex strings.
4. Make prototype interactions part of the document model.
5. Build a read-only Figma importer first, using OAuth and the user's existing file access.
6. Map Figma node types to UDS node types with an explicit import report for unsupported/lossy properties.

## Access and integration constraints

- No universal Figma access: the user must authorize the file and scopes.
- Some API operations have seat/plan restrictions, including variables writes.
- REST endpoints are rate limited and may be restricted by plan tier.
- Import/export fidelity must be tested against actual files; do not promise full round-trip compatibility.
- A Figma plugin bridge could be considered later for operations not available through public REST endpoints, with user-initiated installation and permissions.

## Evidence status

| Finding | Classification |
|---|---|
| Plugin API read/write node model | Documented |
| REST file/node JSON and image endpoints | Documented |
| OAuth/PAT/plan-token options | Documented |
| Variables API Enterprise/Full-seat constraints | Documented |
| Internal Figma rendering and backend architecture | Unknown |

## UDS capability mapping

- Node/layer tree
- Components, variants and overrides
- Variables/tokens and modes
- Vector editing
- Interactive prototypes
- Figma import adapter
- Developer handoff

## Sources

- https://www.figma.com/
- https://developers.figma.com/docs/plugins/
- https://developers.figma.com/docs/plugins/api/api-reference/
- https://developers.figma.com/docs/rest-api/authentication/
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/variables/
- https://developers.figma.com/docs/rest-api/rate-limits/
