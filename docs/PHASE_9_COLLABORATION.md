# Phase 9 — Collaboration and AI-agent ecosystem

**Progress:** 25% complete; 75% remains. This is the first local review foundation; it does not provide multi-user sharing or execute specialist agents.

## Implemented foundation

- Review threads are stored separately from design-document snapshots and anchored to a project, document, saved revision, page, and optional layer.
- Each thread supports replies, resolve, and reopen. Anchors are validated against the referenced saved snapshot before a thread is created.
- The editor's Review view can create page/layer comments; the History view compares two saved revisions and summarizes page/layer changes plus design-system and prototype change flags.
- Restoring a revision creates a new immutable revision. The comparison endpoint returns a bounded list of changed layers and does not expose saved document snapshots.
- Review APIs are project-scoped and the local service binds to `127.0.0.1`. The current author label is `You`; it is not a verified identity.

## Current boundaries

UDS remains a local, single-user workspace. These review routes are not a sharing or access-control system and must not be exposed on a network. Threads do not sync between devices, and there are no invitations, participant identities, roles, or presence indicators.

The Phase 9 API does not execute agents. Agent task creation and results must wait for typed project/layer scopes, bounded read capabilities, revision-checked proposed changes, explicit user approval, and an auditable task status model. Agents must not receive arbitrary filesystem, shell, or unrestricted network access.

## Remaining milestones

1. Verify the migration and review interactions against existing projects on the supported desktop browser sizes.
2. Design identity, project membership, role checks, invitation acceptance, and safe synchronization before enabling shared access.
3. Add specialist-agent task definitions with explicit input scope, allowed operations, cancellation, status, and review-required results.
4. Require user review and revision checks before an agent result can change a design document; record the accepted result in normal immutable revision history.
5. Revisit local-first/offline behavior, conflict recovery, accessibility, and security before closing the Phase 9 exit gate.

See the [Phase 9 development backlog](DEVELOPMENT_BACKLOG.md#phase-9--collaboration-and-ai-agent-ecosystem) and [API contracts](API_CONTRACTS.md#12-phase-9-local-review) for the implementation boundary.
