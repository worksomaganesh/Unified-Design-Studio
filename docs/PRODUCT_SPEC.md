# Product requirements draft — Unified Design Studio

**Status:** Draft based on public-source desk research. Do not freeze until direct REA observations are completed.  
**Date:** 2026-11-08

## 1. Product vision

A single, AI-native workspace for product UI creation. A user can start from a short idea, structured PRD, screenshot, design reference or existing codebase; generate several related screens; edit them visually and through conversation; define reusable design tokens/components; connect screens into an interactive prototype; and export a usable frontend implementation.

## 2. Primary user and job to be done

**Initial user:** One product builder/designer/developer working on their own projects on a Windows laptop.

**Job:** “Help me turn a product idea into a consistent, editable, responsive UI and working prototype, then hand it to my codebase without rebuilding the design by hand.”

The first version is a personal/local-first tool. Multi-user accounts, billing, organization administration and public marketplace features are not MVP requirements.

## 3. Core user journey

1. Create a project and choose a target platform/device profile.
2. Provide an idea, PRD, screenshot, URL reference or codebase context.
3. AI proposes user flows and screen inventory; user approves/edits it.
4. AI generates multiple design directions or a selected direction.
5. Generated screens become structured, editable design nodes.
6. User edits content, layout, tokens, components and responsive behavior directly.
7. User asks AI to modify a selected region/component while preserving unrelated nodes.
8. User previews different breakpoints and connects screens into a prototype.
9. User runs visual/UX/accessibility checks and reviews the findings.
10. User exports React + CSS, design tokens and assets, or opens the output in a local project.

## 4. Functional requirements

### Project and workspace

- FR-001: Create, rename, duplicate, archive and reopen projects.
- FR-002: Store project metadata and design documents locally in the MVP.
- FR-003: Support pages, named frames/artboards and a multi-screen project.
- FR-004: Provide autosave with an explicit saved/unsaved/error indicator.
- FR-005: Keep an undo/redo history for user and AI edits.
- FR-006: Maintain version snapshots and allow restoring a prior revision.

### Design canvas/editor

- FR-010: Support pan, zoom, fit-to-screen and viewport navigation.
- FR-011: Support frames, groups, text, images, rectangles, ellipses, lines and component instances.
- FR-012: Support selecting one/multiple nodes, moving, resizing, duplicating, deleting and reordering.
- FR-013: Provide a layer tree synchronized with the canvas.
- FR-014: Provide a properties inspector for geometry, text, fill, stroke, opacity, radius and layout.
- FR-015: Support alignment, distribution, snapping and guides.
- FR-016: Support CSS-like fixed, flex and grid layout rules for web UI.
- FR-017: Support inline text editing.
- FR-018: Preserve stable node IDs across edits and exports.

### Design systems

- FR-020: Define design tokens for color, typography, spacing, sizing, radius, border and elevation.
- FR-021: Support semantic token aliases and theme/mode switching.
- FR-022: Define reusable components with named properties and variants.
- FR-023: Instantiate shared components on multiple screens.
- FR-024: Detect token/component usage and warn about detached or inconsistent values.
- FR-025: Import/export a portable design-system package with a human-readable DESIGN.md and machine-readable token data.

### AI design and editing

- FR-030: Generate screen plans and connected screen sets from a brief/PRD.
- FR-031: Generate at least two visual directions for comparison.
- FR-032: Accept screenshot/image references as context.
- FR-033: Return structured design-document patches, not only arbitrary HTML or raster images.
- FR-034: Allow selection-scoped edits and preserve unaffected node IDs/content/styles.
- FR-035: Support conversational iteration with visible version history.
- FR-036: Validate all AI-produced document patches against the schema before applying them.
- FR-037: Expose AI provider choice through an adapter; no one model vendor may be hardwired into the editor.
- FR-038: Display model/provider, request status, errors and usage/cost information when available.

### Responsive design and prototyping

- FR-040: Provide desktop, tablet and mobile viewport presets.
- FR-041: Support responsive frames and breakpoint-aware layout properties.
- FR-042: Allow screen-to-screen navigation connections.
- FR-043: Support basic click/tap actions, overlays and component states.
- FR-044: Provide an interactive prototype preview.

### Code generation and export

- FR-050: Export the canonical design document as versioned JSON.
- FR-051: Export tokens as CSS custom properties and JSON.
- FR-052: Export a React component tree and CSS styles from the same design document.
- FR-053: Export preview images and SVG assets where applicable.
- FR-054: Run exported code in a restricted preview/sandbox before handoff.
- FR-055: Report unsupported nodes/layouts instead of silently dropping them.

### Integrations and agent access

- FR-060: Provide an internal command API for project, document, node, generation, preview and export operations.
- FR-061: Expose selected read/write operations through an MCP adapter after the core API stabilizes.
- FR-062: Keep REA out of production runtime; it is only a research/development tool.
- FR-063: Defer Figma/Penpot import adapters until our document model and basic export are stable.

## 5. Non-functional requirements

- NFR-001: The editor must remain usable with at least a few hundred typical UI nodes; establish a benchmark and improve beyond it based on profiling.
- NFR-002: Direct manipulation should feel immediate; long operations must be asynchronous and show status.
- NFR-003: Autosave must not block canvas input.
- NFR-004: All persisted documents must be schema-versioned and migratable.
- NFR-005: Generated previews and imported content must run in an isolated, permission-limited context.
- NFR-006: No external URL or remote image should be fetched automatically without a clear import action and origin policy.
- NFR-007: Support keyboard navigation, visible focus and reduced-motion preferences.
- NFR-008: Keep application state, design document state and preview runtime state separate.
- NFR-009: Avoid storing provider secrets in the browser document or Git repository.
- NFR-010: Provide deterministic exports for the same design document and exporter version.

## 6. MVP acceptance criteria

An end-to-end MVP is accepted when a user can:

1. Create and save a project.
2. Provide one brief and generate three related screens into an editable design document.
3. Open the screens in the canvas and edit text, color, spacing, size and layout directly.
4. Ask AI to change one selected section without regenerating unrelated sections.
5. Preview at desktop and mobile widths.
6. Link screens into a clickable prototype.
7. Export React/CSS and tokens, open a live preview, and preserve the saved project after app restart.
8. Undo/redo and restore a previous snapshot.

## 7. Out of scope for MVP

- Real-time multi-user editing.
- Full parity with Figma's advanced vector and boolean-operation suite.
- Full general-purpose graphic design, slide/video editor, or animation timeline.
- Native desktop packaging on day one.
- Organization-level roles, billing and public template marketplace.
- One-click perfect imports from every target product.
- Automatically scraping authenticated sites or extracting private backend details.

## 8. Risks and dependencies

- Browser observation and product accounts are needed to validate actual behavior.
- Some target workflows may be gated by plan, device or invitation status.
- AI generation cost and API entitlement must be confirmed separately from consumer subscriptions.
- Canvas selection/drag/resize and layout semantics are significant engineering work; do not underestimate them.
- HTML-to-design import can be lossy; an explicit supported subset and warning system are required.
- Reusing open-source code requires per-project license and dependency review.
