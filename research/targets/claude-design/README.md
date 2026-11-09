# Claude Design — research dossier

**Research status:** Public-source research consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08 · **Evidence class:** Documented claims and architectural inference; no hands-on session recorded.

## Product role

Claude Design combines a conversation with a visual canvas. The user describes an outcome, supplies context such as screenshots, assets, design files or a codebase, and receives an editable visual artifact. The artifact can be refined through chat, inline comments and direct on-canvas editing.

## Capabilities worth studying

- Prompt and contextual-input driven design generation.
- A persistent canvas alongside the conversation.
- Direct element manipulation: drag, resize and align.
- Selection/inline-comment feedback for localized changes.
- Design-system ingestion from repositories, design files, brand assets and local codebases.
- Design-to-code continuity through Claude Code, including `/design` and `/design-sync`.
- Exports including ZIP, PDF, PPTX, Google Slides and standalone HTML, plus integrations with downstream tools.

## Architectural lessons for UDS

1. Treat the conversation as the reasoning and orchestration surface, not as the design document itself.
2. Keep the editable canvas as the authoritative artifact.
3. Provide three feedback scopes: direct manipulation for small visual changes, selection comments for localized changes, and chat for structural changes.
4. Make design-system context available before generation and validate output against that system.
5. Handoff should preserve structure, tokens, assets and implementation context—not merely produce a screenshot.

## Limitations and time-sensitive notes

The current Claude Help Center describes Claude Design as available through Claude conversations, Artifacts and Claude Code. It says the standalone `claude.ai/design` experience is scheduled to close on **2026-12-14**; therefore UDS should study the integrated workflow rather than build around the standalone URL. The same help article notes limitations including basic simultaneous multi-person editing and no conventional version history at the time of publication. Recheck these details before using them as long-term assumptions.

Claude Design is proprietary. Study documented behavior and observable interaction patterns; do not copy private source code, brand assets or protected UI assets.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Conversation + canvas | AI Studio / editor workspace | P0 |
| On-canvas editing | Canvas interaction engine | P0 |
| Selection-scoped feedback | AI patch engine | P0 |
| Design-system ingestion | Token/component importer | P0/P1 |
| Claude Code-style handoff | Code exporter / local project bridge | P0 |
| Team collaboration | Collaboration layer | P2 |

## Direct REA validation plan

Use a dedicated authorized test project. Record: start a design from conversation; attach a reference; generate; select a component; add an inline comment; drag/resize; invoke a structural chat change; export; and hand off to Claude Code if account access permits. Capture screenshots and record which operations modify the artifact, what stays stable, and which actions require a paid plan.

## Sources

- [Claude Design — Get started](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)
- [Set up your design system in Claude Design](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design)
- [Introducing Claude Design](https://www.anthropic.com/news/claude-design-anthropic-labs)

## Evidence log

| Date | Workflow | Evidence ID | Status |
|---|---|---|---|
| 2026-11-08 | Official product/help documentation review | Web sources linked above | Documented research; direct REA observation pending |

## Open questions

- Which canvas operations can be expressed as structured edits versus regenerations?
- What exact metadata survives design-to-code handoff?
- What file format is used for editable design state?
- How do design-system imports represent component props, variants and token aliases?
