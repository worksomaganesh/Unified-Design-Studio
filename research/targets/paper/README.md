# Paper — research dossier

**Research status:** Official website and MCP documentation reviewed · **Direct REA validation:** Pending  
**Research date:** 2026-11-08

## Product role

Paper positions itself as a connected design canvas built on web standards. Its central idea is that design and code should use the same HTML/CSS vocabulary, reducing translation loss between visual work and implementation.

## Capabilities documented by Paper

- A visual canvas connected to code, agents, repositories and real data.
- Design content represented with HTML and CSS.
- Desktop application that starts a local MCP server and CLI.
- Agents can read and write Paper files, generate layouts, retrieve real content and turn a selected frame into code.
- Synchronization of design tokens, styles and components between canvas and codebase.
- Repetitive agent work such as responsive variants and style variations.

## Architectural lessons for UDS

1. Choose web-native layout semantics to improve design-to-code fidelity.
2. A selected frame should map to an implementation scope that can be inspected and handed off.
3. Tokens/components must sync with the codebase as structured resources, not as screenshots.
4. The MCP layer should expose a safe subset of design operations and use the same underlying mutations as the editor.
5. Keep code/design synchronization explicit, reviewable and revision-aware to avoid silent overwrites.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| HTML/CSS canvas representation | Renderer and document mapping | P0 |
| Local desktop MCP server concept | Local command/MCP adapter | P1 |
| Token/style/component sync | Design-system and code bridge | P0/P1 |
| Selected frame to code | Code exporter | P0 |
| Pull real app/API content | Context/import integrations | P1 |
| Team collaboration | Collaboration layer | P2 |

Paper is proprietary. We can study public documentation and authorized observable behavior; we should not copy its private implementation or assets. Public marketing claims do not establish every technical detail, so local MCP tool schemas and actual edit behavior still need direct validation.

## Direct REA validation plan

Using a permitted Paper project: connect its MCP server to an agent; read the active file; create/edit a frame; inspect how HTML/CSS maps to visual objects; change a token/component; sync to a local codebase; select a frame for code handoff; and compare the canvas after code changes. Record which direction of sync is supported and how conflicts are handled.

## Sources

- [Paper official website](https://paper.design/)
- [Paper MCP documentation](https://paper.design/docs/mcp)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Official product and MCP documentation review | Links above | Documented research; direct REA validation pending |

## Open questions

- Is Paper's underlying canvas document stored as HTML/CSS directly or in a richer intermediate representation?
- Which code-to-canvas changes synchronize automatically?
- How does it resolve simultaneous agent/user modifications?
- What exact MCP tools and local permissions are exposed?
