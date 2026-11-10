# Phase 0 — research, architecture and validation status

**Last updated:** 2026-11-10
**Status:** Public-source research is consolidated. REA is installed in Antigravity, the MCP connection exposes 229 tools, and the Notes demo's export status DOM transition has been observed. Dedicated browser-profile setup and direct product workflows remain open.

## Accounting note

The original 16-item checklist counts repository setup, research structure, REA setup, MCP connection, browser profile, nine product investigations, feature matrix and final requirements. **15/16 top-level tasks are complete**: REA installation and Antigravity MCP setup are now complete, as are the nine desk-research dossiers, feature matrix and final requirements/documentation. Dedicated browser-profile setup is the one remaining checklist task. Direct REA validation across the products remains an additional evidence gate, not a completed task.

## Top-level task status

**Current accounting: 15/16 complete (93.75%); one dedicated browser-profile task remains. Direct product workflow validation is 0/9.**

| # | Task | Status | Evidence / next action |
|---:|---|---|---|
| 1 | Create GitHub repository | Complete | Repository exists. |
| 2 | Create research folder structure | Complete | Research/docs/apps/packages/server/tests structure exists. |
| 3 | Install and verify REA on HP Victus | Complete | REA is installed and available in Antigravity. |
| 4 | Connect REA to Antigravity via MCP | Complete | Antigravity reports 229 available REA tools. |
| 5 | Create dedicated research browser profile | Open — local | Create and verify a dedicated Chromium/Chrome profile with loopback-only CDP. |
| 6 | Research Claude Design | Desk research complete | Dedicated dossier updated; direct workflow observation pending. |
| 7 | Research OpenDesign | Desk/source research complete | Dedicated dossier updated; upstream source/architecture/license reviewed. |
| 8 | Research Figma | Desk research complete | Dedicated dossier updated; official API/variables/prototyping docs reviewed. |
| 9 | Research Google Stitch | Desk research complete | Dedicated dossier updated; official 2026 announcements and MCP/SDK docs reviewed. |
| 10 | Research Penpot | Desk/source research complete | Dedicated dossier updated; architecture and MPL-2.0 reviewed. |
| 11 | Research Doop | Desk/source research complete | Dedicated dossier updated; README, package manifest, MCP source and AGPL-3.0 reviewed. |
| 12 | Research Paper | Desk research complete | Dedicated dossier updated; HTML/CSS and MCP claims recorded for validation. |
| 13 | Research v0 | Desk research complete | Dedicated dossier updated; GitHub, preview and Design Systems docs reviewed. |
| 14 | Research UX Pilot | Desk research complete | Dedicated dossier updated; PRD/flow, Nodey and audit claims recorded for validation. |
| 15 | Consolidated feature matrix | Complete | Updated to align with product dossiers and distinguish unknown from absent. |
| 16 | Product and technical requirements | Documentation baseline complete | Product spec, architecture, stack, model, API and ADRs revised. Final evidence freeze waits for local REA observations. |

## Research deliverables completed in this pass

- Nine expanded product dossiers with product role, capabilities, architectural lessons, UDS mapping, license notes where relevant, official sources, evidence classification and direct REA test plan.
- Updated comparative feature matrix and priority tiers.
- Reconciled architecture decisions, including renderer/document boundary, local-first MVP, command service, design-system interchange, security and open-source reuse policy.
- Updated product/technical architecture and stack recommendations.
- Explicit direct-observation checklist and open questions per product.

## Evidence classes

- **Official documentation:** vendor docs, product announcements and API references.
- **Source evidence:** upstream repository files such as README, package manifest, source and LICENSE.
- **Direct observation:** not yet completed; requires REA connected to the user's local browser.
- **Inference:** architecture lessons derived from documented behavior/source. Marked as inference, not asserted as private backend fact.
- **Unknown:** details that public docs do not establish.

## Remaining local-only work

1. Create a dedicated research browser profile with CDP bound only to 127.0.0.1 and explicit allowed origins.
2. Run the reproducible workflows in each target dossier; capture screenshots and evidence IDs without recording credentials or private user data.
3. Update each dossier with observed results and limitations, then re-review requirements.

## Phase 0 exit gate

Phase 0 is **not fully closed** until the dedicated browser profile and direct product validation review are complete or explicitly waived by the project owner. REA install and MCP tool discovery are complete; the Notes demo DOM transition was confirmed. The initial fetch happened before REA attached, so that capture contains no network requests and does not establish request behavior.
