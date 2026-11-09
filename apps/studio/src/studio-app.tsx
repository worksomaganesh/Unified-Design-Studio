import { useEffect, useState } from "react";

type Project = { id: string; name: string; updatedAt: string };
type OpenProject = Project & { document: { documentId: string; revision: number; pages: { id: string; name: string }[] } | null };
type Asset = { id: string; name: string; mimeType: string; size: number };
type Settings = { theme: "system" | "light" | "dark"; recentProjectLimit: number; selectedProvider: string };
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? `Request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json();
};

export function StudioApp() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [activeDocument, setActiveDocument] = useState<OpenProject["document"]>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<Settings>({ theme: "system", recentProjectLimit: 12, selectedProvider: "none" });
  const [error, setError] = useState("");
  const refresh = () => api<Project[]>("/projects").then(setProjects).catch(e => setError(e.message));
  async function openProject(project: Project) {
    try { const result = await api<OpenProject>(`/projects/${project.id}`); setActive(result); setActiveDocument(result.document); setAssets(await api<Asset[]>(`/projects/${project.id}/assets`)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => {
    let cancelled = false;
    const loadWorkspace = async () => {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try { const [list, prefs] = await Promise.all([api<Project[]>("/projects"), api<Settings>("/settings")]); if (!cancelled) { setProjects(list); setWorkspaceSettings(prefs); setError(""); } return; }
        catch (e) { if (attempt === 7 && !cancelled) setError(`Local service unavailable: ${(e as Error).message}`); await new Promise(resolve => setTimeout(resolve, 500)); }
      }
    };
    void loadWorkspace(); return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = workspaceSettings.theme === "system" ? (prefersDark ? "dark" : "light") : workspaceSettings.theme;
  }, [workspaceSettings.theme]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") { event.preventDefault(); setCreating(true); }
      if (event.key === "Escape") { setCreating(false); setSettings(false); setCommandOpen(false); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try { const p = await api<Project>("/projects", { method: "POST", body: JSON.stringify({ name }) }); setProjects(list => [p, ...list]); setCreating(false); setName(""); await openProject(p); }
    catch (e) { setError((e as Error).message); }
  }
  async function renameProject() {
    if (!active) return;
    const nextName = window.prompt("Project name", active.name)?.trim();
    if (!nextName || nextName === active.name) return;
    try { const updated = await api<Project>(`/projects/${active.id}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) }); setActive(updated); setProjects(list => list.map(p => p.id === updated.id ? updated : p)); setError(""); }
    catch (e) { setError((e as Error).message); }
  }
  async function archiveProject() {
    if (!active || !window.confirm(`Archive “${active.name}”? It will disappear from Recent projects.`)) return;
    try { await api<void>(`/projects/${active.id}/archive`, { method: "POST" }); setProjects(list => list.filter(p => p.id !== active.id)); setActive(null); setActiveDocument(null); setAssets([]); }
    catch (e) { setError((e as Error).message); }
  }
  async function uploadAsset(file?: File) {
    if (!file || !active) return;
    const data = new FormData(); data.append("file", file);
    const response = await fetch(`/api/projects/${active.id}/assets`, { method: "POST", body: data });
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? "Upload failed."); return; }
    setAssets(await api<Asset[]>(`/projects/${active.id}/assets`));
  }
  async function deleteAsset(asset: Asset) {
    if (!active || !window.confirm(`Remove ${asset.name}?`)) return;
    try { await api<void>(`/projects/${active.id}/assets/${asset.id}`, { method: "DELETE" }); setAssets(list => list.filter(item => item.id !== asset.id)); }
    catch (e) { setError((e as Error).message); }
  }
  async function saveSettings() {
    try { const saved = await api<Settings>("/settings", { method: "PUT", body: JSON.stringify(workspaceSettings) }); setWorkspaceSettings(saved); setSettings(false); }
    catch (e) { setError((e as Error).message); }
  }
  return <div className="shell">
    <header className="topbar"><a className="brand" href="#home" onClick={() => { setActive(null); setActiveDocument(null); }}><span className="brand-mark">U</span><span>Unified <b>Design Studio</b></span></a><div className="top-actions"><button className="quiet" onClick={() => setCommandOpen(true)}>Commands <kbd>Ctrl K</kbd></button><button className="quiet" onClick={() => setSettings(true)}>Settings</button><button className="primary" onClick={() => setCreating(true)}><span>＋</span> New project</button><button className="avatar" aria-label="Account">S</button></div></header>
    <div className="workspace">
      <aside className="sidebar"><div className="side-label">WORKSPACE</div><button className={!active ? "nav-item selected" : "nav-item"} onClick={() => { setActive(null); setActiveDocument(null); }}><span>▦</span> All projects</button><button className="nav-item" onClick={() => setCreating(true)}><span>＋</span> Create project</button><div className="side-label recent-label">RECENT</div>{projects.slice(0, 5).map(p => <button key={p.id} className={active?.id === p.id ? "nav-item selected" : "nav-item"} onClick={() => openProject(p)}><span className="project-dot">◈</span>{p.name}</button>)}<div className="sidebar-bottom"><div className="help-icon">?</div><div><b>Need a hand?</b><small>Explore the workspace guide</small></div></div></aside>
      <main className="main-content">
        {active ? <><div className="crumb"><button onClick={() => { setActive(null); setActiveDocument(null); }}>Projects</button><span>/</span><b>{active.name}</b></div><div className="project-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{active.name}</h1><p>Start with a brief, reference, or a blank canvas.</p></div><div className="project-actions"><button className="quiet" onClick={renameProject}>Rename</button><button className="quiet danger" onClick={archiveProject}>Archive</button><button className="primary" onClick={() => setError("Canvas editing is the next Phase 3 milestone.")}>Open editor <span>↗</span></button></div></div><div className="project-body"><section className="start-card"><span className="spark">✳</span><h2>Bring an idea to life</h2><p>Your project workspace is ready. Add a brief, reference, or create your first design.</p><button className="primary" onClick={() => setError("The canvas editor is planned for Phase 3.")}>Create a design <span>→</span></button><h3 className="asset-heading">Project assets</h3><label className="asset-button">＋ Add image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { void uploadAsset(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label>{assets.length > 0 && <div className="asset-list">{assets.map(asset => <div key={asset.id}><span>{asset.name}</span><button aria-label={`Remove ${asset.name}`} onClick={() => deleteAsset(asset)}>×</button></div>)}</div>}</section><section className="side-panel"><h3>Project details</h3><div className="detail-row"><span>Document</span><b>{activeDocument ? `${activeDocument.pages.length} page · rev ${activeDocument.revision}` : "No document"}</b></div><div className="detail-row"><span>Storage</span><b>SQLite · local files</b></div><div className="detail-row"><span>Assets</span><b>{assets.length} files</b></div></section></div>{error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}</> : <><div className="welcome"><div className="eyebrow">YOUR CREATIVE WORKSPACE</div><h1>Good ideas start <em>somewhere.</em></h1><p>Bring your product thinking, design exploration, and frontend handoff together.</p><button className="primary large" onClick={() => setCreating(true)}>Create your first project <span>→</span></button><div className="shortcut-hint">or press <kbd>Ctrl</kbd> <kbd>K</kbd></div><div className="welcome-art"><div className="art-top"><span>DESIGN CANVAS</span><span>•••</span></div><div className="art-canvas"><div className="art-card"><span className="art-icon">✳</span><b>A calmer way<br/>to build ideas.</b><small>Concept · Homepage</small><div className="art-button">Explore the concept ↗</div></div><div className="art-side"><span/><span/><span/><span/></div></div><div className="art-footer"><span>Untitled concept</span><span>100%</span></div></div></div><section className="projects-section"><div className="section-title"><div><h2>Recent projects</h2><p>Your local work, all in one place.</p></div><button className="text-button" onClick={refresh}>Refresh ↻</button></div>{error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{projects.length ? <div className="project-grid">{projects.slice(0, workspaceSettings.recentProjectLimit).map((p, i) => <button key={p.id} className="project-card" onClick={() => openProject(p)}><div className={`project-thumb thumb-${i % 3}`}><span>✳</span></div><div className="card-meta"><b>{p.name}</b><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small></div></button>)}</div> : <button className="empty-project" onClick={() => setCreating(true)}><span className="empty-plus">＋</span><b>Your first project starts here</b><small>Create a project to begin your design journey.</small></button>}</section></>}
      </main>
    </div>
    {creating && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCreating(false)}><form className="dialog" onSubmit={createProject}><div className="dialog-icon">✳</div><h2>Create a project</h2><p>A private workspace for your product idea.</p><label htmlFor="project-name">Project name</label><input autoFocus id="project-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Northstar mobile app" maxLength={80} required/><div className="dialog-actions"><button type="button" className="quiet" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="primary">Create project</button></div>{error && <div className="dialog-error">{error}</div>}</form></div>}
    {settings && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setSettings(false)}><section className="dialog"><div className="dialog-icon">⚙</div><h2>Settings</h2><p>Workspace preferences. Provider secrets are not accepted or stored in this UI.</p><label htmlFor="theme-setting">Appearance</label><select id="theme-setting" value={workspaceSettings.theme} onChange={e => setWorkspaceSettings(s => ({ ...s, theme: e.target.value as Settings["theme"] }))}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><label htmlFor="provider-setting" className="setting-label">Preferred AI provider</label><select id="provider-setting" value={workspaceSettings.selectedProvider} onChange={e => setWorkspaceSettings(s => ({ ...s, selectedProvider: e.target.value }))}><option value="none">Not configured</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google</option><option value="custom">Custom adapter</option></select><div className="settings-note">Credentials will be configured through a protected local service in a later slice. Never paste API keys into project files.</div><div className="dialog-actions"><button className="quiet" onClick={() => setSettings(false)}>Cancel</button><button className="primary" onClick={saveSettings}>Save settings</button></div></section></div>}
    {commandOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCommandOpen(false)}><section className="command-dialog" role="dialog" aria-modal="true" aria-label="Command palette"><div className="command-search"><span>⌕</span><input autoFocus aria-label="Search commands" placeholder="Type a command…" onKeyDown={e => { if (e.key === "Enter") setCommandOpen(false); }}/><kbd>ESC</kbd></div><div className="command-group">WORKSPACE</div><button className="command-item" onClick={() => { setCommandOpen(false); setCreating(true); }}>＋ <span>New project</span><kbd>Ctrl N</kbd></button><button className="command-item" onClick={() => { setCommandOpen(false); setActive(null); setActiveDocument(null); }}>▦ <span>Go to all projects</span></button><button className="command-item" onClick={() => { setCommandOpen(false); setSettings(true); }}>⚙ <span>Open settings</span></button>{projects.slice(0, 5).map(p => <button className="command-item" key={p.id} onClick={() => { setCommandOpen(false); void openProject(p); }}>◈ <span>Open {p.name}</span></button>)}</section></div>}
  </div>;
}
