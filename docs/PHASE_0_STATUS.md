# Phase 0 — research, architecture and validation status

**Last updated:** 2026-11-08  
**Status:** Public-source research and documentation consolidation complete; local REA installation/observation remains blocked on the user's Windows environment.

## Accounting note

The original 16-item checklist counts repository setup, research structure, REA setup, MCP connection, browser profile, nine product investigations, feature matrix and final requirements. The user previously reported 11/16; the previous committed tracker reported 12/16. After this documentation pass, **13/16 top-level tasks are complete**: the nine desk-research dossiers and feature matrix are complete, and final requirements/documentation are now consolidated. The three remaining tasks are local REA installation, Antigravity MCP connection and dedicated browser-profile setup. Direct REA validation across the products remains an additional evidence gate, not a completed task.

## Top-level task status

**Current accounting: 13/16 complete (81.25%); 3/16 blocked on local Windows setup.**

| # | Task | Status | Evidence / next action |
|---:|---|---|---|
| 1 | Create GitHub repository | Complete | Repository exists. |
| 2 | Create research folder structure | Complete | Research/docs/apps/packages/server/tests structure exists. |
| 3 | Install and verify REA on HP Victus | Blocked — local | User must install from official source and verify package/security status. Do not bypass McAfee. |
| 4 | Connect REA to Antigravity via MCP | Blocked — local | Requires local MCP registration and tool visibility check. |
| 5 | Create dedicated research browser profile | Blocked — local | Requires local Chromium/Chrome profile and loopback-only CDP. |
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

1. Resolve the McAfee detection for the REA installer/package using the exact detection name, file hash and official release checksum/signature. Do not disable protection or add an exclusion.
2. Install a verified REA release if security review permits.
3. Connect REA to Antigravity and verify MCP tool discovery.
4. Launch a separate browser profile with CDP bound only to 127.0.0.1 and explicit allowed origins.
5. Run the reproducible workflows in each target dossier; capture screenshots and evidence IDs without recording credentials or private user data.
6. Update each dossier with observed results and limitations, then re-review requirements.

## Phase 0 exit gate

Phase 0 is **not fully closed** until the local REA checks above are completed or explicitly waived by the project owner. Public-source research and architecture decisions are now consolidated enough to prepare a Phase 1 renderer spike, but no app implementation has been started.
