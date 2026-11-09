# REA setup on Windows 11 + Antigravity

**Purpose:** Controlled, passive browser research on the nine target products.  
**Status:** Instructions prepared; not executed on the user's laptop.

## Safety first

- Do not disable McAfee, add an exclusion or run a quarantined file to force installation.
- Use only the official [morluto/rea repository](https://github.com/morluto/rea) and the package/release links it publishes.
- REA is not a sandbox. CDP can inspect and control the connected browser profile.
- Use a dedicated browser profile with no unrelated tabs or accounts.
- Bind CDP only to `127.0.0.1`; never expose it to a LAN or public network.
- Allowlist exact origins only. Do not use wildcards.
- Never capture credentials, cookies, tokens, passwords or private project data.

Official documentation:
- [Installation](https://github.com/morluto/rea/blob/main/docs/getting-started/installation.md)
- [Browser observation](https://github.com/morluto/rea/blob/main/docs/guides/web/browser-observation.md)
- [Security policy](https://github.com/morluto/rea/blob/main/SECURITY.md)

## 1. Check the runtime

In PowerShell:

```powershell
node --version
npm --version
npm view rea-agents version
```

Use a Node.js release explicitly supported by the current REA installation guide. Do not infer support from another project's Node version. If Node is missing/outdated, install from the official Node.js source or a trusted package manager, then verify again.

## 2. Preview Antigravity setup

From a trusted working directory:

```powershell
npx -y rea-agents@latest setup --client antigravity --dry-run
```

Review every proposed path and change. Stop if the dry run proposes unexpected clients, files, permissions or optional tools.

## 3. Install/register

Only if the preview is understood and acceptable:

```powershell
npx -y rea-agents@latest setup --client antigravity
```

Review and approve the intended setup. Restart Antigravity and verify that the expected REA MCP tools appear. Do not install optional Hopper/decompiler components for ordinary browser observation unless a separately justified task requires them.

If McAfee flags the package or a dependency, stop. Record the exact detection name, path, package version, source, file hash and signature/checksum where available. Compare with the official release and consult McAfee/vendor guidance. Do not disable protection or create an exclusion.

## 4. Configure browser observation

Use the exact configuration documented by the installed REA version. The browser-observation guide documents the observer's enablement, CDP endpoint and origin-allowlist settings. Do not copy environment-variable names from this project document without checking the current upstream guide and the installed version's configuration schema.

Required security posture:
- Observation is explicitly enabled.
- CDP endpoint is loopback-only, e.g. `http://127.0.0.1:9222`.
- Allowed origins are exact scheme + host (+ port where applicable), not URL paths and not wildcards.
- No unrelated browser profile is attached.

## 5. Launch a dedicated Chrome profile

Replace the origin below with the exact product origin copied from the address bar.

```powershell
$Origin = "https://EXACT-ORIGIN-FROM-THE-ADDRESS-BAR"
$ProfilePath = Join-Path $env:LOCALAPPDATA "UnifiedDesignStudio\REA-ChromeProfile"

$ChromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$ChromePath = $ChromeCandidates |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

if (-not $ChromePath) {
    throw "Google Chrome was not found. Install Chrome or adapt this for Edge."
}

New-Item -ItemType Directory -Force -Path $ProfilePath | Out-Null

Start-Process -FilePath $ChromePath -ArgumentList @(
    "--user-data-dir=$ProfilePath",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    "--no-first-run",
    $Origin
)
```

This creates a separate profile and binds the debugging port to loopback. If port 9222 is already in use, close the dedicated research browser and resolve the conflict; do not expose the port externally.

## 6. Verify in Antigravity

1. Run REA's `list_browser_targets` against the configured CDP endpoint.
2. Confirm the target's origin matches the explicit allowlist.
3. Run `inspect_web_page` with the returned target ID.
4. Confirm that the page title, structure and screenshot correspond to the intended target.
5. Record the target, version, actions and evidence ID in its research dossier.

Do not request cookies, storage values, credentials, broad console output or arbitrary script execution.

## 7. Repeatable research workflow

For each product:
1. Open one authorized target page in the dedicated browser.
2. List browser targets and inspect the initial page.
3. Start a bounded observation session.
4. Manually perform one defined workflow (e.g. create a frame, edit text, bind a token).
5. Capture the resulting screenshot/state.
6. Use bundle analysis only for a specific question about publicly delivered page resources or framework fingerprints.
7. Record observed facts separately from inferred implementation details.
8. Note account/plan restrictions and unavailable workflows rather than guessing.

REA's browser observer is passive: the researcher manually operates the website while REA observes the selected browser session.
