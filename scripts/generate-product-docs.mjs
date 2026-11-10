import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const registry = await readJson("apps/studio/src/discovery/feature-registry.json");
const toursSource = await readFile(new URL("apps/studio/src/discovery/tour-registry.ts", root), "utf8");
const tourMatches = [...toursSource.matchAll(/id: "([^"]+)"[\s\S]*?title: "([^"]+)"[\s\S]*?description: "([^"]+)"[\s\S]*?categoryId: "([^"]+)"[\s\S]*?surface: "([^"]+)"[\s\S]*?featureIds: \[([^\]]+)\]/g)];
const tours = tourMatches.map(match => ({ id: match[1], title: match[2], description: match[3], categoryId: match[4], surface: match[5], featureIds: [...match[6].matchAll(/"([^"]+)"/g)].map(item => item[1]) }));
const guidesSource = await readFile(new URL("apps/studio/src/discovery/contextual-guides.ts", root), "utf8");
const guides = [...guidesSource.matchAll(/id: "([^"]+)"[\s\S]*?featureId: "([^"]+)"[\s\S]*?targetId: "([^"]+)"[\s\S]*?actionId: "([^"]+)"[\s\S]*?title: "([^"]+)"[\s\S]*?message: "([^"]+)"/g)].map(match => ({ id: match[1], featureId: match[2], targetId: match[3], actionId: match[4], title: match[5], message: match[6] }));
const byStatus = Object.fromEntries(["fully_implemented", "partially_implemented", "experimental", "unavailable"].map(status => [status, registry.features.filter(feature => feature.status === status).length]));
const categoryCounts = registry.categories.map(category => ({ ...category, features: registry.features.filter(feature => feature.categoryId === category.id) }));
const featureById = new Map(registry.features.map(feature => [feature.id, feature]));
const dependencyTitle = id => featureById.get(id)?.title ?? registry.externalDependencies.find(item => item.id === id)?.title ?? id;
const statusName = status => ({ fully_implemented: "Fully implemented", partially_implemented: "Partially implemented", experimental: "Experimental / live integration not verified", unavailable: "Unavailable" })[status] ?? status;
const clean = text => String(text).replaceAll("|", "\\|").replaceAll("\n", " ");

const inventory = [
  "# Verified product feature inventory",
  "",
  "> Generated from `apps/studio/src/discovery/feature-registry.json`. Update the structured registry and run `node scripts/generate-product-docs.mjs` after an application capability changes. This inventory covers the verified user-facing product and its separately hosted MCP adapter; it does not count this discovery UI as an original product feature.",
  "",
  "## Audit totals",
  "",
  `- **Verified user-facing capabilities:** ${registry.features.length}`,
  `- **Categories:** ${registry.categories.length}`,
  `- **Fully implemented:** ${byStatus.fully_implemented}`,
  `- **Partially implemented:** ${byStatus.partially_implemented}`,
  `- **Experimental or live integrations not verified:** ${byStatus.experimental}`,
  `- **Unavailable features:** ${byStatus.unavailable}`,
  `- **Visible UI placeholders (excluded from verified feature total):** ${registry.unavailableUi.length}`,
  "",
  "Status describes the shipped code path, not an assertion that an external account, credential, model, or third-party file was available during this audit. Provider-backed generation and Figma live calls have not been exercised with user credentials. A capability can be implemented locally while requiring an external prerequisite.",
  "",
  "## Complete navigation and discovery map",
  "",
  "The Studio is a **single-page application with two primary surfaces**, not a URL-routed multi-page app. The workspace changes into the project view and then into the editor; editor tools appear in panels/dialogs over the editor.",
  "",
  "| Surface | Navigation and controls | Feature areas reached |",
  "|---|---|---|",
  "| Workspace home | Brand link, All projects, Recent projects, New project, Create project | Project creation, open/refresh recent projects, settings, command palette |",
  "| Project workspace | Projects breadcrumb, Rename, Archive, Open editor, Import asset, asset download/remove | Project metadata, editable raster images, reference files, Penpot conversion |",
  "| Editor header | Projects, Review, AI Studio, Design system, Prototype, Code handoff, History, Undo, Redo, Save | Review threads, AI flows, tokens/components, prototype, export, saved revisions |",
  "| Editor toolbar | Select, Pan, Frame, Text, Shape, Image, Container, Create component, Align left, Center, Group, Desktop size, Zoom | Canvas editing and desktop preview presets |",
  "| Editor left panel | Pages, add/rename/delete page, Layers, add layer, visibility | Multi-page structure and layer navigation |",
  "| Editor center | Artboard; select, drag, resize; Ctrl+mousewheel zoom; middle-button pan | Visual canvas interactions |",
  "| Editor right panel | Design inspector | Geometry, text/fill, container layout, and component-instance properties |",
  "| AI Studio panel | Provider, Plan & generate, Revise selection, Quality review | Provider setup, flow/screen plans, proposals, local checks |",
  "| Design system panel | Theme, Mode, Add token, Tokens, Components, Interchange, Figma file and Variables | Tokens, aliases, modes, components, portable JSON, Figma REST |",
  "| Prototype & UX panel | Preview, Variables, Text bindings, Add interaction, UX & accessibility review | Prototype variables, events, navigation, overlays, preflight |",
  "| Review & history panel | Comments, thread filter/actions, Revision compare | Comments/replies, compare, restore |",
  "| Code handoff panel | Export notes, restricted preview, Prepare for local Git, Download bundle | Static preview and frontend ZIP export |",
  "| External MCP client | Local MCP server: `list_projects`, `get_project_summary`, `get_node_summaries`; optional revision-checked text/rename commands | Bounded agent access; not an in-app navigation item |",
  "",
  "### Verified keyboard and pointer interactions",
  "",
  "- On the workspace: `Ctrl/Cmd+K` opens the command palette; `Ctrl/Cmd+N` opens new-project creation; `Escape` closes workspace modals/palette.",
  "- In the editor: `Ctrl/Cmd+S` saves; `Ctrl/Cmd+Z` undo; `Ctrl/Cmd+Shift+Z` redo; `Delete` deletes the selection; `Escape` clears it.",
  "- `Ctrl/Cmd+click` toggles multi-selection; double-click a page name to rename; drag a selected canvas layer to move it; drag its handle to resize.",
  "- Select Pan and drag, or use the middle mouse button; `Ctrl+wheel` over the canvas adjusts zoom.",
  "- The command palette displays an input but it **does not filter actions**; Enter only closes it. This is recorded as partially implemented.",
  "- The local service accepts a recent-project limit setting, but the current Settings dialog does not expose a control for it; the workspace uses the default of 12.",
  "",
  "## Feature details by category",
  ""
];

for (const category of categoryCounts) {
  inventory.push(`### ${category.title} — ${category.features.length} features`, "", category.description, "");
  for (const feature of category.features) {
    const dependencies = feature.dependencies.length ? feature.dependencies.map(dependencyTitle).join(", ") : "None";
    inventory.push(`#### ${feature.title}`, "", `- **Purpose:** ${clean(feature.purpose)}`, `- **Location:** ${clean(feature.location)}`, `- **How to use:** ${clean(feature.howTo)}`, `- **Implementation status:** ${statusName(feature.status)}. ${clean(feature.summary)}`, `- **Dependencies:** ${clean(dependencies)}`, `- **Discovery:** ${feature.tourId ? `“${tours.find(tour => tour.id === feature.tourId)?.title ?? feature.tourId}” tour` : "No in-app tour (external MCP surface)"}${feature.guideId ? `; contextual tip “${guides.find(guide => guide.id === feature.guideId)?.title ?? feature.guideId}”.` : "."}`, `- **Evidence:** ${feature.evidence.map(path => "[" + path + "](" + "../" + path + ")").join(", ")}`, "");
  }
}

inventory.push("## Important dependencies", "", ...registry.importantDependencies.map(item => `- ${item}`), "", "### External prerequisites", "", ...registry.externalDependencies.map(item => `- **${item.title}:** ${item.reason}`), "", "## Unavailable or incomplete UI and functionality", "", "No separate verified feature is classified as unavailable; the following visible elements are placeholders and are excluded from the feature total:", "", ...registry.unavailableUi.map(item => `- **${item.title}** (${item.location}): ${item.reason}`), "", "Additional limitations explicitly reflected in the feature statuses:", "", "- The command palette search does not filter results.", "- The custom AI provider choice is disabled; built-in provider requests need a working credential and model configuration.", "- Penpot import covers a supported subset and remains lossy for other content; Figma `.fig` decoding is unavailable and uploads are references only.", "- Direct Figma REST access requires appropriate account/file scopes; live calls were not verified in this audit.", "- MCP is a separate local service; optional write commands are not exposed in the current Antigravity allowlist.", "- Reviews are local single-user notes, not invitations or synchronized collaboration.", "", "## Evidence standard", "", "Feature records were verified against current React controls/handlers, associated local server commands, design-core schemas, and maintained interoperability/product documentation. The base workspace, project, AI Studio, Design System, Prototype, Code Handoff, Review, and History surfaces were opened in the desktop browser during the product audit. The newly implemented welcome, Explorer, tour, and announcement interactions were not browser-verified during this implementation because computer control was disabled. External provider and Figma account flows were inspected but not submitted without user credentials; their live service behavior is not claimed as verified.", "");

await writeFile(new URL("docs/PRODUCT_FEATURE_INVENTORY.md", root), inventory.join("\n"), "utf8");

const architecture = [
  "# Product discovery architecture",
  "",
  "## Current application shape",
  "",
  "Unified Design Studio is a React 19 + Vite single-page desktop workspace. `StudioApp` owns workspace/project state; opening a project and editor switches the rendered surface. `CanvasEditor` owns document editing and conditionally mounts the AI Studio, Design System, Prototype, Code Handoff, Review, and History panels. There is no route library. The product feature inventory and UI registry live in `apps/studio/src/discovery/feature-registry.json`.",
  "",
  "## Components and responsibilities",
  "",
  "- `DiscoveryProvider.tsx` — owns discovery progress, modal/tour lifecycle, registered surface actions, keyboard handling, and portal rendering.",
  "- `feature-registry.json` — canonical descriptions/status/category/location/use instructions/dependencies and stable tour target references for verified product capabilities.",
  "- `tour-registry.ts` — category tour definitions, surface, and feature step IDs, separated from display.",
  "- `contextual-guides.ts` — small first-encounter tips linked to an existing feature and stable target.",
  "- `announcement-registry.ts` — structured What's New items; no announcement markup is hardcoded into feature controls.",
  "- `discovery-state.ts` — versioned state normalization, reducer, guarded storage access, and serialization.",
  "- `discovery.css` — spotlight, cards, visual states, breakpoints, focus appearance, and reduced-motion overrides.",
  "- `scripts/generate-product-docs.mjs` — derives the feature inventory and tour guide from the registry/tour definitions.",
  "",
  "## Stable target and navigation model",
  "",
  "Controls use exact `data-discovery-id` values. Tours resolve an ID by comparing the attribute value rather than relying on CSS interpolation. Each feature step may declare a `beforeActionId`. `StudioApp` registers `surface.workspace`, `surface.project`, and `surface.editor`; `CanvasEditor` registers its panel openers. The tour waits briefly for an action while a view mounts, runs it, scrolls the actual target into view, and verifies visibility before painting a spotlight.",
  "",
  "A missing action or target produces a visible unavailable message and Retry, Previous, and Skip controls. It never advances past a missing target automatically. A tour may be intentionally unavailable when the prerequisite state does not exist (for example, no saved project or a selection-only workflow); the Explorer explains dependencies, and the missing step remains visible to the user.",
  "",
  "`ResizeObserver`, scroll/resize listeners, and targeted ancestor mutation observers keep the spotlight aligned with panel layout and nested scrolling. If a target disappears, the card changes to a retry state. The shade is non-interactive so the highlighted real control remains operable; users can still reach other controls while a tour is running. The tooltip itself accepts pointer input.",
  "",
  "## Progress and persistence",
  "",
  `Progress is stored in browser local storage under \`${"uds.product-discovery.v1"}\` using schema version 1. It remembers welcome completion/skipping, completed and skipped tour IDs, dismissed contextual-guide IDs, acknowledged announcement IDs, whether contextual tips are enabled, and replay intent. Corrupt, inaccessible, or unavailable local storage falls back safely to a fresh in-memory state; the existing SQLite project database is not changed.`,
  "",
  "Reset Progress clears only discovery preferences. Replay onboarding returns the welcome experience without deleting project content. No account identity or backend persistence exists in the current single-user architecture.",
  "",
  "## Accessibility and interaction behavior",
  "",
  "- Welcome, Explorer, What's New, tour, and completion surfaces use labelled modal dialogs, initial focus, Tab/Shift+Tab cycling, Escape support, and focus restoration.",
  "- Tour supports ArrowLeft/ArrowRight outside text inputs; its Previous, Next, Retry, and Skip actions are keyboard reachable.",
  "- Search and result counts have explicit labels; unavailable steps use an alert and target discovery uses a live status.",
  "- Spotlight follows scrolling/resizing. Modal and Explorer layouts adapt to narrow widths, though UDS itself remains a desktop-only editor.",
  "- Reduced-motion preferences disable motion/transitions; focus-visible outlines and contrast distinguish control states.",
  "- The app has no automated screen-reader or browser-level keyboard regression yet; see testing notes in the product-tour guide.",
  "",
  "## Known limits and future hardening",
  "",
  "- There is no browser router; the action registry is intentionally the bridge between tours and current stateful views.",
  "- The tour overlay leaves the underlying app usable (spotlight hole and non-interactive shade) to keep highlighted controls operable. If strict modal blocking is later required, implement a true event-through spotlight cutout and verify target click-through before changing this behavior.",
  "- Tour positions are computed from the visible target and card dimensions are bounded; extremely small viewports can require additional collision tests.",
  "- Local browser storage is per browser profile and device; progress does not sync between browsers.",
  "- Announcement data remains in a static registry; it has no server feed or release automation.",
  "",
  "## Change procedure",
  "",
  "1. Verify the product code path and update the registry entry, including status, prerequisites, usage, and evidence.",
  "2. Add/verify `data-discovery-id` on the real visible control; use an explicit registered action if a panel/surface must open first.",
  "3. Update a category tour/context tip only where the real workflow supports it.",
  "4. Run `node scripts/generate-product-docs.mjs`, unit tests, typecheck, and a production build.",
  "5. Open the running app and verify discovery at desktop sizes before reporting completion.",
  ""
].join("\n");
await writeFile(new URL("docs/ONBOARDING_ARCHITECTURE.md", root), architecture, "utf8");

const guide = [
  "# Guided product tour guide",
  "",
  `The registry currently defines **${tours.length} category tours**, **${tours.reduce((sum, tour) => sum + tour.featureIds.length, 0)} tour steps**, and **${guides.length} contextual tips**. Tours are short by product category; there is no one tour that attempts to cover every capability. Every step is linked to a verified feature and stable target ID.`,
  "",
  "## Find and launch a tour",
  "",
  "Choose **Discover** from the workspace/editor top bar, search or filter a category, and use the tour action on a feature card. The Explorer also offers replay onboarding, contextual-tip replay where available, a show/hide tips preference, and Reset progress. From any tour use Previous, Next, Skip tour, Escape, or the left/right arrow keys. A completed tour offers the Feature Explorer.",
  "",
  "## Category tours",
  ""
];
for (const tour of tours) {
  const category = registry.categories.find(item => item.id === tour.categoryId);
  guide.push(`### ${tour.title} (${tour.featureIds.length} steps)`, "", `**Category:** ${category?.title ?? tour.categoryId}. **Starting surface:** ${tour.surface}. ${tour.description}`, "");
  for (const [index, id] of tour.featureIds.entries()) {
    const feature = featureById.get(id);
    guide.push(`${index + 1}. **${feature?.title ?? id}** — ${feature?.howTo ?? "Feature entry not found."} ` + (feature?.targetId ? `Target: \`${feature.targetId}\`.` : ""));
  }
  guide.push("");
}
guide.push("## Contextual tips", "", ...guides.map(item => {
  const feature = featureById.get(item.featureId);
  return `- **${item.title}** (${feature?.title ?? item.featureId}) — ${item.message} Replay target: \`${item.targetId}\`.`;
}), "", "## Unavailable-step behavior", "", "The tour opens a prerequisite panel/surface if the action is registered, waits for the actual target to render, scrolls it into view, and verifies it. If a project, selection, saved revision, or target is absent, the card tells the user why and offers Retry, Previous, and Skip tour. It does not silently jump to another feature. Some category tours therefore stop when the current project has no required state; users can close the tour and continue independently.", "", "## Keyboard and assistive technology", "", "- Tab / Shift+Tab stays within a tour or discovery dialog.", "- Escape closes the current overlay; a tour is recorded as skipped.", "- ArrowRight advances and ArrowLeft returns while focus is not inside a text field.", "- The tour card announces step count, feature name, purpose, use instructions, and missing-target error.", "- Honor operating-system reduced-motion preferences; spotlight tracking follows scroll and resize.", "", "## Testing record", "", "Source-level feature/tour relationships, unique targets, persistence, search, and action ownership are checked in `tests/unit/product-discovery.test.ts`. The complete existing unit suite, workspace typecheck, and Studio production build were run for this implementation. The new welcome, Explorer, tour, contextual tip, and announcement flows were not interacted with in a browser during this implementation because computer control was disabled; add browser-level route, scroll, keyboard, and persistence checks before release. The tour engine does not invoke an AI provider, submit Figma credentials, upload assets, or save document changes as part of its steps.", "");
await writeFile(new URL("docs/PRODUCT_TOUR_GUIDE.md", root), guide.join("\n"), "utf8");

const whatsNew = [
  "# What's New system",
  "",
  "## Registry and user behavior",
  "",
  "`apps/studio/src/discovery/announcement-registry.ts` is the single structured source for update ID, date, title, short summary, details, related tour, and related feature IDs. The top-bar **What’s new** entry displays an unread dot while any announcement ID is unacknowledged. Opening the panel shows the full changelog, a NEW marker for unread entries, and a contextual tour action when defined.",
  "",
  "Announcements are acknowledged with Mark as read or by launching their linked tour. Acknowledged IDs are stored in the same versioned discovery progress record as onboarding; they are not repeated in the unread state after refresh. Past entries remain readable in the panel.",
  "",
  "## Current announcement",
  "",
  "The launch announcement introduces the Feature Explorer, short category tours, contextual tips, and persisted onboarding progress. It is dated in the registry and opens the Get oriented tour.",
  "",
  "## Add a future announcement",
  "",
  "1. Add a stable unique ID and release date to `announcement-registry.ts`.",
  "2. Explain what changed and why it matters in the summary/details; reference only existing feature IDs and an existing tour ID.",
  "3. Add/adjust the registry validation test if a new schema field is introduced.",
  "4. Do not hardcode the announcement into the launcher or app panels; render it through the What's New list.",
  "5. Keep previous records so users can revisit them. A versioned ID change intentionally represents a new announcement.",
  "",
  "## Current boundary",
  "",
  "This is a local static changelog registry. There is no remote release feed, administrator interface, or cross-device announcement synchronization. A build/release author maintains the registry; there is no app-specific content management service.",
  ""
].join("\n");
await writeFile(new URL("docs/WHATS_NEW_SYSTEM.md", root), whatsNew, "utf8");

console.log(`Generated inventory (${registry.features.length} verified features), architecture, tour guide (${tours.length} tours), and What's New documentation.`);
