# Verified product feature inventory

> Generated from `apps/studio/src/discovery/feature-registry.json`. Update the structured registry and run `node scripts/generate-product-docs.mjs` after an application capability changes. This inventory covers the verified user-facing product and its separately hosted MCP adapter; it does not count this discovery UI as an original product feature.

## Audit totals

- **Verified user-facing capabilities:** 58
- **Categories:** 9
- **Fully implemented:** 48
- **Partially implemented:** 5
- **Experimental or live integrations not verified:** 5
- **Unavailable features:** 0
- **Visible UI placeholders (excluded from verified feature total):** 2

Status describes the shipped code path, not an assertion that an external account, credential, model, or third-party file was available during this audit. Provider-backed generation and Figma live calls have not been exercised with user credentials. A capability can be implemented locally while requiring an external prerequisite.

## Complete navigation and discovery map

The Studio is a **single-page application with two primary surfaces**, not a URL-routed multi-page app. The workspace changes into the project view and then into the editor; editor tools appear in panels/dialogs over the editor.

| Surface | Navigation and controls | Feature areas reached |
|---|---|---|
| Workspace home | Brand link, All projects, Recent projects, New project, Create project | Project creation, open/refresh recent projects, settings, command palette |
| Project workspace | Projects breadcrumb, Rename, Archive, Open editor, Import asset, asset download/remove | Project metadata, editable raster images, reference files, Penpot conversion |
| Editor header | Projects, Review, AI Studio, Design system, Prototype, Code handoff, History, Undo, Redo, Save | Review threads, AI flows, tokens/components, prototype, export, saved revisions |
| Editor toolbar | Select, Pan, Frame, Text, Shape, Image, Container, Create component, Align left, Center, Group, Desktop size, Zoom | Canvas editing and desktop preview presets |
| Editor left panel | Pages, add/rename/delete page, Layers, add layer, visibility | Multi-page structure and layer navigation |
| Editor center | Artboard; select, drag, resize; Ctrl+mousewheel zoom; middle-button pan | Visual canvas interactions |
| Editor right panel | Design inspector | Geometry, text/fill, container layout, and component-instance properties |
| AI Studio panel | Provider, Plan & generate, Revise selection, Quality review | Provider setup, flow/screen plans, proposals, local checks |
| Design system panel | Theme, Mode, Add token, Tokens, Components, Interchange, Figma file and Variables | Tokens, aliases, modes, components, portable JSON, Figma REST |
| Prototype & UX panel | Preview, Variables, Text bindings, Add interaction, UX & accessibility review | Prototype variables, events, navigation, overlays, preflight |
| Review & history panel | Comments, thread filter/actions, Revision compare | Comments/replies, compare, restore |
| Code handoff panel | Export notes, restricted preview, Prepare for local Git, Download bundle | Static preview and frontend ZIP export |
| External MCP client | Local MCP server: `list_projects`, `get_project_summary`, `get_node_summaries`; optional revision-checked text/rename commands | Bounded agent access; not an in-app navigation item |

### Verified keyboard and pointer interactions

- On the workspace: `Ctrl/Cmd+K` opens the command palette; `Ctrl/Cmd+N` opens new-project creation; `Escape` closes workspace modals/palette.
- In the editor: `Ctrl/Cmd+S` saves; `Ctrl/Cmd+Z` undo; `Ctrl/Cmd+Shift+Z` redo; `Delete` deletes the selection; `Escape` clears it.
- `Ctrl/Cmd+click` toggles multi-selection; double-click a page name to rename; drag a selected canvas layer to move it; drag its handle to resize.
- Select Pan and drag, or use the middle mouse button; `Ctrl+wheel` over the canvas adjusts zoom.
- The command palette displays an input but it **does not filter actions**; Enter only closes it. This is recorded as partially implemented.
- The local service accepts a recent-project limit setting, but the current Settings dialog does not expose a control for it; the workspace uses the default of 12.

## Feature details by category

### Workspace & projects — 6 features

Create and manage local design projects and workspace preferences.

#### Create a project

- **Purpose:** Give each product idea a separate workspace and revision history.
- **Location:** Workspace top bar, sidebar, and empty state
- **How to use:** Choose New project or Create project, enter a name, and create it. Ctrl/Cmd+N also opens the form.
- **Implementation status:** Fully implemented. Creates a local project with an initial design document.
- **Dependencies:** None
- **Discovery:** “Get oriented” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Open a recent project

