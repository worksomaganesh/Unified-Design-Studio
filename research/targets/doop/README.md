# Doop — research dossier

**Research status:** Product docs and upstream source review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08 · **Upstream:** [kgoedecke/doop](https://github.com/kgoedecke/doop)

> Product name spelling: **Doop** (not “Dope”). This dossier studies Doop and its MCP canvas.

## Product role

Doop is an infinite, multiplayer design canvas for humans and AI agents. Canvas pages contain frames that render real HTML. Agents connect through MCP and can create frames, stream/edit HTML, inspect screenshots, read feedback and work alongside humans.

## Capabilities and implementation evidence

- Canvas pages, frames and layer metadata.
- HTML frame content rendered inside sandboxed iframes.
- MCP operations for reading canvas/frame context, creating/updating frames, appending streamed HTML, capturing screenshots, prototype wiring and design tokens.
- Shared mutation/action layer so browser UI and MCP edits use consistent application behavior.
- WebSocket rooms for live presence, cursors, activity and frame updates.
- Version history, comments, feedback and approvals.
- Current upstream code: React + Vite + Zustand client; Node/TypeScript + Express server; PGlite/Drizzle with PostgreSQL-compatible storage; WebSocket transport; MCP Streamable HTTP.
- Self-hosting is documented, but certain cloud integrations are not necessarily included in the self-hosted distribution.

The upstream README describes a frame runtime that morphs HTML in place through a bootstrap and message bridge rather than fully reloading the frame on every stream update.

## Architectural lessons for UDS

1. Make the canvas a shared surface for people and agents.
2. Implement a single command/action service; UI controls and MCP must not have separate mutation logic.
3. Keep stable element identifiers in generated HTML so comments and agent feedback can target an element.
4. Stream incremental generation into a preview, but commit validated document revisions rather than allowing unbounded raw HTML writes.
5. Capture screenshots after major AI edits and make visual review part of the agent workflow.
6. Model canvas pages, frames and design tokens independently of the collaboration transport.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Canvas with pages/frames | Canvas/document model | P0 |
| HTML/CSS live preview | Renderer/preview | P0 |
| Element-linked feedback | Selection/comment layer | P1 |
| MCP read/write canvas tools | Agent command adapter | P1 |
| Streaming generation | AI job/event stream | P1 |
| Real-time cursors/multiplayer | Collaboration | P2 |
| Canvas memory/style references | Design-system/context service | P1 |

## License and reuse

The current upstream README and LICENSE identify **GNU AGPL-3.0**. This corrects an older or inconsistent marketing reference that described MIT. Do not copy Doop implementation code into UDS unless we explicitly choose the AGPL obligations after reviewing the full license and distribution model. We can still study documented behavior and independently implement compatible ideas. Doop's name/logo are not granted by its software license.

## Direct REA validation plan

Use an authorized canvas: create a page/frame; stream HTML via MCP; view the same update in the browser; edit a frame manually; add token(s); pin a comment to an element; wire a prototype; inspect a screenshot and restore a frame version. Verify which tools are available in the current release and which require the hosted service.

## Sources

- [Doop GitHub repository and architecture](https://github.com/kgoedecke/doop)
- [Doop license](https://github.com/kgoedecke/doop/blob/main/LICENSE)
- [Doop MCP getting started](https://doop.design/docs/get-started)
- [Doop MCP documentation](https://doop.design/docs)
- [Doop product website](https://doop.design/)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Current README, package manifest, MCP source and docs review | Links above | Source review complete; direct REA observation pending |

## Open questions

- Which operations are transactional and how are conflicting human/agent edits resolved?
- What is the exact schema for frames, layers, comments and tokens?
- Which iframe bridge messages are permitted and validated?
- What functionality differs between self-hosted and Doop Cloud?
