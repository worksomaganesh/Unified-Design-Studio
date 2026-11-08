# Security model and requirements

**Status:** Design requirements only. This document is not a security audit and does not claim controls are implemented.

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
- Render preview in sandboxed iframe with restrictive CSP, separate origin where possible, and a narrow message bridge validating source, origin and node references.
- Arbitrary generated server-side code requires process/container isolation and resource/network limits; an iframe is not sufficient.
- Local file operations must be scoped to an explicit project root; prevent path traversal and symlink escapes.
- External URL imports require user action, origin policy and SSRF protection for server-side fetches.
- Keep provider API keys in the local service/OS secure store; never in browser bundles, design JSON, screenshots, logs or Git.
- MCP operations are scoped to the active project and use the same validated command service as UI operations.
- Destructive operations, external network actions and repository writes require explicit confirmation.
- Minimize research evidence; never capture passwords, cookies, tokens or private project contents.
- Review every third-party package, transitive dependency, license and security advisory before reuse.

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
