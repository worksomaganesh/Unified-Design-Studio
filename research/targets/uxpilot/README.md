# UX Pilot — research dossier

**Research status:** Official capability and agent documentation reviewed · **Direct REA validation:** Pending  
**Research date:** 2026-11-08

## Product role

UX Pilot focuses on product-design thinking before implementation: turning a PRD or brief into UX flows, wireframes and connected high-fidelity screens, then checking and refining those designs.

## Capabilities documented by UX Pilot

- Generate wireframes and high-fidelity UI from prompts, PRDs, documents, screenshots and website references.
- Explore multiple distinct design directions.
- Generate connected multi-screen journeys.
- Edit one section without changing the rest of the screen.
- Create clickable and React prototypes.
- Import Figma components and use a team's existing design system.
- Export designs to Figma and code on supported plans.
- Run UX reviews, accessibility/WCAG reviews, predictive heatmaps, gaze-flow and persona-oriented audits.
- Nodey agent inside Figma can generate native editable Figma layers, use Auto Layout/tokens and synchronize actual component instances through Simple Sync.

These are vendor-documented capabilities; availability and limits may vary by plan and integration.

## Architectural lessons for UDS

1. Separate **UX planning** from visual screen generation. First create a user-flow graph and screen inventory; get approval before rendering screens.
2. Support multiple design directions from one brief, preserving alternatives.
3. Make AI edits selection/section-scoped and preserve unrelated nodes.
4. Treat imported Figma components as references to real components, not copied screenshots.
5. Make UX audits explain issues and evidence; distinguish heuristic checks from predictive or simulated metrics.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| PRD parsing and UX flow | UX planning engine | P0 |
| Multi-screen generation | AI generation engine | P0 |
| Alternative directions | Variant/revision system | P0 |
| Selection-scoped edit | AI patch engine | P0 |
| Clickable prototype | Prototype engine | P0 |
| Accessibility/UX audit | Design validation engine | P1 |
| Figma component sync | Integration adapter | P1 |
| Heatmaps/gaze-flow | Optional research/heuristic module | P2 |

UX Pilot is proprietary. We will implement our own UX-flow schema and audit rules, use official integrations where possible, and avoid copying private code or proprietary assets. Predictive heatmaps/gaze flows should never be presented as measured user research unless backed by actual user data.

## Direct REA validation plan

Use a sample PRD to generate a flow and several screens; inspect how alternatives are represented; edit a single section; link screens into a prototype; run a UX/accessibility audit; import a Figma design system using Nodey if available; and export to Figma/React. Record plan-gated features and differences between web app and Figma plugin.

## Sources

- [UX Pilot AI instructions and capability overview](https://uxpilot.ai/ai-instructions)
- [UX Pilot Nodey](https://uxpilot.ai/nodey)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Official capability and Nodey documentation review | Links above | Documented research; direct REA validation pending |

## Open questions

- Is the internal screen model Figma-native, a separate design model or both?
- How are flow relationships and UX audit findings represented?
- Which audit findings are deterministic/accessibility-rule results versus model predictions?
- What component properties and variants survive the import/export cycle?
