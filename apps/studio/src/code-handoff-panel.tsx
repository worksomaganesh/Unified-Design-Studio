import { useMemo, useState } from "react";
import { buildCodeExportFiles, collectImageSources, inspectExportSupport, type ExportFinding } from "@uds/renderer";
import type { DesignDocument } from "@uds/design-core";
import "./code-handoff.css";

type Asset = { id: string; name: string; mimeType: string };
type Props = { projectId: string; document: DesignDocument; assets: Asset[]; onSave: () => Promise<boolean>; onClose: () => void };

export function CodeHandoffPanel({ projectId, document, assets, onSave, onClose }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gitReady, setGitReady] = useState(false);
  const [error, setError] = useState("");
  const origin = window.location.origin;
  const allowedImages = useMemo(() => new Map(assets.filter(asset => ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(asset.mimeType)).map(asset => [`/api/projects/${projectId}/assets/${asset.id}/content`, asset])), [assets, projectId]);
  const exportOptions = useMemo(() => ({
    htmlAssetPaths: Object.fromEntries([...allowedImages.keys()].map(path => [path, `${origin}${path}`])),
    reactAssetPaths: Object.fromEntries([...allowedImages.entries()].map(([path, asset]) => [path, `/assets/${asset.id}${({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" } as Record<string, string>)[asset.mimeType] ?? ""}`])),
  }), [allowedImages, assets, origin, projectId]);
  const files = useMemo(() => buildCodeExportFiles(document, exportOptions), [document, exportOptions]);
  const findings = useMemo(() => {
    const result: ExportFinding[] = [...inspectExportSupport(document)];
    const missing = collectImageSources(document).filter(source => /^\/api\/projects\//.test(source) && !allowedImages.has(source)).length;
    if (missing) result.push({ severity: "warning", code: "missing-project-asset", message: `${missing} image source(s) no longer match an image in this project and will be omitted.` });
    return result;
  }, [allowedImages, document]);
  const previewHtml = useMemo(() => {
    const csp = `default-src 'none'; img-src data: ${origin}; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'`;
    return files["index.html"].replace('<link rel="stylesheet" href="styles.css">', `<meta http-equiv="Content-Security-Policy" content="${csp}"><style>${files["styles.css"]}</style>`);
  }, [files, origin]);

  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (!await onSave()) throw new Error("The latest canvas changes could not be saved. Save them, then try the handoff again.");
      const response = await fetch(`/api/projects/${projectId}/code-export${gitReady ? "?gitReady=true" : ""}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Export failed (${response.status}).`);
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `uds-code-handoff-${projectId.slice(0, 8)}${gitReady ? "-git-ready" : ""}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <div className="handoff-scrim" onMouseDown={event => { if (event.target === event.currentTarget && !previewOpen) onClose(); }}>
      <aside className="handoff-panel" role="dialog" aria-modal="true" aria-label="Code handoff">
        <header className="handoff-header"><div><span className="handoff-eyebrow">PHASE 7 · DEVELOPER HANDOFF</span><h2>Code handoff</h2><p>Portable desktop code, tokens, and referenced images.</p></div><button aria-label="Close code handoff" onClick={onClose}>×</button></header>
        <div className="handoff-content">
          <section className="handoff-card"><h3>Included in the bundle</h3><ul><li>React + Vite project</li><li>Static HTML and CSS</li><li>Design system tokens and modes</li><li>{[...allowedImages.keys()].filter(source => collectImageSources(document).includes(source)).length} project image asset(s)</li><li>Support report and setup notes</li></ul></section>
          <section className="handoff-card"><div className="handoff-section-title"><h3>Export notes</h3><span>{findings.filter(item => item.severity === "warning").length} review</span></div>
            {findings.map((finding, index) => <div className={`handoff-finding ${finding.severity}`} key={`${finding.code}-${index}`}><b>{finding.severity === "warning" ? "Review" : "Ready"}</b><p>{finding.message}</p></div>)}
          </section>
          <section className="handoff-card handoff-preview-note"><h3>Static preview</h3><p>Preview the current canvas in an isolated frame. Scripts, network connections, forms, and external images are blocked.</p><button className="handoff-secondary" onClick={() => setPreviewOpen(true)}>Open restricted preview</button></section>
          <section className="handoff-card handoff-git-note"><label><input type="checkbox" checked={gitReady} onChange={event => setGitReady(event.target.checked)}/><span><b>Prepare for local Git</b><small>Include a safe <code>.gitignore</code> and local setup steps with the bundle.</small></span></label><p>No repository is initialized. The bundle does not connect to GitHub or push anything.</p></section>
          {error && <p className="handoff-error" role="alert">{error}</p>}
        </div>
        <footer className="handoff-footer"><button className="handoff-secondary" onClick={onClose}>Close</button><button className="handoff-primary" onClick={() => void download()} disabled={busy}>{busy ? "Preparing bundle…" : gitReady ? "Download Git-ready bundle" : "Download code bundle"}</button></footer>
      </aside>
    </div>
    {previewOpen && <div className="handoff-preview-scrim"><section className="handoff-preview-dialog" role="dialog" aria-modal="true" aria-label="Restricted code preview"><header><div><b>Static export preview</b><small>Current canvas · isolated frame · no scripts</small></div><button onClick={() => setPreviewOpen(false)}>Close preview</button></header><iframe title="Static code export preview" sandbox="" srcDoc={previewHtml}/></section></div>}
  </>;
}
