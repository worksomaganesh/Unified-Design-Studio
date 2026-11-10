# Guided product tour guide

The registry currently defines **8 category tours**, **38 tour steps**, and **4 contextual tips**. Tours are short by product category; there is no one tour that attempts to cover every capability. Every step is linked to a verified feature and stable target ID.

## Find and launch a tour

Choose **Discover** from the workspace/editor top bar, search or filter a category, and use the tour action on a feature card. The Explorer also offers replay onboarding, contextual-tip replay where available, a show/hide tips preference, and Reset progress. From any tour use Previous, Next, Skip tour, Escape, or the left/right arrow keys. A completed tour offers the Feature Explorer.

## Category tours

### Get oriented (5 steps)

**Category:** Workspace & projects. **Starting surface:** workspace. Find your projects, create a workspace, and learn the main navigation.

1. **Create a project** — Choose New project or Create project, enter a name, and create it. Ctrl/Cmd+N also opens the form. Target: `uds-workspace-create-project`.
2. **Open a recent project** — Select a project card or a project in the Recent sidebar. Use Refresh to reload the list. Target: `uds-workspace-recent-projects`.
3. **Rename a project** — Open a project, choose Rename, and enter the new name in the prompt. Target: `uds-workspace-rename`.
4. **Workspace preferences** — Choose System, Light, or Dark appearance; select the preferred provider; then save. Provider secrets are configured separately in AI Studio. Target: `uds-workspace-settings`.
5. **Command palette** — Open Commands and choose a listed action. Ctrl/Cmd+N starts project creation; Escape closes the palette. Target: `uds-workspace-commands`.

### Build a canvas (6 steps)

**Category:** Canvas & editing. **Starting surface:** editor. Create pages and layers, arrange them, then save a desktop design.

1. **Manage design pages** — Use + to add a page, select a page to edit it, double-click or use its menu to rename, and choose Delete current page when more than one page exists. Target: `uds-editor-page-list`.
2. **Select and multi-select layers** — Click a canvas item or layer. Hold Ctrl/Cmd while clicking to add or remove an item; Escape clears selection. Target: `uds-editor-select`.
3. **Add a frame** — Choose Frame, then select and position it on the current page. Target: `uds-editor-frame`.
4. **Add text** — Choose Text, then edit the content and typography in the Design inspector. Target: `uds-editor-text`.
5. **Add a shape** — Choose Shape, then adjust position, dimensions, and fill in the Design inspector. Target: `uds-editor-shape`.
6. **Save a document revision** — Choose Save or press Ctrl/Cmd+S. The editor shows saved or unsaved status. Target: `uds-editor-save`.

### Bring in assets (4 steps)

**Category:** Assets & imports. **Starting surface:** project. Learn which project files are editable, which stay as references, and where to import them.

1. **Import raster images** — Open a project, choose Import asset, select a supported image, then place it using the editor's Image tool. Target: `uds-workspace-assets`.
2. **Keep reference-only uploads** — Choose Import asset and upload an SVG or PDF. Download it from the asset list; these formats are not canvas image layers. Target: `uds-workspace-assets`.
3. **Import Penpot v3 files** — Upload a Penpot v3 .penpot archive and review the conversion report and resulting pages. Target: `uds-workspace-assets`.
4. **Keep Figma .fig references** — Upload a .fig file and download it later from the project asset list. Use the separate Figma REST file import for supported editable conversion. Target: `uds-workspace-assets`.

### Create a design system (5 steps)

**Category:** Design systems & components. **Starting surface:** editor. Add reusable tokens, work with modes, create components, and export supported formats.

1. **Create typed design tokens** — Open Design system, enter a token name, choose its type and value, then add it. Target: `uds-design-token-name`.
2. **Create themes and modes** — Use + Theme or + Mode, then choose the active theme and mode before editing token values. Target: `uds-design-modes`.
3. **Link token aliases** — Choose a same-type token in Alias of while creating or editing a token. Target: `uds-design-alias`.
4. **Create components and variants** — Select a supported layer and choose Create component. Edit its definition, properties, and variants in Design system; add component instances from the component list. Target: `uds-editor-component`.
5. **Exchange DTCG, Penpot, and Tokens Studio tokens** — Choose Export DTCG or Import JSON, then review the transfer report for conversion notes. Target: `uds-design-interchange`.

### Explore AI workflows (5 steps)

**Category:** AI creation & review. **Starting surface:** editor. See how a provider-backed brief becomes a reviewed design proposal.

