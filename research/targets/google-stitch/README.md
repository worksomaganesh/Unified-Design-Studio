# Google Stitch — research dossier

**Research status:** Official announcements and tooling review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08

## Product role

Stitch is an AI-native software-design canvas. Its distinct strength is a multimodal, continuously evolving project context rather than a single prompt producing one isolated screen.

## Capabilities documented by Google

- An infinite canvas for ideas, screens and prototypes.
- Text, image and code can be added as design context.
- A design agent that reasons across the project's evolution.
- An agent manager for tracking and parallelizing design directions.
- Voice interaction for interviews, critique and live design changes.
- Design-system extraction from a URL and portable `DESIGN.md` import/export.
- Stitch MCP server and SDK for agent workflows.
- Export/hand-off to Google AI Studio, Antigravity and Netlify.

Google's March 18, 2026 announcement introduced the AI-native infinite canvas and voice/design-agent direction; its May 19, 2026 update described real-time collaborative streaming and steering of design iterations.

## Architectural lessons for UDS

1. Treat project context as a first-class object: brief, references, existing screens, assets, design rules and prior decisions.
2. Support divergent alternatives and convergent selection, not just one generated answer.
3. Let users steer generation while it is happening, but apply accepted changes through the same validated document mutation pipeline as manual edits.
4. Make `DESIGN.md` a portable exchange format backed by structured token/component data.
5. Add voice only as another input modality; do not couple core generation to voice.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Infinite zoom/pan workspace | Canvas viewport | P0 |
| Text/image/code references | Context manager | P0/P1 |
| Multi-direction generation | AI generation orchestration | P0 |
| Agent task manager | AI job panel | P1 |
| Portable `DESIGN.md` | Design-system interchange | P0 |
| Voice conversation | Multimodal input adapter | P2 |
| Stitch-specific MCP | Not a dependency; learn from its interoperability | — |

Stitch is proprietary. Use publicly documented features and authorized integrations; do not depend on undocumented internal APIs.

## Direct REA validation plan

Observe an authorized project: add a text brief, add an image and code reference, ask for multiple screen directions, steer an in-progress change, use the voice workflow if available, import/export `DESIGN.md`, and test MCP/Antigravity handoff. Capture whether changes are streamed, checkpointed or committed as complete screen revisions.

## Sources

- [Google Labs: Introducing vibe design with Stitch — 2026-03-18](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/)
- [Google Labs: Real-time design updates — 2026-05-19](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/)
- [Google Developers: From idea to app — 2025-05-20](https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/)
- [Stitch npm CLI/MCP package](https://www.npmjs.com/package/@google/stitch)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Google official announcements and CLI/MCP package review | Links above | Documented research; direct REA validation pending |

## Open questions

- What is the persisted project/screen object model?
- How are parallel agent outputs merged and conflicts represented?
- Which parts of `DESIGN.md` are machine-readable and round-trip stable?
- Which MCP/SDK operations are officially supported and rate-limited?
