# OpenDesign — research dossier

**Canonical target:** https://github.com/nexu-io/open-design  
**Research status:** Public documentation and source configuration inspected 2026-11-08.  
**Direct REA validation:** Pending.  
**License:** Apache-2.0 (verified in repository root LICENSE and package metadata).

## Product role

OpenDesign is a local-first, agent-driven design workspace. It combines a local daemon, a web/desktop workspace, project artifacts, agent runtimes, skills, design systems and templates. It supports more than website mockups: prototypes, presentations, images, video/motion and other visual deliverables.

## Source-inspected implementation clues

The current repository shows:

- A pnpm monorepo with Node.js `~24` and pnpm `10.33.x` requirements.
- A separate TypeScript daemon package (`apps/daemon`) and a Next.js web application (`apps/web`).
- The web package uses React 18.3.1, Next.js 16, Tailwind CSS 4 and shared workspace packages (versions are repository snapshot values, not UDS recommendations).
- The daemon uses TypeScript, Express, the MCP SDK, `better-sqlite3`, file/artifact stores and runtime adapters.
- Agent skills, design systems (`DESIGN.md`), design templates and plugins are first-class, inspectable project resources.
- Structured agent runtimes can write canonical project files while artifact/preview surfaces update from those writes.
- The app supports local runtimes and BYOK provider endpoints; it also has a sandboxed artifact preview.

These are source-inspected facts about this repository snapshot. They are not claims about every OpenDesign deployment or every optional adapter.

## Architectural lessons for UDS

1. Separate the UI shell from the local project/agent daemon.
2. Store projects and generated artifacts as inspectable files with metadata and revisions.
3. Use a registry for model/agent adapters, templates, design systems and skills.
4. Keep persistent project context and agent conversations; don't rebuild context from scratch each session.
5. Provide an explicit provider/runtime configuration boundary.
6. Stream tool and artifact events to the UI while keeping the design document as the durable source of truth.

## What we should not copy blindly

- OpenDesign's wide artifact scope (slides, media, audio/video and many agent runtimes) is broader than UDS MVP.
- Its internal daemon and workspace implementation should be studied, not transplanted wholesale.
- Apache-2.0 permits reuse subject to its conditions, but every dependency, notice, asset and copied file still needs a license/provenance review.
- The McAfee alert on a downloaded installer is a separate security question. An Apache-2.0 license does not certify an executable as malware-free or safe.

## Evidence status

| Finding | Classification |
|---|---|
| Apache-2.0 license | Source-inspected |
| Node 24 / pnpm 10 package requirements | Source-inspected |
| Next.js web app + separate TS daemon | Source-inspected |
| SQLite store, MCP SDK and runtime registry | Source-inspected |
| Desktop and local-first workflows | Documented/source-inspected |
| Exact runtime behavior on the user's Windows laptop | Unknown until local validation |

## UDS capability mapping

- Local workspace/daemon separation
- Project and artifact persistence
- Agent/runtime registry
- Skill and design-system registries
- Context-aware agent sessions
- Sandboxed previews

## Sources

- https://github.com/nexu-io/open-design
- https://github.com/nexu-io/open-design/blob/main/README.md
- https://github.com/nexu-io/open-design/blob/main/QUICKSTART.md
- https://github.com/nexu-io/open-design/blob/main/package.json
- https://github.com/nexu-io/open-design/blob/main/apps/daemon/package.json
- https://github.com/nexu-io/open-design/blob/main/apps/web/package.json
- https://open-design.ai/faq/