- **Purpose:** Return to active work without searching the filesystem.
- **Location:** Recent projects grid and workspace sidebar
- **How to use:** Select a project card or a project in the Recent sidebar. Use Refresh to reload the list.
- **Implementation status:** Fully implemented. Lists and opens saved local projects. The workspace displays up to 12 by default; the local service supports a recent-project limit setting, but the UI has no control for it.
- **Dependencies:** None
- **Discovery:** “Get oriented” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Rename a project

- **Purpose:** Keep the workspace organized as a concept evolves.
- **Location:** Project actions
- **How to use:** Open a project, choose Rename, and enter the new name in the prompt.
- **Implementation status:** Fully implemented. Changes a project's display name while preserving its ID and contents.
- **Dependencies:** Open a recent project
- **Discovery:** “Get oriented” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Archive a project

- **Purpose:** Keep the recent workspace focused while retaining server-side archive semantics.
- **Location:** Project actions
- **How to use:** Open a project and choose Archive. Confirm the prompt.
- **Implementation status:** Fully implemented. Removes a project from the active workspace list after confirmation.
- **Dependencies:** Open a recent project
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Workspace preferences

- **Purpose:** Make the workspace comfortable and remember provider preference.
- **Location:** Workspace top bar → Settings
- **How to use:** Choose System, Light, or Dark appearance; select the preferred provider; then save. Provider secrets are configured separately in AI Studio.
- **Implementation status:** Fully implemented. Stores the appearance preference and preferred AI provider in the local service.
- **Dependencies:** None
- **Discovery:** “Get oriented” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Command palette

- **Purpose:** Make common workspace actions available from the keyboard.
- **Location:** Workspace top bar → Commands; Ctrl/Cmd+K
- **How to use:** Open Commands and choose a listed action. Ctrl/Cmd+N starts project creation; Escape closes the palette.
- **Implementation status:** Partially implemented. Opens shortcuts for creating projects, navigating to projects, and opening settings. The search field currently does not filter the list.
- **Dependencies:** None
- **Discovery:** “Get oriented” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx)

### Canvas & editing — 17 features

Build desktop layouts on a multi-page canvas and edit their layers.

#### Manage design pages

- **Purpose:** Keep related screens in one design document.
- **Location:** Editor left panel → Pages
- **How to use:** Use + to add a page, select a page to edit it, double-click or use its menu to rename, and choose Delete current page when more than one page exists.
- **Implementation status:** Fully implemented. Adds, selects, renames, and deletes document pages; the final page cannot be deleted.
- **Dependencies:** Create a project
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Select and multi-select layers

- **Purpose:** Choose which objects to edit or arrange.
- **Location:** Canvas and Layers list
- **How to use:** Click a canvas item or layer. Hold Ctrl/Cmd while clicking to add or remove an item; Escape clears selection.
- **Implementation status:** Fully implemented. Selects a canvas layer; Ctrl/Cmd-click toggles additional layers in the selection.
- **Dependencies:** Add a frame, Add text, Add a shape
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Pan and zoom the canvas

- **Purpose:** Navigate large desktop artboards while keeping layer positions stable.
- **Location:** Editor toolbar and canvas
- **How to use:** Choose Pan and drag the canvas, use +/− for zoom, or Ctrl/Cmd+wheel over the canvas.
- **Implementation status:** Fully implemented. Moves the canvas viewport and changes its zoom level without changing document geometry.
- **Dependencies:** None
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Add a frame

- **Purpose:** Group screen content inside a bounded region.
- **Location:** Editor toolbar → Frame
- **How to use:** Choose Frame, then select and position it on the current page.
- **Implementation status:** Fully implemented. Adds a frame layer that can contain nested design layers.
- **Dependencies:** Manage design pages
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Add text

- **Purpose:** Represent headings, labels, and other copy in the design.
- **Location:** Editor toolbar → Text
- **How to use:** Choose Text, then edit the content and typography in the Design inspector.
- **Implementation status:** Fully implemented. Adds an editable text layer to the current page.
- **Dependencies:** Manage design pages
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Add a shape

- **Purpose:** Build visual primitives and backgrounds.
- **Location:** Editor toolbar → Shape
- **How to use:** Choose Shape, then adjust position, dimensions, and fill in the Design inspector.
- **Implementation status:** Fully implemented. Adds a shape layer with editable geometry and fill.
- **Dependencies:** Manage design pages
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Place a raster image

- **Purpose:** Use project imagery in a design screen.
- **Location:** Editor toolbar → Image
- **How to use:** Import a supported raster image in the project workspace first, then choose Image in the editor. The first available image asset is placed.
- **Implementation status:** Partially implemented. Places a previously uploaded PNG, JPEG, WebP, or GIF asset on the canvas.
- **Dependencies:** Import raster images
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx)

