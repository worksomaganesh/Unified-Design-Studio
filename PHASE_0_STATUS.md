# Phase 0 — status and task accounting

**Last updated:** 2026-11-08  
**Status:** In progress — desk research baseline prepared; local REA validation not yet performed.

## Task accounting (16 top-level tasks)

| # | Task | Status | Notes |
|---:|---|---|---|
| 1 | Create the GitHub repository | Pending | GitHub connector in this session does not expose repository creation. A local starter folder and ZIP are prepared; remote repository still needs to be created. |
| 2 | Create the research folder structure | **Completed** | Created in this starter pack. |
| 3 | Set up REA on the HP Victus | Pending | Requires installation and terminal execution on the user's Windows machine. No laptop shell is available in this session. |
| 4 | Connect REA to the AI coding environment through MCP | Pending | REA has an Antigravity client identifier in its installation docs; actual local registration and restart remain to be done. |
| 5 | Establish a dedicated browser profile for research | Pending | Requires launching Chrome/Edge on the Victus with loopback CDP. Instructions are prepared. |
| 6 | Investigate Claude Design | **Completed — desk research** | Official current docs reviewed; hands-on REA validation remains. |
| 7 | Investigate OpenDesign | **Completed — desk research** | Official site, GitHub README, architecture, package metadata and Apache-2.0 license reviewed; hands-on validation remains. |
| 8 | Investigate Figma | **Completed — desk research** | Official help pages reviewed for auto layout, variants, variables, prototyping and component libraries; hands-on validation remains. |
| 9 | Investigate Google Stitch | **Completed — desk research** | Official Google Labs updates reviewed for infinite canvas, agent, multimodal context, DESIGN.md, MCP/SDK and exports; hands-on validation remains. |
| 10 | Investigate Penpot | **Completed — desk research** | Official features, integrations and technical architecture reviewed; hands-on validation remains. |
| 11 | Investigate Doop | **Completed — desk research** | Official MCP docs and tool reference reviewed; hands-on validation remains. |
| 12 | Investigate Paper | **Completed — desk research** | Official product and MCP pages reviewed for HTML/CSS canvas, agent access and design-code sync; hands-on validation remains. |
| 13 | Investigate v0 | **Completed — desk research** | Official docs reviewed for prompts, design mode, Figma/Paper inputs, integrations, code and deployments; hands-on validation remains. |
| 14 | Investigate UX Pilot | **Completed — desk research** | Official UX Pilot 2.0 feature description reviewed; hands-on validation remains. |
| 15 | Create consolidated feature matrix | **Completed** | See `research/feature-matrix.md`. |
| 16 | Document final technical and product requirements | In progress | Drafts created from desk research. They must be validated and frozen after REA browser investigations. |

### Count

- **11 / 16 tasks completed** (68.75%).
- **5 / 16 tasks remain open or in progress.**
- The nine product profiles are complete as *public-source desk research*. They are not yet complete as REA-backed reverse-engineering investigations.
- **0 / 9 direct REA browser validations completed.**

The 11 completed count does not imply REA has been installed or used. It counts the nine preliminary product investigations, the research structure, and the feature matrix. The requirements task remains in progress until the REA evidence pass is complete.

## Work completed in this phase

1. Created a project-ready research and documentation folder structure.
2. Established nine individual product profiles from official product pages, help centers, and open repositories where available.
3. Compared product capabilities across AI generation, canvas editing, design systems, prototyping, code output, collaboration, and integrations.
4. Identified the major architecture pattern: a canonical, versioned design document must be shared by the editor, AI generation, prototype renderer, and code exporter.
5. Prepared Windows/Antigravity REA setup guidance with an explicit-origin and loopback-only browser-observation model.
6. Drafted product requirements, architecture, provisional decisions, and MVP acceptance criteria.

## Remaining work

- Create remote GitHub repository `unified-design-studio` and push this starter pack.
- Install and verify REA locally on the HP Victus.
- Register and verify REA as an MCP server in Antigravity.
- Launch a separate Chromium research profile with CDP on loopback and explicit origin allowlisting.
- Perform the REA-backed investigations; then revise and approve the final technical/product requirements.

## Phase 0 exit criteria

Phase 0 is complete only when:

- The project repo exists remotely and contains the research structure.
- REA reports healthy startup and its MCP tools are visible in Antigravity.
- The dedicated browser profile can be discovered by REA through `list_browser_targets`.
- Every target has at least one reproducible workflow observation, screenshots, and a capture/evidence record; where a product is unavailable without a subscription, that limitation is recorded rather than guessed.
- Public-source claims, observed behavior, inferred implementation details, and unknowns are clearly separated.
- The feature matrix and product/technical requirements are updated against the direct evidence and formally frozen for Phase 1.
