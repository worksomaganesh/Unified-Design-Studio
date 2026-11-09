# OpenDesign — research dossier

**Research status:** Public-source and source-repository review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08 · **Upstream repository:** [nexu-io/open-design](https://github.com/nexu-io/open-design)

## Product role

OpenDesign is a local-first, open-source workspace for coding agents to create and refine prototypes and other visual artifacts. Its product architecture is particularly relevant to UDS because it separates reusable agent behavior, renderable design templates, brand systems and runnable plugins.

## Capabilities and architecture documented upstream

- Four composable content planes: **plugins** (runnable workflows), **functional skills** (agent behavior), **design templates** (rendering blueprints) and **design systems** (brand rules/assets).
- A web app built with Next.js 16 App Router, React 18 and TypeScript.
- A Node 24 / Express daemon with SSE streaming and `better-sqlite3`.
- An optional Electron desktop shell and sidecar/IPC integration.
- Multiple agent runtimes and adapters, including CLI and Agent Client Protocol integrations.
- Local projects and conversations, sandboxed artifact previews and export workflows.
- A BYOK proxy for supported model providers, with an explicit network/SSRF boundary.
- A portable `DESIGN.md` and registry-style approach to skills, templates, systems and plugins.

The upstream README and architecture guide are the authority for exact implementation details; older architecture sketches in the upstream repository are explicitly marked as historical.

## Architectural lessons for UDS

1. Separate **agent instructions**, **design-generation templates**, **brand/design systems** and **executable integrations**. They solve different problems and should not be one overloaded plugin format.
2. Keep the project daemon as the authority for persistence, file operations and agent lifecycle; the browser UI should not become a second competing database.
3. Use streaming events for long-running agent tasks while maintaining a durable project/conversation record.
4. Make design systems portable and versionable. A human-readable guide should accompany machine-readable tokens and component metadata.
5. A local-first tool needs explicit trust boundaries for filesystem access, imported files, provider credentials and preview execution.

## UDS implementation mapping

| OpenDesign pattern | UDS adaptation | Priority |
|---|---|---|
| Functional skills | Agent capability/instruction registry | P1 |
| Design templates | Screen/page generation templates | P1 |
| Design systems | Portable token + component package | P0 |
| Plugins | Later integration extension points | P2 |
| Local daemon + SQLite | Local project service + SQLite | P0 |
| SSE agent output | Job/event stream | P1 |
| Sandboxed preview | Isolated preview runtime | P0 |

UDS should not copy OpenDesign's broad scope for slides, images, video or motion graphics in the first release. Our initial scope is product UI, prototypes and frontend handoff.

## License and reuse

The upstream repository declares **Apache License 2.0**. Reuse may be possible subject to the license, preservation of required notices, change notices for modified files, third-party licenses and a dependency/security review. Apache-2.0 does not grant rights to upstream names, trademarks or assets. No upstream code is being copied into UDS as part of this research phase.

## Direct REA validation plan

If the desktop/web app can be accessed legitimately, inspect: create project from brief; choose a design template; choose a design system; launch or connect an agent; observe streaming; edit output; reopen project; export artifact. Capture process/daemon boundaries only when observable and avoid collecting API keys, credentials or private project content.

## Sources

- [OpenDesign GitHub repository](https://github.com/nexu-io/open-design)
- [OpenDesign architecture](https://github.com/nexu-io/open-design/blob/main/docs/architecture.md)
- [OpenDesign license](https://github.com/nexu-io/open-design/blob/main/LICENSE)
- [OpenDesign product website](https://open-design.ai/)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | README, architecture and license source review | Upstream links above | Source review complete; direct browser observation pending |

## Open questions

- Which local project files are canonical and which are caches/artifacts?
- What is the registry schema/versioning and plugin permission model?
- How are preview capabilities isolated from the daemon?
- Which capabilities require cloud services versus work entirely offline?