#### Move and resize layers

- **Purpose:** Arrange a screen visually while editing document geometry.
- **Location:** Canvas
- **How to use:** Drag a layer to move it. Select a resizable layer and drag its resize handle to change its dimensions.
- **Implementation status:** Fully implemented. Moves and resizes supported selected layers directly on the canvas.
- **Dependencies:** Select and multi-select layers
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Edit layer properties

- **Purpose:** Set precise values and content for the selected layer.
- **Location:** Editor right panel → Design
- **How to use:** Select a layer and update the fields shown in the Design inspector.
- **Implementation status:** Fully implemented. Edits layer name, geometry, text, fill, container layout, and component-instance properties.
- **Dependencies:** Select and multi-select layers
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Toggle layer visibility

- **Purpose:** Temporarily hide visual content while editing.
- **Location:** Editor left panel → Layers
- **How to use:** Select the visibility symbol on a layer row.
- **Implementation status:** Fully implemented. Shows or dims a layer using the visibility control in the Layers list.
- **Dependencies:** Manage design pages
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Group selected layers

- **Purpose:** Keep related canvas objects together.
- **Location:** Editor toolbar → Group
- **How to use:** Select two or more sibling layers and choose Group.
- **Implementation status:** Fully implemented. Places selected sibling layers inside a container group.
- **Dependencies:** Select and multi-select layers
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Align layers

- **Purpose:** Place a layer consistently on the desktop canvas.
- **Location:** Editor toolbar → Align left / Center
- **How to use:** Select a layer and choose Align left or Center.
- **Implementation status:** Fully implemented. Moves the selected layer to the left edge or horizontal center of the current artboard.
- **Dependencies:** Select and multi-select layers
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Undo and redo edits

- **Purpose:** Recover from recent editing actions.
- **Location:** Editor top bar
- **How to use:** Use the undo and redo buttons, Ctrl/Cmd+Z, and Ctrl/Cmd+Shift+Z. Save to create a persistent revision.
- **Implementation status:** Fully implemented. Restores recent in-memory document states while the editor session is open.
- **Dependencies:** None
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Save a document revision

- **Purpose:** Persist the design and make it available to review and history.
- **Location:** Editor top bar → Save; Ctrl/Cmd+S
- **How to use:** Choose Save or press Ctrl/Cmd+S. The editor shows saved or unsaved status.
- **Implementation status:** Fully implemented. Validates and saves the current document as a local project revision.
- **Dependencies:** Create a project
- **Discovery:** “Build a canvas” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Choose desktop artboard size

- **Purpose:** Design for the product's supported desktop screen sizes.
- **Location:** Editor toolbar → Desktop size
- **How to use:** Choose Laptop, Desktop, or Wide desktop from the size menu.
- **Implementation status:** Fully implemented. Switches between laptop 1280, desktop 1440, and wide desktop 1920 artboard presets.
- **Dependencies:** None
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Lay out container children

- **Purpose:** Create structured screen layouts.
- **Location:** Select a container → Design inspector → Layout
- **How to use:** Select a container, choose Block, Flex, or Grid, and edit the available direction, alignment, columns, and gap fields.
- **Implementation status:** Fully implemented. Arranges container children with block, flex, or grid layout and supported gap/alignment settings.
- **Dependencies:** Add a layout container
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Add a layout container

- **Purpose:** Group and lay out related screen content.
- **Location:** Editor toolbar → Container
- **How to use:** Choose Container, then set its layout in the Design inspector and place child layers within it.
- **Implementation status:** Fully implemented. Adds a parent layer whose children can use block, flex, or grid layout.
- **Dependencies:** Manage design pages
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

### Assets & imports — 4 features

Bring supported images and design files into a project.

#### Import raster images

- **Purpose:** Reuse local imagery in designs and exports.
- **Location:** Project workspace → Import asset
- **How to use:** Open a project, choose Import asset, select a supported image, then place it using the editor's Image tool.
- **Implementation status:** Fully implemented. Stores PNG, JPEG, WebP, and GIF files as project assets that can be placed on a canvas.
- **Dependencies:** Create a project
- **Discovery:** “Bring in assets” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Keep reference-only uploads

- **Purpose:** Keep source material beside a project without implying unsupported rendering.
- **Location:** Project workspace → Import asset
- **How to use:** Choose Import asset and upload an SVG or PDF. Download it from the asset list; these formats are not canvas image layers.
- **Implementation status:** Fully implemented. Stores SVG and PDF uploads as downloadable references without placing them on the canvas.
- **Dependencies:** Create a project
- **Discovery:** “Bring in assets” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Import Penpot v3 files

