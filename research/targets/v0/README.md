# v0 — research dossier

**Research status:** Official documentation and product workflow review consolidated · **Direct REA validation:** Pending  
**Research date:** 2026-11-08

## Product role

v0 is an AI coding/application agent rather than a traditional design editor. It generates real code and full-stack applications from prompts, wireframes and mockups, then supports editing, previews, Git workflows and production deployment.

## Capabilities documented by Vercel

- Prompt-to-UI and prompt-to-application generation.
- High-fidelity UI generation from wireframes or mockups.
- Backend-connected, data-driven application generation.
- Full editor, AI agent, project and preview workflow.
- GitHub repository import, isolated working branches, automatic commits and pull requests.
- Preview execution using Vercel Sandbox, including server-side features.
- One-click deployment to Vercel.
- Design Systems 2.0: import repositories, Figma frames/nodes, documentation and assets; create a system skill describing components, props, tokens and starter setup.

The current documentation states the typical stack is Next.js, React, TypeScript, Tailwind CSS and shadcn/ui. That is a product default, not a requirement for UDS.

## Architectural lessons for UDS

1. Do not treat design export as the end of the workflow; code preview, repository integration and review are part of the product.
2. Use isolated preview execution for generated code that may include server-side behavior.
3. Connect generation to real existing repositories and their design-system conventions.
4. Keep Git changes on an isolated branch and use PRs/review rather than writing directly to a user's main branch.
5. Design-system ingestion should produce a verified adapter/skill that explains components, props, tokens and setup.

## UDS implementation mapping

| Capability | UDS destination | Priority |
|---|---|---|
| Prompt-to-React project | Code-generation engine | P0 |
| Existing repo context | Codebase connector | P1 |
| Design-system skill/import | Token/component importer | P0/P1 |
| Isolated preview runtime | Preview service | P0 |
| Git branch/PR handoff | GitHub integration | P1 |
| Vercel deployment | Deployment adapter | P2 |

v0 is proprietary. Use official APIs/integrations where available; do not assume access to its internal generation pipeline. We should keep the UDS renderer/document model independent of Next.js and Tailwind, then provide exporter targets.

## Direct REA validation plan

Create a test project from a prompt and a supplied mockup; inspect generated files; edit a component; import/connect a GitHub repository; observe branch/commit/PR behavior; test preview with a route or server action if available; import a design system and inspect the resulting skill; compare the preview with the source design.

## Sources

- [What is v0?](https://v0.app/docs)
- [v0 FAQs and editor/preview changes](https://v0.app/docs/faqs)
- [GitHub integration](https://v0.app/docs/github)
- [Design Systems 2.0](https://v0.app/docs/design-systems-2)
- [v0 changelog](https://v0.app/changelog)

## Evidence log

| Date | Workflow | Evidence | Status |
|---|---|---|---|
| 2026-11-08 | Official v0 product, GitHub, preview and design-system docs review | Links above | Documented research; direct REA validation pending |

## Open questions

- How do design-mode visual edits map back to source code?
- Which parts of project generation are available through API versus the hosted editor?
- What are preview runtime limits, quotas and supported frameworks?
- How is a Design Systems 2.0 skill validated against actual generated code?
