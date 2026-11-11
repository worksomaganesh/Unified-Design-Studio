# Phase 9 — Collaboration and AI-agent ecosystem

**Progress:** 35% complete; 65% remains. This is a local collaboration and recovery foundation; it does not provide multi-user sharing or execute specialist agents.

## Implemented foundation

- Review threads are stored separately from design-document snapshots and anchored to a project, document, saved revision, page, and optional layer.
- Each thread supports replies, resolve, and reopen. Anchors are validated against the referenced saved snapshot before a thread is created.
- The editor's Review view can create page/layer comments; the History view compares two saved revisions and summarizes page/layer changes plus design-system and prototype change flags.
- Restoring a revision creates a new immutable revision. The comparison endpoint returns a bounded list of changed layers and does not expose saved document snapshots.
- Review APIs are project-scoped and the local service binds to `127.0.0.1`. The current author label is `You`; it is not a verified identity.
- Every state-changing HTTP API request (`POST`, `PUT`, `PATCH`, `DELETE`) requires an allow-listed HTTP loopback `Origin`; if Fetch Metadata is present, only `same-origin`, `same-site`, or `none` is accepted. This reduces browser-based cross-site request risk but is not authentication or project authorization.
- A stale-save conflict keeps the local draft open and identifies the newer saved revision. Users can keep editing, download a JSON backup, or explicitly discard the draft and load the latest saved revision; reload validates the document and resets the stale undo/redo history. There is no automatic merge.
- Automated coverage verifies review migration repeatability, storage constraints and cascades, stale-save transaction protection, and local-origin enforcement for all state-changing HTTP methods.

## Current boundaries

UDS remains a local, single-user workspace. These review routes are not a sharing or access-control system and must not be exposed on a network. Threads do not sync between devices, and there are no invitations, participant identities, roles, or presence indicators.

The Phase 9 API does not execute agents. Agent task creation and results must wait for typed project/layer scopes, bounded read capabilities, revision-checked proposed changes, explicit user approval, and an auditable task status model. Agents must not receive arbitrary filesystem, shell, or unrestricted network access.

## Remaining milestones

1. Complete desktop review of the migration, review panel, revision comparison, and conflict-recovery dialog on existing projects. The migration and stale-save transaction behavior now have unit coverage.
2. Design identity, project membership, role checks, invitation acceptance, and safe synchronization before enabling shared access.
3. Add specialist-agent task definitions with explicit input scope, allowed operations, cancellation, status, and review-required results.
4. Require user review and revision checks before an agent result can change a design document; record the accepted result in normal immutable revision history.
5. Extend recovery to offline and future shared-project synchronization, then complete desktop, accessibility, and security review before closing the Phase 9 exit gate. Current conflict recovery is explicit backup/reload; merge is not implemented.

See the [Phase 9 development backlog](DEVELOPMENT_BACKLOG.md#phase-9--collaboration-and-ai-agent-ecosystem) and [API contracts](API_CONTRACTS.md#12-phase-9-local-review) for the implementation boundary.