- **Purpose:** Reuse part of a Penpot design in an editable UDS document.
- **Location:** Project workspace → Import asset
- **How to use:** Upload a Penpot v3 .penpot archive and review the conversion report and resulting pages.
- **Implementation status:** Experimental / live integration not verified. Converts supported pages, frames, groups, text, simple shapes, color tokens, and components; keeps the source file and reports unsupported content.
- **Dependencies:** Create a project
- **Discovery:** “Bring in assets” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [server/api/src/penpot-import.ts](../server/api/src/penpot-import.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

#### Keep Figma .fig references

- **Purpose:** Keep original source material with the project while being clear about conversion limits.
- **Location:** Project workspace → Import asset
- **How to use:** Upload a .fig file and download it later from the project asset list. Use the separate Figma REST file import for supported editable conversion.
- **Implementation status:** Partially implemented. Stores a .fig file as a downloadable reference; direct .fig decoding is not implemented.
- **Dependencies:** Create a project
- **Discovery:** “Bring in assets” tour.
- **Evidence:** [apps/studio/src/studio-app.tsx](../apps/studio/src/studio-app.tsx), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

### Design systems & components — 8 features

Create reusable tokens, themes, components, and portable token files.

#### Create typed design tokens

- **Purpose:** Reuse validated design values across a document.
- **Location:** Editor → Design system → Add token
- **How to use:** Open Design system, enter a token name, choose its type and value, then add it.
- **Implementation status:** Fully implemented. Stores color, number, dimension, font family/size, line height, radius, shadow, and border tokens.
- **Dependencies:** Create a project
- **Discovery:** “Create a design system” tour; contextual tip “Name tokens for their role”.
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Link token aliases

- **Purpose:** Keep repeated values consistent and easier to update.
- **Location:** Design system → Add token → Alias of; token row → alias selector
- **How to use:** Choose a same-type token in Alias of while creating or editing a token.
- **Implementation status:** Fully implemented. Links a token to another token of the same type and resolves the alias when rendering or exporting.
- **Dependencies:** Create typed design tokens
- **Discovery:** “Create a design system” tour.
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Create themes and modes

- **Purpose:** Represent supported visual variations within one document.
- **Location:** Design system → Theme and Mode controls
- **How to use:** Use + Theme or + Mode, then choose the active theme and mode before editing token values.
- **Implementation status:** Fully implemented. Creates named themes and token modes with per-mode token values.
- **Dependencies:** Create typed design tokens
- **Discovery:** “Create a design system” tour.
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Apply color tokens to canvas layers

- **Purpose:** Connect reusable color decisions with actual design content.
- **Location:** Design system → token list → Apply
- **How to use:** Select a text or shape layer, open Design system, and choose Apply beside a color token.
- **Implementation status:** Fully implemented. Links color tokens to selected text and shape fills so the canvas resolves the active mode value.
- **Dependencies:** Create typed design tokens, Select and multi-select layers
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx)

#### Create components and variants

- **Purpose:** Reuse a design element consistently across the document.
- **Location:** Editor toolbar → Create component; Design system → Components
- **How to use:** Select a supported layer and choose Create component. Edit its definition, properties, and variants in Design system; add component instances from the component list.
- **Implementation status:** Fully implemented. Turns a supported selection into a reusable component with editable properties and variants.
- **Dependencies:** Select and multi-select layers
- **Discovery:** “Create a design system” tour.
- **Evidence:** [apps/studio/src/canvas-editor.tsx](../apps/studio/src/canvas-editor.tsx), [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Import and export UDS design systems

- **Purpose:** Back up and reuse a complete UDS design system.
- **Location:** Design system → Interchange
- **How to use:** Choose Export UDS to download the system or Import JSON to load a supported design-system file.
- **Implementation status:** Fully implemented. Imports and exports the native UDS design-system JSON, including components.
- **Dependencies:** Create typed design tokens
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/token-interchange.ts](../packages/design-core/src/token-interchange.ts)

#### Exchange DTCG, Penpot, and Tokens Studio tokens

