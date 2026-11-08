# REA setup on Windows 11 + Antigravity

**Purpose:** Enable controlled, passive inspection of the nine research targets using REA from Antigravity on the HP Victus.  
**Important:** These steps are prepared for local execution. REA has not been installed or connected in this chat because the laptop's shell and Antigravity configuration are not directly accessible here.

## Safety rules first

- Do not disable McAfee, add an exclusion, or run a file McAfee has quarantined just to complete this setup.
- Use the official `morluto/rea` repository and the `rea-agents` npm package linked from it. Do not use copied installers or unofficial mirrors.
- REA is not a sandbox. Website/browser inspection is powerful because CDP can see the selected browser profile. Use a dedicated profile with no unrelated accounts or tabs.
- Bind the CDP debugging endpoint only to loopback (`127.0.0.1`). Never expose it on Wi-Fi/LAN.
- Approve only the exact product origins being researched. No wildcard origins.
- Do not capture secrets, passwords, tokens, private project content, or payment/personal data.

Official references: [REA installation](https://github.com/morluto/rea/blob/main/docs/installation.md) · [Browser observation guide](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) · [REA security policy](https://github.com/morluto/rea/blob/main/SECURITY.md)

## Step 1 — Check Node and npm

Open PowerShell:

```powershell
node --version
npm --version
npm view rea-agents version
```

REA documents support for Node.js 22.x >=22.23.4, 24.x >=24.22.1, or 26.12.1+. Node 23/25 and older unsupported releases should not be used. Do not upgrade blindly; first inspect the installed version and other projects that may depend on it.

If Node is missing or outside the supported range, obtain a supported release from the official Node.js website or a trusted package manager, then verify `node --version` and `npm --version` again.

## Step 2 — Preview the Antigravity setup plan

Run the read-only setup preview from a trusted working directory, not from an untrusted project folder:

```powershell
npx -y rea-agents@latest setup --client antigravity --dry-run
```

Review the output. It should identify only the Antigravity configuration and REA skill destinations you expect. A dry run should not apply changes. If the plan mentions an unrelated client, an unexpected path, or an external analysis engine you did not request, stop and inspect it.

## Step 3 — Install/register REA

If the preview is acceptable:

```powershell
npx -y rea-agents@latest setup --client antigravity
```

Review and explicitly approve the exact setup transaction. Restart Antigravity after successful setup. Do not approve optional Hopper installation for this website-research task; browser observation does not require a native decompiler. Do not approve any extra setup action you do not understand.

If McAfee flags the npm package or any dependency, stop, retain the detection name and file path, and investigate the alert. Do not disable protection or create an exclusion. REA's official installation guidance also recommends checking security-software protection history before attributing a missing package file to the application itself.

## Step 4 — Configure browser observation as fail-closed

REA's browser observer is disabled by default. Configure the REA process with:

```text
REA_BROWSER_OBSERVE_ENABLED=true
REA_BROWSER_CDP_ENDPOINTS_JSON=["http://127.0.0.1:9222"]
REA_BROWSER_ALLOWED_ORIGINS_JSON=["https://EXACT-ORIGIN-FROM-THE-ADDRESS-BAR"]
```

The values above are examples of the required shape, not a ready-made allowlist. Replace the example with the exact origin currently displayed in the browser. An origin contains scheme, host and optional port only—no path, query, credentials or wildcard.

For example, if the actual product editor is at `https://www.example.com/editor`, the origin is `https://www.example.com`.

Set these variables in the environment inherited by Antigravity/REA, or in the REA MCP server's environment configuration if Antigravity exposes that setting. If using Windows user environment variables, PowerShell can set them as follows (replace the origin with a verified one):

```powershell
[Environment]::SetEnvironmentVariable("REA_BROWSER_OBSERVE_ENABLED", "true", "User")
[Environment]::SetEnvironmentVariable("REA_BROWSER_CDP_ENDPOINTS_JSON", '["http://127.0.0.1:9222"]', "User")
[Environment]::SetEnvironmentVariable("REA_BROWSER_ALLOWED_ORIGINS_JSON", '["https://EXACT-ORIGIN-FROM-THE-ADDRESS-BAR"]', "User")
```

Close and relaunch Antigravity after changing user-level environment variables. For a different target origin, deliberately update the allowlist and restart the REA process as required. Keep the list as narrow as practical.

## Step 5 — Launch a dedicated Chrome/Edge profile

From the project directory, use the helper script:

```powershell
.\scripts\start-rea-browser.ps1 -Origin "https://EXACT-ORIGIN-FROM-THE-ADDRESS-BAR"
```

The helper creates a separate browser profile under `%LOCALAPPDATA%\UnifiedDesignStudio\REA-ChromeProfile`, uses CDP port 9222 on loopback, and opens the target origin. It does not reuse the user's normal browser profile.

If Chrome/Edge is already using port 9222, close only the dedicated research browser and restart it. Do not expose the port publicly. Sign in manually only if the product research requires it and you are authorized to access that account.

## Step 6 — Verify the connection

In Antigravity, ask the connected REA agent to:

1. Run `list_browser_targets` against `http://127.0.0.1:9222`.
2. Confirm that the target URL's origin matches the exact approved origin.
3. Run `inspect_web_page` with the returned target ID and conservative/default capture options.
4. Save the evidence ID and limitations in the appropriate product profile.

Do not request storage values, cookies, credentials, arbitrary script execution or broad console text. Prefer DOM structure, accessibility metadata without sensitive text, resource metadata and a visible screenshot. Add optional capture fields only when a specific question requires them.

## REA browser observation workflow

For each product:

1. Load exactly one target application page.
2. Call `list_browser_targets`.
3. Inspect the page once to establish the initial state.
4. Start `observe_web_session` for a bounded window.
5. Manually perform one workflow (e.g. create frame, edit text, switch token mode) while the observation window is active.
6. Capture the screenshot and inspect the resulting state.
7. Use `analyze_web_bundle` only where the question is specifically about routes, package fingerprints or static bundle relationships, and only for approved page artifacts.
8. Record the evidence ID, exact origin, actions, observed result and limitations.

REA's browser inspection does not perform generic clicks or operate the website for you. It passively records what the researcher does in the dedicated browser.
