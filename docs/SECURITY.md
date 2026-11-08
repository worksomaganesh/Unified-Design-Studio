# Security model

**Status:** Requirements and design constraints for the proposed local-first MVP. This document is not a security audit or a claim that these controls are implemented.

## Trust boundaries

1. **Trusted editor shell:** project navigation, tools, panels and user interaction.
2. **Design document:** structured data; validate it on load, update and migration.
3. **Preview runtime:** generated/imported HTML and JavaScript are untrusted and must not execute with the editor's privileges.
4. **Local service and filesystem:** project and asset operations require narrow paths and explicit intent.
5. **AI providers:** provider credentials and request payloads must be handled separately from design documents.
6. **MCP / agent operations:** expose scoped commands; destructive, export and network operations need appropriate confirmation.
7. **Research browser:** REA/CDP can inspect the dedicated browser profile and must remain isolated from normal browsing.

## Required controls

- Render generated/imported content in a sandboxed iframe with restrictive Content Security Policy; use a separate process or stronger isolation for code execution when needed.
- Use a narrow, validated message bridge between the preview iframe and editor. Validate origin, source and referenced node IDs.
- Do not expose arbitrary `eval`, unrestricted parent-window access or broad filesystem operations.
- Validate documents, AI patches, node IDs, operation types and revision numbers before mutation.
- Apply patch operations transactionally where practical; retain before/after revisions for undo and audit.
- Require explicit user action for external URL imports. Any server-side URL fetch must have an SSRF-safe policy.
- Keep provider API keys out of the browser, design JSON, logs, screenshots and Git history. Use OS-appropriate secure storage or an encrypted local secret store.
- Minimize sensitive content in logs and research evidence. Never collect cookies, tokens, passwords or private project content as research artifacts.
- Scope MCP operations to the active project and require confirmation for destructive, export or network-sensitive actions.
- Keep REA out of the production runtime. For research, use a dedicated browser profile, exact-origin allowlisting and CDP bound only to `127.0.0.1`.

## Research-specific precautions

REA is a powerful browser-observation tool, not a sandbox. Do not disable endpoint protection or create exclusions to force installation. If security software flags a package, preserve the detection details and investigate before proceeding. Do not expose the CDP port to a LAN or the public internet.

## Security validation before release

- Test preview-origin isolation and iframe message validation.
- Test path traversal and asset import boundaries in the local service.
- Test malformed documents and malicious AI patch payloads.
- Verify no provider secrets appear in browser storage, persisted design files, screenshots or logs.
- Review dependency licenses, security advisories and notices before reusing any open-source code.
