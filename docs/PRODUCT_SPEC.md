# Product specification — Unified Design Studio

**Status:** Phase 0 product baseline; ready for Phase 1 spike, subject to direct REA findings.  
**Target user:** Single product builder/designer/developer working locally.

## 1. Product vision

A unified AI-native workspace that turns an idea, PRD, screenshot, reference website or codebase into a UX plan, multiple coherent editable screens, an interactive prototype and a usable frontend handoff.

UDS combines capabilities observed across nine reference products; it is not intended to reproduce their complete feature sets or proprietary internals.

## 2. Core workflow

1. Create a local project and choose a target platform/device.
2. Provide a brief, PRD, screenshots, assets, website reference or codebase context.
3. AI proposes a user-flow graph and screen inventory.
4. User approves or edits the plan.
5. AI generates multiple design directions and connected screens as structured nodes.
6. User directly edits layout, content, tokens, components and responsive rules.
7. User selects a region/component and asks AI for a scoped revision.
8. User previews breakpoints, runs UX/accessibility checks and connects screens.
9. User tests a clickable prototype.
10. User exports React/CSS, tokens and assets or hands off to a local codebase.

## 3. MVP scope

### Must-have
- Local project create/open/rename/duplicate.
- Multi-page documents, frames and stable node IDs.
- DOM/CSS-first canvas with text, image, shape, container and component nodes.
- Pan/zoom, select, move, resize, align, layers and property inspector.
- Flex and Grid layout semantics.
- Typed tokens, themes, components, variants and instances.
- Local save/autosave, undo/redo and revision restore.
- Brief/PRD to UX flow and three related editable screens.
- At least two design directions.
- Selection-scoped AI editing using validated revision-aware patches.
- Desktop/mobile responsive preview.
- Basic clickable prototype navigation and state.
- React/CSS/token export and restricted live preview.

### Later
- Figma/Penpot round-trip import/export.
- Advanced vector/boolean operations.
- Voice interaction and agent manager.
- MCP agent tools over the shared command service.
- GitHub branch/PR integration and deployment adapters.
- Real-time multiplayer, CRDT, cloud sync and team administration.

## 4. Functional acceptance criteria

- **Project:** create, save, close and reopen without data loss.
- **Document:** schema-versioned, stable IDs, migratable.
- **Editor:** layer tree and canvas remain synchronized; edits become document commands.
- **Design system:** tokens, semantic aliases, modes and component variants are reusable.
- **AI:** returns typed operations; invalid or stale patches are rejected; unaffected nodes remain unchanged.
- **Preview:** generated/imported code is isolated from the editor.
- **Prototype:** supported click/tap navigation works across screens.
- **Export:** React/CSS and tokens derive from the canonical document; unsupported constructs are reported.
- **History:** undo/redo and named revision restore work.

## 5. Non-functional requirements

- Keep typical product UI documents with several hundred nodes responsive; benchmark before setting hard performance claims.
- Autosave must not block canvas input.
- Renderer output should be deterministic for a document and renderer version.
- All persisted data is schema-versioned and migratable.
- Provider keys are never stored in browser state or design files.
- Accessibility: keyboard navigation, visible focus, reduced motion and semantic controls.
- No automatic arbitrary remote URL fetching.
- External imports and generated code run under least privilege.

## 6. Explicit non-goals

No full Figma parity, general-purpose illustration suite, video/slide editor, unauthorized scraping, proprietary backend reverse engineering, public template marketplace or hosted team product in MVP.
