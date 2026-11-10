# Security model and requirements

**Status:** Security requirements and implementation notes. This document is not a security audit and does not claim all controls are implemented.

## Trust boundaries

1. Trusted studio shell and editor state.
2. Canonical structured design document.
3. Generated/imported HTML and assets.
4. Preview runtime and generated application execution.
5. Local service and filesystem.
6. AI provider credentials and request payloads.
7. MCP/agent clients.
8. Research browser and REA/CDP session.

## Required controls

- Validate document schemas, migrations, node IDs, token references and AI patch operations.
- Treat generated/imported markup and assets as untrusted.
- Verify uploaded raster signatures; serve reference-only SVG/PDF files as attachments with `nosniff` instead of rendering them in the Studio origin.
- Render preview in a sandboxed iframe with restrictive CSP and a narrow message bridge validating source and interaction references.
- Arbitrary generated server-side code requires process/container isolation and resource/network limits; an iframe is not sufficient.
- Local file operations must be scoped to an explicit project root; prevent path traversal and symlink escapes.
- External URL imports require user action, origin policy and SSRF protection for server-side fetches.
- Keep provider API keys in the local service/OS secure store; never in browser bundles, persistent browser storage, design JSON, screenshots, logs or Git. A key is briefly present in the password field and local-service request body during setup.
- MCP operations are scoped to the active project and use the same validated command service as UI operations.
- Phase 9 review threads are scoped to an active local project and validated against saved revisions; their `You` author label is not an authenticated identity.
- Loopback binding is an exposure boundary, not user authentication. Do not expose project review routes to a LAN or remote client until identity, membership, authorization, and request protections are implemented and reviewed.
- Destructive operations, external network actions and repository writes require explicit confirmation.
- Minimize research evidence; never capture passwords, cookies, tokens or private project contents.
- Review every third-party package, transitive dependency, license and security advisory before reuse.

## Current AI boundary notes

- Provider keys are handled by the local service. On Windows, the service stores keys in Windows Credential Manager; on other platforms it reads provider-specific environment variables. Keys are not returned to the browser after save.
- Credential write/delete routes accept only HTTP loopback origins used by the local Studio/API and reject cross-site Fetch Metadata.
- Provider requests use HTTPS and the selected provider's authentication header. Only explicitly selected project images are loaded for image input. The API validates project ownership and asset paths and caps selection at three images, 4 MB each, and 8 MB total.
- Planning and generation send the brief and a compact document summary. Selection revision sends a compact document summary plus selected layer summaries. The full document is not sent.
- AI output is untrusted: Zod validates generated plans, directions, and patch operations; patches are restricted to selected node IDs and compatible node types. Provider calls do not write documents or execute model-generated code.
- These controls have not received a full security audit. The Windows credential helper and live provider request still need runtime verification.
- Prototype preview uses an opaque-origin iframe sandbox without same-origin permission, blocks outbound connections, limits image sources to loopback, and accepts messages only from its own iframe window after matching stored interaction definitions.

## REA-specific precautions

REA is a browser-observation tool, not a sandbox. CDP access can control and inspect the connected browser profile. Use a separate research profile, bind CDP only to 127.0.0.1, allowlist exact target origins, and close the browser after research. Do not expose the CDP port to a LAN or public internet.

If endpoint protection flags an REA installer/package, do not disable protection or add exclusions. Record the exact detection name, file hash, source URL, signature/checksum and version; verify against the official release and consult the security vendor before running it.

## Release security tests

- Preview origin/CSP and message-bridge tests.
- Path traversal, symlink and asset-import boundary tests.
- Malformed document and malicious AI patch tests.
- Secret-leak scans across browser storage, files, logs and screenshots.
- Generated-code resource/network isolation tests.
- Dependency/license inventory and vulnerability scan.
