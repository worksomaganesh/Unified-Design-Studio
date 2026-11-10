# What's New system

## Registry and user behavior

`apps/studio/src/discovery/announcement-registry.ts` is the single structured source for update ID, date, title, short summary, details, related tour, and related feature IDs. The top-bar **What’s new** entry displays an unread dot while any announcement ID is unacknowledged. Opening the panel shows the full changelog, a NEW marker for unread entries, and a contextual tour action when defined.

Announcements are acknowledged with Mark as read or by launching their linked tour. Acknowledged IDs are stored in the same versioned discovery progress record as onboarding; they are not repeated in the unread state after refresh. Past entries remain readable in the panel.

## Current announcement

The launch announcement introduces the Feature Explorer, short category tours, contextual tips, and persisted onboarding progress. It is dated in the registry and opens the Get oriented tour.

## Add a future announcement

1. Add a stable unique ID and release date to `announcement-registry.ts`.
2. Explain what changed and why it matters in the summary/details; reference only existing feature IDs and an existing tour ID.
3. Add/adjust the registry validation test if a new schema field is introduced.
4. Do not hardcode the announcement into the launcher or app panels; render it through the What's New list.
5. Keep previous records so users can revisit them. A versioned ID change intentionally represents a new announcement.

## Current boundary

This is a local static changelog registry. There is no remote release feed, administrator interface, or cross-device announcement synchronization. A build/release author maintains the registry; there is no app-specific content management service.