1. **Connect an AI provider** — Choose a supported provider and enter its API key when prompted. Verify the connected status before using provider-backed actions. Target: `uds-ai-provider`.
2. **Draft a user flow and screen inventory** — Connect an AI provider, describe the users/problem/outcome, choose screen and direction counts, then draft and review the plan. Target: `uds-ai-brief`.
3. **Generate editable design directions** — After reviewing the flow and screen inventory, choose Generate directions, review the proposal and quality notes, then apply a direction. Target: `uds-ai-generate`.
4. **Review AI revision proposals** — Select layers, enter the requested change, draft a proposal, choose operations, and apply the accepted changes. Save to persist them. Target: `uds-ai-revise-tab`.
5. **Run a local design quality review** — Open Quality review and inspect the checks; refresh the review after changing the document. Target: `uds-ai-quality-tab`.

### Make a clickable prototype (5 steps)

**Category:** Prototyping & UX. **Starting surface:** editor. Add state, connect a layer to an interaction, and run the isolated preview.

1. **Define prototype variables** — Enter a name, choose the type and initial value, and choose Add variable. Target: `uds-prototype-variables`.
2. **Bind variables to text** — Select a text layer in the canvas, choose a variable, and choose Bind. Target: `uds-prototype-bindings`.
3. **Configure prototype interactions** — Select a source layer, choose the trigger/action and its target or value, then add the interaction. Target: `uds-prototype-interaction`.
4. **Preview a clickable prototype** — Add pages and interactions, then choose Open clickable preview. Target: `uds-prototype-preview`.
5. **Check prototype UX and accessibility** — Open the panel and review each check; fix issues in the canvas or interaction settings. Target: `uds-prototype-preflight`.

### Review and compare work (4 steps)

**Category:** Review & history. **Starting surface:** editor. Leave local feedback, compare saved revisions, and restore without erasing history.

1. **Comment on a page or layer** — Save the document, optionally select a layer, enter feedback in New comment, and choose Add comment. Target: `uds-review-comment`.
2. **Reply to and manage comment threads** — Reply to an open thread, resolve it when addressed, and change the filter to view resolved or all threads. Target: `uds-review-filter`.
3. **Compare saved revisions** — Save at least two revisions, choose From and To revisions, and select Compare. Target: `uds-review-compare`.
4. **Restore a prior revision** — Compare revisions, choose a previous revision in the comparison, and select Restore as a new revision. Target: `uds-review-compare`.

### Prepare a developer handoff (4 steps)

**Category:** Code handoff. **Starting surface:** editor. Review export notes, inspect the restricted preview, and download a code bundle.

1. **Review export diagnostics** — Open Code handoff and read the Export notes before downloading the bundle. Target: `uds-handoff-diagnostics`.
2. **Preview restricted static output** — Choose Open restricted preview. The preview is intentionally static and isolated. Target: `uds-handoff-preview`.
3. **Prepare a Git-ready export** — Select Prepare for local Git before downloading the bundle. Target: `uds-handoff-git-ready`.
4. **Download a code bundle** — Review included files and export notes, then choose Download code bundle. Target: `uds-handoff-download`.

## Contextual tips

- **Start with the outcome** (Draft a user flow and screen inventory) — Describe the users, the problem, and what they should be able to achieve. A provider connection is required before the brief can be sent. Replay target: `uds-ai-brief`.
- **Name tokens for their role** (Create typed design tokens) — Use a name such as color.brand.primary, then choose a type and value. Tokens can be linked to text and shape colors. Replay target: `uds-design-token-name`.
- **Choose the source layer first** (Configure prototype interactions) — Select a layer on the canvas, then set its trigger and action here. The preview runs in an isolated frame and does not change the document. Replay target: `uds-prototype-interaction`.
- **Anchor feedback to a saved state** (Comment on a page or layer) — Save the document before commenting. Select a layer first to attach the thread to it; otherwise the comment is attached to the page. Replay target: `uds-review-comment`.

## Unavailable-step behavior

The tour opens a prerequisite panel/surface if the action is registered, waits for the actual target to render, scrolls it into view, and verifies it. If a project, selection, saved revision, or target is absent, the card tells the user why and offers Retry, Previous, and Skip tour. It does not silently jump to another feature. Some category tours therefore stop when the current project has no required state; users can close the tour and continue independently.

## Keyboard and assistive technology

- Tab / Shift+Tab stays within a tour or discovery dialog.
- Escape closes the current overlay; a tour is recorded as skipped.
- ArrowRight advances and ArrowLeft returns while focus is not inside a text field.
- The tour card announces step count, feature name, purpose, use instructions, and missing-target error.
- Honor operating-system reduced-motion preferences; spotlight tracking follows scroll and resize.

## Testing record

Source-level feature/tour relationships, unique targets, persistence, search, and action ownership are checked in `tests/unit/product-discovery.test.ts`. The complete existing unit suite, workspace typecheck, and Studio production build were run for this implementation. The new welcome, Explorer, tour, contextual tip, and announcement flows were not interacted with in a browser during this implementation because computer control was disabled; add browser-level route, scroll, keyboard, and persistence checks before release. The tour engine does not invoke an AI provider, submit Figma credentials, upload assets, or save document changes as part of its steps.
