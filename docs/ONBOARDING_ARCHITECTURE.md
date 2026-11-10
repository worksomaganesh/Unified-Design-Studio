# Product discovery architecture

## Current application shape

Unified Design Studio is a React 19 + Vite single-page desktop workspace. `StudioApp` owns workspace/project state; opening a project and editor switches the rendered surface. `CanvasEditor` owns document editing and conditionally mounts the AI Studio, Design System, Prototype, Code Handoff, Review, and History panels. There is no route library. The product feature inventory and UI registry live in `apps/studio/src/discovery/feature-registry.json`.

## Components and responsibilities

- `DiscoveryProvider.tsx` — owns discovery progress, modal/tour lifecycle, registered surface actions, keyboard handling, and portal rendering.
- `feature-registry.json` — canonical descriptions/status/category/location/use instructions/dependencies and stable tour target references for verified product capabilities.
- `tour-registry.ts` — category tour definitions, surface, and feature step IDs, separated from display.
- `contextual-guides.ts` — small first-encounter tips linked to an existing feature and stable target.
- `announcement-registry.ts` — structured What's New items; no announcement markup is hardcoded into feature controls.
- `discovery-state.ts` — versioned state normalization, reducer, guarded storage access, and serialization.
- `discovery.css` — spotlight, cards, visual states, breakpoints, focus appearance, and reduced-motion overrides.
- `scripts/generate-product-docs.mjs` — derives the feature inventory and tour guide from the registry/tour definitions.

## Stable target and navigation model

Controls use exact `data-discovery-id` values. Tours resolve an ID by comparing the attribute value rather than relying on CSS interpolation. Each feature step may declare a `beforeActionId`. `StudioApp` registers `surface.workspace`, `surface.project`, and `surface.editor`; `CanvasEditor` registers its panel openers. The tour waits briefly for an action while a view mounts, runs it, scrolls the actual target into view, and verifies visibility before painting a spotlight.

A missing action or target produces a visible unavailable message and Retry, Previous, and Skip controls. It never advances past a missing target automatically. A tour may be intentionally unavailable when the prerequisite state does not exist (for example, no saved project or a selection-only workflow); the Explorer explains dependencies, and the missing step remains visible to the user.

`ResizeObserver`, scroll/resize listeners, and targeted ancestor mutation observers keep the spotlight aligned with panel layout and nested scrolling. If a target disappears, the card changes to a retry state. The shade is non-interactive so the highlighted real control remains operable; users can still reach other controls while a tour is running. The tooltip itself accepts pointer input.

## Progress and persistence

Progress is stored in browser local storage under `uds.product-discovery.v1` using schema version 1. It remembers welcome completion/skipping, completed and skipped tour IDs, dismissed contextual-guide IDs, acknowledged announcement IDs, whether contextual tips are enabled, and replay intent. Corrupt, inaccessible, or unavailable local storage falls back safely to a fresh in-memory state; the existing SQLite project database is not changed.

Reset Progress clears only discovery preferences. Replay onboarding returns the welcome experience without deleting project content. No account identity or backend persistence exists in the current single-user architecture.

## Accessibility and interaction behavior

- Welcome, Explorer, What's New, tour, and completion surfaces use labelled modal dialogs, initial focus, Tab/Shift+Tab cycling, Escape support, and focus restoration.
- Tour supports ArrowLeft/ArrowRight outside text inputs; its Previous, Next, Retry, and Skip actions are keyboard reachable.
- Search and result counts have explicit labels; unavailable steps use an alert and target discovery uses a live status.
- Spotlight follows scrolling/resizing. Modal and Explorer layouts adapt to narrow widths, though UDS itself remains a desktop-only editor.
- Reduced-motion preferences disable motion/transitions; focus-visible outlines and contrast distinguish control states.
- The app has no automated screen-reader or browser-level keyboard regression yet; see testing notes in the product-tour guide.

## Known limits and future hardening

- There is no browser router; the action registry is intentionally the bridge between tours and current stateful views.
- The tour overlay leaves the underlying app usable (spotlight hole and non-interactive shade) to keep highlighted controls operable. If strict modal blocking is later required, implement a true event-through spotlight cutout and verify target click-through before changing this behavior.
- Tour positions are computed from the visible target and card dimensions are bounded; extremely small viewports can require additional collision tests.
- Local browser storage is per browser profile and device; progress does not sync between browsers.
- Announcement data remains in a static registry; it has no server feed or release automation.

## Change procedure

1. Verify the product code path and update the registry entry, including status, prerequisites, usage, and evidence.
2. Add/verify `data-discovery-id` on the real visible control; use an explicit registered action if a panel/surface must open first.
3. Update a category tour/context tip only where the real workflow supports it.
4. Run `node scripts/generate-product-docs.mjs`, unit tests, typecheck, and a production build.
5. Open the running app and verify discovery at desktop sizes before reporting completion.