- **Purpose:** Move supported design tokens between compatible tools.
- **Location:** Design system → Interchange
- **How to use:** Choose Export DTCG or Import JSON, then review the transfer report for conversion notes.
- **Implementation status:** Fully implemented. Exports supported DTCG tokens and imports DTCG, Penpot, and Tokens Studio JSON while reporting omitted or transformed values.
- **Dependencies:** Create typed design tokens
- **Discovery:** “Create a design system” tour.
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [packages/design-core/src/token-interchange.ts](../packages/design-core/src/token-interchange.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

#### Import Figma files and variables

- **Purpose:** Reuse supported Figma content and publish a UDS token set to a Figma file.
- **Location:** Design system → Figma file and Variables
- **How to use:** Provide a Figma file key and access token with the required scopes. Import a file or variables; review the create payload and confirm before sending variables to Figma.
- **Implementation status:** Partially implemented. Reads supported Figma REST file content and variables and creates new Figma variables; direct sync requires eligible credentials and only creates new content.
- **Dependencies:** Create typed design tokens, Eligible Figma account and file scopes
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/design-system-panel.tsx](../apps/studio/src/design-system-panel.tsx), [server/api/src/figma-import.ts](../server/api/src/figma-import.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

### AI creation & review — 6 features

Turn a product brief into editable design proposals and review document quality.

#### Connect an AI provider

- **Purpose:** Enable provider-backed planning and design proposals without putting secrets in project documents.
- **Location:** Editor → AI Studio → Provider
- **How to use:** Choose a supported provider and enter its API key when prompted. Verify the connected status before using provider-backed actions.
- **Implementation status:** Fully implemented. Selects a supported provider and stores its API key in the configured local credential store, such as Windows Credential Manager.
- **Dependencies:** A configured AI provider
- **Discovery:** “Explore AI workflows” tour.
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [server/api/src/secure-credentials.ts](../server/api/src/secure-credentials.ts), [server/api/src/ai-providers.ts](../server/api/src/ai-providers.ts)

#### Draft a user flow and screen inventory

- **Purpose:** Translate product intent into a structured starting plan.
- **Location:** Editor → AI Studio → Plan & generate
- **How to use:** Connect an AI provider, describe the users/problem/outcome, choose screen and direction counts, then draft and review the plan.
- **Implementation status:** Experimental / live integration not verified. Uses a product brief to propose a user flow and editable screen inventory, which can be reviewed before screen generation.
- **Dependencies:** Connect an AI provider, A configured AI provider
- **Discovery:** “Explore AI workflows” tour; contextual tip “Start with the outcome”.
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [server/api/src/ai-service.ts](../server/api/src/ai-service.ts), [packages/ai-engine/src/index.ts](../packages/ai-engine/src/index.ts)

#### Generate editable design directions

- **Purpose:** Explore visual directions from an approved screen plan.
- **Location:** AI Studio → Plan & generate
- **How to use:** After reviewing the flow and screen inventory, choose Generate directions, review the proposal and quality notes, then apply a direction.
- **Implementation status:** Experimental / live integration not verified. Generates structured proposals and can apply a selected direction as editable pages after review.
- **Dependencies:** Draft a user flow and screen inventory, A configured AI provider
- **Discovery:** “Explore AI workflows” tour.
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [server/api/src/ai-service.ts](../server/api/src/ai-service.ts), [packages/ai-engine/src/index.ts](../packages/ai-engine/src/index.ts)

#### Review AI revision proposals

- **Purpose:** Use AI to refine specific selected content while retaining user review and revision checks.
- **Location:** AI Studio → Revise selection
- **How to use:** Select layers, enter the requested change, draft a proposal, choose operations, and apply the accepted changes. Save to persist them.
- **Implementation status:** Experimental / live integration not verified. Drafts scoped changes for selected layers and lets users accept selected operations before applying.
- **Dependencies:** A configured AI provider, Select and multi-select layers
- **Discovery:** “Explore AI workflows” tour.
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [server/api/src/ai-service.ts](../server/api/src/ai-service.ts), [packages/ai-engine/src/index.ts](../packages/ai-engine/src/index.ts)

#### Run a local design quality review

- **Purpose:** Expose issues for review before exporting or continuing a design.
- **Location:** AI Studio → Quality review
- **How to use:** Open Quality review and inspect the checks; refresh the review after changing the document.
- **Implementation status:** Fully implemented. Checks the current document and generated proposals with local structural and quality checks.
- **Dependencies:** None
- **Discovery:** “Explore AI workflows” tour.
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [packages/ai-engine/src/index.ts](../packages/ai-engine/src/index.ts)

#### Add selected reference images to an AI request

- **Purpose:** Provide visual references for an AI design task.
- **Location:** AI Studio → Plan & generate → Reference screenshots or images
- **How to use:** Import raster images into the project first, then select up to three images in AI Studio before sending a request.
- **Implementation status:** Experimental / live integration not verified. Allows up to three supported project images to be selected for provider-backed context.
- **Dependencies:** Import raster images, A configured AI provider
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [apps/studio/src/ai-studio-panel.tsx](../apps/studio/src/ai-studio-panel.tsx), [server/api/src/ai-service.ts](../server/api/src/ai-service.ts)

### Prototyping & UX — 5 features

Connect pages with interactions, variables, and a restricted prototype preview.

#### Define prototype variables

- **Purpose:** Represent state that can change during a click-through demo.
- **Location:** Editor → Prototype & UX → Variables
- **How to use:** Enter a name, choose the type and initial value, and choose Add variable.
- **Implementation status:** Fully implemented. Creates text, number, and boolean values scoped to the prototype.
- **Dependencies:** Create a project
- **Discovery:** “Make a clickable prototype” tour.
- **Evidence:** [apps/studio/src/prototype-panel.tsx](../apps/studio/src/prototype-panel.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Bind variables to text

- **Purpose:** Show changing values in a prototype preview.
- **Location:** Prototype & UX → Bind a variable to text
- **How to use:** Select a text layer in the canvas, choose a variable, and choose Bind.
- **Implementation status:** Fully implemented. Connects a prototype variable to a selected text layer.
- **Dependencies:** Define prototype variables, Add text
- **Discovery:** “Make a clickable prototype” tour.
- **Evidence:** [apps/studio/src/prototype-panel.tsx](../apps/studio/src/prototype-panel.tsx), [apps/studio/src/prototype-preview.tsx](../apps/studio/src/prototype-preview.tsx)

#### Configure prototype interactions

- **Purpose:** Demonstrate a user flow without changing the design document during preview.
- **Location:** Prototype & UX → Add interaction
- **How to use:** Select a source layer, choose the trigger/action and its target or value, then add the interaction.
- **Implementation status:** Fully implemented. Connects a selected layer to navigation, overlays, variable updates, or component variant changes using click, double-click, or hover triggers.
- **Dependencies:** Select and multi-select layers, Manage design pages
- **Discovery:** “Make a clickable prototype” tour; contextual tip “Choose the source layer first”.
- **Evidence:** [apps/studio/src/prototype-panel.tsx](../apps/studio/src/prototype-panel.tsx), [apps/studio/src/prototype-preview.tsx](../apps/studio/src/prototype-preview.tsx), [packages/design-core/src/index.ts](../packages/design-core/src/index.ts)

#### Preview a clickable prototype

- **Purpose:** Review navigation and interactive behavior safely.
- **Location:** Prototype & UX → Open clickable preview
- **How to use:** Add pages and interactions, then choose Open clickable preview.
- **Implementation status:** Fully implemented. Runs configured interactions inside a sandboxed iframe; preview changes do not modify the design document.
- **Dependencies:** Configure prototype interactions
- **Discovery:** “Make a clickable prototype” tour.
- **Evidence:** [apps/studio/src/prototype-panel.tsx](../apps/studio/src/prototype-panel.tsx), [apps/studio/src/prototype-preview.tsx](../apps/studio/src/prototype-preview.tsx)

#### Check prototype UX and accessibility

- **Purpose:** Catch structural and accessibility issues before sharing a prototype preview.
- **Location:** Prototype & UX → UX & accessibility review
- **How to use:** Open the panel and review each check; fix issues in the canvas or interaction settings.
- **Implementation status:** Fully implemented. Reports reachability, entry points, trigger keyboard support, source visibility, image descriptions, and variable bindings.
- **Dependencies:** None
- **Discovery:** “Make a clickable prototype” tour.
- **Evidence:** [apps/studio/src/prototype-panel.tsx](../apps/studio/src/prototype-panel.tsx)

### Review & history — 4 features

Leave local page or layer feedback and compare saved revisions.

#### Comment on a page or layer

- **Purpose:** Record review feedback alongside the saved design state.
- **Location:** Editor → Review → Comments
- **How to use:** Save the document, optionally select a layer, enter feedback in New comment, and choose Add comment.
- **Implementation status:** Fully implemented. Creates a saved comment thread anchored to a project/document revision, page, and optional layer.
- **Dependencies:** Save a document revision
- **Discovery:** “Review and compare work” tour; contextual tip “Anchor feedback to a saved state”.
- **Evidence:** [apps/studio/src/review-panel.tsx](../apps/studio/src/review-panel.tsx), [server/api/src/index.ts](../server/api/src/index.ts), [docs/PHASE_9_COLLABORATION.md](../docs/PHASE_9_COLLABORATION.md)

#### Reply to and manage comment threads

- **Purpose:** Track local feedback through resolution.
- **Location:** Review → Comments → Threads
- **How to use:** Reply to an open thread, resolve it when addressed, and change the filter to view resolved or all threads.
- **Implementation status:** Fully implemented. Supports replies and open/resolved/all filtering, with resolve and reopen actions.
- **Dependencies:** Comment on a page or layer
- **Discovery:** “Review and compare work” tour.
- **Evidence:** [apps/studio/src/review-panel.tsx](../apps/studio/src/review-panel.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Compare saved revisions

- **Purpose:** Understand what changed between saved document states.
- **Location:** Editor → History or Review → Revision compare
- **How to use:** Save at least two revisions, choose From and To revisions, and select Compare.
- **Implementation status:** Fully implemented. Compares two saved revisions and summarizes page/layer changes plus design-system and prototype change flags.
- **Dependencies:** Save a document revision
- **Discovery:** “Review and compare work” tour.
- **Evidence:** [apps/studio/src/review-panel.tsx](../apps/studio/src/review-panel.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

#### Restore a prior revision

- **Purpose:** Return to an earlier design without erasing the revision trail.
- **Location:** Review → Revision compare → Restore
- **How to use:** Compare revisions, choose a previous revision in the comparison, and select Restore as a new revision.
- **Implementation status:** Fully implemented. Restores an earlier saved state as a new immutable revision while preserving existing history.
- **Dependencies:** Compare saved revisions
- **Discovery:** “Review and compare work” tour.
- **Evidence:** [apps/studio/src/review-panel.tsx](../apps/studio/src/review-panel.tsx), [server/api/src/index.ts](../server/api/src/index.ts)

### Code handoff — 4 features

Export a portable frontend bundle and inspect its static output.

#### Download a code bundle

- **Purpose:** Give developers a portable starting point for implementation.
- **Location:** Editor → Code handoff
- **How to use:** Review included files and export notes, then choose Download code bundle.
- **Implementation status:** Fully implemented. Exports the supported design as a React/Vite project, static HTML/CSS, tokens, referenced images, and setup notes.
- **Dependencies:** Save a document revision
- **Discovery:** “Prepare a developer handoff” tour.
- **Evidence:** [apps/studio/src/code-handoff-panel.tsx](../apps/studio/src/code-handoff-panel.tsx), [server/api/src/index.ts](../server/api/src/index.ts), [packages/renderer/src/codegen.ts](../packages/renderer/src/codegen.ts), [docs/CODE_HANDOFF.md](../docs/CODE_HANDOFF.md)

#### Review export diagnostics

- **Purpose:** Show what the generated output can preserve and what needs follow-up.
- **Location:** Code handoff → Export notes
- **How to use:** Open Code handoff and read the Export notes before downloading the bundle.
- **Implementation status:** Fully implemented. Reports unsupported or lossy constructs before code export.
- **Dependencies:** Download a code bundle
- **Discovery:** “Prepare a developer handoff” tour.
- **Evidence:** [apps/studio/src/code-handoff-panel.tsx](../apps/studio/src/code-handoff-panel.tsx), [packages/renderer/src/codegen.ts](../packages/renderer/src/codegen.ts)

#### Preview restricted static output

- **Purpose:** Inspect exported appearance without running generated code.
- **Location:** Code handoff → Open restricted preview
- **How to use:** Choose Open restricted preview. The preview is intentionally static and isolated.
- **Implementation status:** Fully implemented. Displays generated static HTML in an iframe with scripts, network, forms, and external images blocked.
- **Dependencies:** Download a code bundle
- **Discovery:** “Prepare a developer handoff” tour.
- **Evidence:** [apps/studio/src/code-handoff-panel.tsx](../apps/studio/src/code-handoff-panel.tsx), [docs/CODE_HANDOFF.md](../docs/CODE_HANDOFF.md)

#### Prepare a Git-ready export

- **Purpose:** Make a downloaded bundle easier to adopt in a local repository.
- **Location:** Code handoff → Prepare for local Git
- **How to use:** Select Prepare for local Git before downloading the bundle.
- **Implementation status:** Fully implemented. Adds a .gitignore and local setup instructions to the downloaded bundle; it does not initialize Git or push to GitHub.
- **Dependencies:** Download a code bundle
- **Discovery:** “Prepare a developer handoff” tour.
- **Evidence:** [apps/studio/src/code-handoff-panel.tsx](../apps/studio/src/code-handoff-panel.tsx), [docs/CODE_HANDOFF.md](../docs/CODE_HANDOFF.md)

### Agent integration (MCP) — 4 features

Expose bounded project summaries to a connected MCP client.

#### MCP: list projects

- **Purpose:** Let an authorized desktop agent discover available UDS projects.
- **Location:** External MCP client connected to the local UDS server
- **How to use:** Start the local MCP server and call list_projects from an enabled MCP client.
- **Implementation status:** Fully implemented. Returns bounded metadata for local projects to a connected MCP host.
- **Dependencies:** Local MCP server and compatible host
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [server/api/src/mcp.ts](../server/api/src/mcp.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

#### MCP: read project summary

- **Purpose:** Give an agent a compact view of a project's saved structure.
- **Location:** External MCP client → get_project_summary
- **How to use:** Call get_project_summary with a project ID from list_projects.
- **Implementation status:** Fully implemented. Returns bounded project counts and revision metadata without returning full document snapshots.
- **Dependencies:** MCP: list projects
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [server/api/src/mcp.ts](../server/api/src/mcp.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

#### MCP: read selected node summaries

- **Purpose:** Let an agent inspect a narrow, user-chosen part of a saved design.
- **Location:** External MCP client → get_node_summaries
- **How to use:** Provide a project ID, page ID, and the node IDs to summarize.
- **Implementation status:** Fully implemented. Returns up to 50 summaries for explicitly requested nodes, with text truncated to 500 characters.
- **Dependencies:** MCP: read project summary
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [server/api/src/mcp.ts](../server/api/src/mcp.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

#### MCP: revision-checked text and rename writes

- **Purpose:** Offer narrowly scoped edits while preserving document revision checks.
- **Location:** External MCP client; write tools are not enabled in the current Antigravity connection
- **How to use:** An MCP host must explicitly enable the write tools and review each proposed mutation before use.
- **Implementation status:** Partially implemented. The server implements set_layer_text and rename_layer commands that require an expected revision; the current Antigravity connection does not expose them.
- **Dependencies:** MCP: read selected node summaries
- **Discovery:** No in-app tour (external MCP surface).
- **Evidence:** [server/api/src/mcp.ts](../server/api/src/mcp.ts), [docs/INTEROPERABILITY.md](../docs/INTEROPERABILITY.md)

## Important dependencies

- Canvas image placement depends on importing a PNG, JPEG, WebP, or GIF project asset first.
- AI planning, generation, and revision proposals require a configured provider key; design quality review runs locally.
- Layer comments require a saved revision and are local-only; they do not create user identities or cloud sharing.
- Revision comparison requires at least two saved revisions; restoration creates a new revision.
- Figma file/variable features require valid file access and the relevant API scopes; some content is omitted with a report.
- MCP tools require the local MCP server and an external compatible host; optional write tools are not enabled in the current Antigravity connection.

### External prerequisites

- **A configured AI provider:** Provider-backed requests require a valid key and configured provider. Live provider behavior is not verified without user credentials.
- **Eligible Figma account and file scopes:** File and Variables REST endpoints require the appropriate account, file permissions, and API scopes.
- **Local MCP server and compatible host:** MCP tools are available only when the user starts the local server and connects an external MCP client.

## Unavailable or incomplete UI and functionality

No separate verified feature is classified as unavailable; the following visible elements are placeholders and are excluded from the feature total:

- **Account menu** (Workspace top bar avatar): The avatar is a visual placeholder; there is no sign-in, account profile, or identity flow.
- **Custom AI provider adapter** (Workspace Settings → Preferred AI provider): The option is visible but disabled; only the listed built-in providers can be configured.

Additional limitations explicitly reflected in the feature statuses:

- The command palette search does not filter results.
- The custom AI provider choice is disabled; built-in provider requests need a working credential and model configuration.
- Penpot import covers a supported subset and remains lossy for other content; Figma `.fig` decoding is unavailable and uploads are references only.
- Direct Figma REST access requires appropriate account/file scopes; live calls were not verified in this audit.
- MCP is a separate local service; optional write commands are not exposed in the current Antigravity allowlist.
- Reviews are local single-user notes, not invitations or synchronized collaboration.

## Evidence standard

Feature records were verified against current React controls/handlers, associated local server commands, design-core schemas, and maintained interoperability/product documentation. The base workspace, project, AI Studio, Design System, Prototype, Code Handoff, Review, and History surfaces were opened in the desktop browser during the product audit. The newly implemented welcome, Explorer, tour, and announcement interactions were not browser-verified during this implementation because computer control was disabled. External provider and Figma account flows were inspected but not submitted without user credentials; their live service behavior is not claimed as verified.
