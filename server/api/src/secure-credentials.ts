import { spawn } from "node:child_process";
import type { AIProviderId } from "@uds/ai-engine";

export type CredentialId = AIProviderId | "figma";

const environmentKeys: Record<CredentialId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  figma: "FIGMA_ACCESS_TOKEN",
};

const powershellCredentialScript = String.raw`
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Runtime.InteropServices;
public static class UdsCredentialApi {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags; public UInt32 Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob; public UInt32 Persist; public UInt32 AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);
  [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);
  [DllImport("advapi32.dll", SetLastError=true)] public static extern void CredFree(IntPtr credential);
}
'@
try {
  Add-Type -TypeDefinition $source
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $target = 'UnifiedDesignStudio/' + $request.provider
  if ($request.operation -eq 'store') {
    $bytes = [Text.Encoding]::Unicode.GetBytes([string]$request.secret)
    $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pointer, $bytes.Length)
    $credential = New-Object UdsCredentialApi+CREDENTIAL
    $credential.Type = 1
    $credential.TargetName = $target
    $credential.CredentialBlobSize = [uint32]$bytes.Length
    $credential.CredentialBlob = $pointer
    $credential.Persist = 2
    $credential.UserName = 'Unified Design Studio'
    $ok = [UdsCredentialApi]::CredWrite([ref]$credential, 0)
    $zero = New-Object byte[] $bytes.Length
    [Runtime.InteropServices.Marshal]::Copy($zero, 0, $pointer, $bytes.Length)
    [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer)
    if (-not $ok) { throw 'write failed' }
    @{ ok = $true } | ConvertTo-Json -Compress
  } elseif ($request.operation -eq 'delete') {
    $ok = [UdsCredentialApi]::CredDelete($target, 1, 0)
    @{ ok = $true; found = [bool]$ok } | ConvertTo-Json -Compress
  } else {
    $pointer = [IntPtr]::Zero
    $ok = [UdsCredentialApi]::CredRead($target, 1, 0, [ref]$pointer)
    if (-not $ok) { @{ ok = $true; found = $false } | ConvertTo-Json -Compress }
    else {
      try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($pointer, [type][UdsCredentialApi+CREDENTIAL])
        if ($request.operation -eq 'has') { @{ ok = $true; found = $true } | ConvertTo-Json -Compress }
        else {
          $bytes = New-Object byte[] ([int]$credential.CredentialBlobSize)
          [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
          $secret = [Text.Encoding]::Unicode.GetString($bytes).TrimEnd([char]0)
          @{ ok = $true; found = $true; secret = $secret } | ConvertTo-Json -Compress
        }
      } finally { [UdsCredentialApi]::CredFree($pointer) }
    }
  }
} catch {
  [Console]::Error.WriteLine('Windows credential vault operation failed.')
  exit 2
}
`;

function windowsVault(operation: "store" | "read" | "has" | "delete", provider: CredentialId, secret?: string): Promise<{ found: boolean; secret?: string }> {
  if (process.platform !== "win32") return Promise.reject(new Error("Windows Credential Manager is unavailable on this platform."));
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", powershellCredentialScript], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.on("error", () => reject(new Error("Could not start the Windows credential helper.")));
    child.on("close", code => {
      if (code !== 0) { reject(new Error(stderr.trim() || "Windows credential vault operation failed.")); return; }
      try {
        const result = JSON.parse(stdout.trim()) as { ok: boolean; found?: boolean; secret?: string };
        if (!result.ok) throw new Error("Windows credential vault operation failed.");
        resolve({ found: Boolean(result.found), ...(result.secret ? { secret: result.secret } : {}) });
      } catch { reject(new Error("Windows credential vault returned an invalid result.")); }
    });
    child.stdin.end(JSON.stringify({ operation, provider, ...(secret ? { secret } : {}) }));
  });
}

export async function storeProviderCredential(provider: CredentialId, secret: string): Promise<void> {
  if (process.platform === "win32") { await windowsVault("store", provider, secret); return; }
  throw new Error(`Secure key entry is available on Windows. Configure ${environmentKeys[provider]} in the local service environment on this platform.`);
}

export async function deleteProviderCredential(provider: CredentialId): Promise<void> {
  if (process.platform === "win32") { await windowsVault("delete", provider); return; }
  throw new Error(`Remove ${environmentKeys[provider]} from the local service environment on this platform.`);
}

export async function getProviderCredential(provider: CredentialId): Promise<string | undefined> {
  if (process.platform === "win32") {
    try {
      const stored = await windowsVault("read", provider);
      if (stored.found && stored.secret) return stored.secret;
    } catch { /* Environment keys remain a supported local fallback. */ }
  }
  return process.env[environmentKeys[provider]] || undefined;
}

export async function hasProviderCredential(provider: CredentialId): Promise<boolean> {
  if (process.platform === "win32") {
    try { if ((await windowsVault("has", provider)).found) return true; }
    catch { /* Check the environment fallback. */ }
  }
  return Boolean(process.env[environmentKeys[provider]]);
}
