import { useEffect, useMemo, useState } from "react";
import {
  buildDirectionPages,
  evaluateDocumentQuality,
  type FlowPlan,
  type GeneratedDirection,
  type PatchProposal,
  type AIPatchOperation,
  type QualityReport,
  type AIProviderId,
} from "@uds/ai-engine";
import type { DesignDocument, DesignNode } from "@uds/design-core";
import "./ai-studio.css";

type Asset = { id: string; name: string; mimeType: string; size: number };
type ProviderStatus = { id: AIProviderId; label: string; configured: boolean; model: string; capabilities: { imageInput: boolean; jsonOutput: string; streaming: boolean; maxImages: number } };
type ProviderList = { selectedProvider: string; providers: ProviderStatus[]; credentialStore: string };
type DirectionResult = GeneratedDirection & { quality: QualityReport };
type PatchResult = { proposal: PatchProposal; baseRevision: number; localVersion: number };
type Props = {
  projectId: string;
  document: DesignDocument;
  pageId: string;
  selectedNodes: DesignNode[];
  assets: Asset[];
  localVersion: number;
  onApplyDirection: (pages: DesignDocument["pages"], baseRevision: number, localVersion: number) => boolean;
  onApplyPatch: (proposal: PatchProposal, operations: AIPatchOperation[], baseRevision: number, localVersion: number) => boolean;
  onClose: () => void;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

export function AIStudioPanel({ projectId, document, pageId, selectedNodes, assets, localVersion, onApplyDirection, onApplyPatch, onClose }: Props) {
  const [providerList, setProviderList] = useState<ProviderList | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [brief, setBrief] = useState("");
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [screenCount, setScreenCount] = useState(3);
  const [directionCount, setDirectionCount] = useState(2);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [plan, setPlan] = useState<FlowPlan | null>(null);
  const [directions, setDirections] = useState<DirectionResult[]>([]);
  const [patchResult, setPatchResult] = useState<PatchResult | null>(null);
  const [directionsContext, setDirectionsContext] = useState<{ baseRevision: number; localVersion: number } | null>(null);
  const [acceptedOperations, setAcceptedOperations] = useState<number[]>([]);
  const [quality, setQuality] = useState<ReturnType<typeof evaluateDocumentQuality> | null>(null);
  const [tab, setTab] = useState<"create" | "revise" | "evaluate">("create");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedProvider = providerList?.providers.find(item => item.id === provider);
  const canUseProvider = Boolean(provider && selectedProvider?.configured && model.trim());
  const assetOptions = useMemo(() => assets.filter(item => ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(item.mimeType)), [assets]);

  async function refreshProviders() {
    const result = await api<ProviderList>("/ai/providers");
    setProviderList(result);
    const current = result.providers.find(item => item.id === result.selectedProvider);
    const chosen = current?.id ?? result.providers.find(item => item.configured)?.id ?? "";
    setProvider(chosen);
    if (chosen && result.selectedProvider !== chosen) await api("/ai/provider", { method: "PUT", body: JSON.stringify({ provider: chosen }) });
  }

  useEffect(() => { void refreshProviders().catch(reason => setError((reason as Error).message)); }, []);
  useEffect(() => {
    const selected = providerList?.providers.find(item => item.id === provider);
    setModel(selected?.model ?? "");
  }, [provider, providerList]);

  async function selectProvider(next: string) {
    setBusy("provider"); setError("");
    try { await api("/ai/provider", { method: "PUT", body: JSON.stringify({ provider: next || "none" }) }); setProvider(next); await refreshProviders(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function saveKey(event: React.FormEvent) {
    event.preventDefault();
    if (!provider || !apiKey.trim()) return;
    setBusy("key"); setError("");
    try {
      await api(`/ai/credentials/${provider}`, { method: "PUT", body: JSON.stringify({ apiKey }) });
      setApiKey(""); await refreshProviders(); setNotice("Provider key saved to the local credential store.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function removeKey() {
    if (!provider || !window.confirm(`Remove the saved ${selectedProvider?.label ?? "provider"} key from this computer?`)) return;
    setBusy("key"); setError("");
    try { await api(`/ai/credentials/${provider}`, { method: "DELETE" }); await refreshProviders(); setNotice("Saved provider key removed."); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  function requestBase() { return { document, prompt: brief.trim(), model: model.trim() || undefined, referenceAssetIds: selectedAssets }; }

  async function makePlan() {
    if (!canUseProvider || !brief.trim()) { setError("Choose a connected provider, model ID, and product brief first."); return; }
    setBusy("plan"); setError(""); setNotice(""); setDirections([]); setPatchResult(null);
    try {
      const result = await api<{ plan: FlowPlan }>(`/projects/${projectId}/ai/plan`, { method: "POST", body: JSON.stringify({ ...requestBase(), screenCount }) });
      setPlan(result.plan); setNotice("Flow and screen inventory drafted. Edit it here, then generate design directions.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function makeDirections() {
    if (!canUseProvider || !brief.trim() || !plan) { setError("Create and review a flow plan before generating directions."); return; }
    setBusy("generate"); setError(""); setNotice(""); setPatchResult(null);
    const capturedRevision = document.revision;
    const capturedVersion = localVersion;
    try {
      const result = await api<{ directions: DirectionResult[] }>(`/projects/${projectId}/ai/generate`, { method: "POST", body: JSON.stringify({ ...requestBase(), plan, directionCount }) });
      setDirections(result.directions); setDirectionsContext({ baseRevision: capturedRevision, localVersion: capturedVersion }); setNotice("Directions are ready to review. Applying one adds its screens as editable pages.");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  async function makePatch() {
    if (!canUseProvider || !revisionPrompt.trim() || !selectedNodes.length) { setError("Select one or more layers and enter a revision request."); return; }
    setBusy("revise"); setError(""); setNotice(""); setAcceptedOperations([]);
    const capturedVersion = localVersion;
    try {
      const result = await api<Omit<PatchResult, "localVersion">>(`/projects/${projectId}/ai/revise`, { method: "POST", body: JSON.stringify({ document, pageId, selectedNodeIds: selectedNodes.map(node => node.id), prompt: revisionPrompt.trim(), model: model.trim() || undefined }) });
      setPatchResult({ ...result, localVersion: capturedVersion }); setAcceptedOperations(result.proposal.operations.map((_, index) => index));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  }

  function applyPatch() {
    if (!patchResult || !acceptedOperations.length) return;
    const operations = patchResult.proposal.operations.filter((_, index) => acceptedOperations.includes(index));
    const applied = onApplyPatch(patchResult.proposal, operations, patchResult.baseRevision, patchResult.localVersion);
    if (applied) { setPatchResult(null); setAcceptedOperations([]); setNotice("Reviewed changes applied as one undoable canvas edit."); }
    else setError("The document changed while this review was open. Draft a fresh revision before applying.");
  }

  function applyDirection(direction: DirectionResult) {
    if (!directionsContext) return;
    const applied = onApplyDirection(buildDirectionPages(direction), directionsContext.baseRevision, directionsContext.localVersion);
    if (applied) { setNotice(`${direction.screens.length} editable pages added. Save the document to create a persisted revision.`); }
    else setError("The document changed while these directions were open. Generate again from the current document.");
  }

  function editScreen(index: number, key: "name" | "goal", value: string) {
    setPlan(current => current ? { ...current, screens: current.screens.map((screen, screenIndex) => screenIndex === index ? { ...screen, [key]: value } : screen) } : current);
  }

  function evaluateCurrent() { setQuality(evaluateDocumentQuality(document)); }

  return <div className="ai-studio-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-studio-panel" role="dialog" aria-modal="true" aria-label="AI Studio">
      <header className="ai-studio-header"><div><span className="eyebrow">PHASE 5</span><h2>AI Studio</h2><p>Plan, generate and refine editable desktop screens.</p></div><button onClick={onClose} aria-label="Close AI Studio">×</button></header>
      <div className="ai-provider-settings">
        <label data-discovery-id="uds-ai-provider">Provider<select value={provider} onChange={event => void selectProvider(event.target.value)} disabled={busy !== ""}><option value="">Choose a provider</option>{providerList?.providers.map(item => <option key={item.id} value={item.id}>{item.label}{item.configured ? " · connected" : " · not connected"}</option>)}</select></label>
        {selectedProvider && <div className="ai-connection-row"><span>{selectedProvider.configured ? `Connected · ${providerList?.credentialStore === "windows-credential-manager" ? "OS vault" : "service environment"}` : "Not connected"} · {selectedProvider.capabilities.jsonOutput} JSON · image input</span>{selectedProvider.configured && providerList?.credentialStore === "windows-credential-manager" && <button onClick={() => void removeKey()} disabled={busy !== ""}>Remove saved key</button>}</div>}
        {provider && !selectedProvider?.configured && providerList?.credentialStore === "windows-credential-manager" && <form className="ai-key-form" onSubmit={saveKey}><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Stored in Windows Credential Manager" required/></label><button type="submit" disabled={busy !== ""}>{busy === "key" ? "Saving…" : "Connect provider"}</button></form>}
        {provider && !selectedProvider?.configured && providerList?.credentialStore !== "windows-credential-manager" && <p className="ai-credential-hint">Set {provider === "google" ? "GEMINI_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} for the local service process.</p>}
        {selectedProvider?.configured && <label className="ai-model-label">Model ID<input value={model} onChange={event => setModel(event.target.value)} placeholder="Set UDS_*_MODEL or enter a model ID"/></label>}
        <small>Keys stay in the local service credential store; they are not included in documents or sent to the browser after saving.</small>
      </div>
      <nav className="ai-studio-tabs"><button data-discovery-id="uds-ai-plan-tab" className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Plan & generate</button><button data-discovery-id="uds-ai-revise-tab" className={tab === "revise" ? "active" : ""} onClick={() => setTab("revise")}>Revise selection</button><button data-discovery-id="uds-ai-quality-tab" className={tab === "evaluate" ? "active" : ""} onClick={() => { setTab("evaluate"); evaluateCurrent(); }}>Quality review</button></nav>
      <div className="ai-studio-content">
        {tab === "create" && <>
          <p className="ai-context-note">The brief, a concise summary of this document, and only the screenshots you select below are sent to the selected provider. The full document stays local.</p>
          <label className="ai-field" data-discovery-id="uds-ai-brief">Product brief<textarea value={brief} onChange={event => setBrief(event.target.value)} placeholder="Describe the product, its users, the problem, and the outcome the screens should support." maxLength={10000}/></label>
          <div className="ai-form-row"><label>Screen count<select value={screenCount} onChange={event => setScreenCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} screens</option>)}</select></label><label>Design directions<select value={directionCount} onChange={event => setDirectionCount(Number(event.target.value))}><option value={2}>2 directions</option><option value={3}>3 directions</option></select></label></div>
          {assetOptions.length > 0 && <fieldset className="ai-reference-list" data-discovery-id="uds-ai-reference-images"><legend>Reference screenshots or images</legend>{assetOptions.map(asset => <label key={asset.id}><input type="checkbox" checked={selectedAssets.includes(asset.id)} disabled={!selectedAssets.includes(asset.id) && selectedAssets.length >= 3} onChange={event => setSelectedAssets(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))}/><span>{asset.name}</span><small>{(asset.size / 1024 / 1024).toFixed(1)} MB</small></label>)}</fieldset>}
          <button data-discovery-id="uds-ai-generate" className="ai-primary" onClick={() => void makePlan()} disabled={busy !== "" || !canUseProvider}>{busy === "plan" ? "Planning flow…" : "Draft user flow and screen inventory"}</button>
          {plan && <section className="ai-plan-review"><div className="ai-section-title"><div><b>{plan.productName}</b><small>{plan.audience}</small></div><span>{plan.flow.length} steps</span></div><p>{plan.summary}</p><div className="ai-flow-steps">{plan.flow.map((step, index) => <article key={step.id}><span>{index + 1}</span><div><b>{step.name}</b><small>{step.userGoal}</small></div></article>)}</div><h3>Review screen inventory</h3>{plan.screens.map((screen, index) => <div className="ai-screen-edit" key={screen.id}><label>Name<input value={screen.name} onChange={event => editScreen(index, "name", event.target.value)}/></label><label>Goal<input value={screen.goal} onChange={event => editScreen(index, "goal", event.target.value)}/></label></div>)}<button className="ai-primary" onClick={() => void makeDirections()} disabled={busy !== "" || !canUseProvider}>{busy === "generate" ? "Generating screens…" : `Generate ${directionCount} editable directions`}</button></section>}
          {directions.map(direction => <article className="ai-direction-card" key={direction.id}><div className="ai-section-title"><div><b>{direction.name}</b><small>{direction.layout} layout · {direction.visualApproach}</small></div><strong>{direction.quality.score}/100</strong></div><p>{direction.rationale}</p><div className="ai-swatch-row">{Object.entries(direction.palette).map(([name, color]) => <span key={name} title={`${name}: ${color}`} style={{ background: color}}/>)}</div><ol>{direction.screens.map(screen => <li key={screen.name}><b>{screen.name}</b><small>{screen.goal}</small></li>)}</ol><div className="ai-quality-inline">{direction.quality.checks.filter(item => item.result !== "good").map(item => <small key={item.label}>Review {item.label.toLowerCase()}: {item.detail}</small>)}</div><button onClick={() => applyDirection(direction)} disabled={busy !== ""}>Apply this direction</button></article>)}
        </>}
        {tab === "revise" && <>
          <p className="ai-context-note">{selectedNodes.length ? `${selectedNodes.length} selected layer${selectedNodes.length === 1 ? "" : "s"} on ${document.pages.find(page => page.id === pageId)?.name ?? "this page"}. A concise document summary and selected layer summaries go to the provider; only selected layers can be changed.` : "Select one or more layers in the canvas first."}</p>
          <label className="ai-field" data-discovery-id="uds-ai-revise">Requested change<textarea value={revisionPrompt} onChange={event => setRevisionPrompt(event.target.value)} placeholder="For example: make the headline more specific and use a warmer accent color." maxLength={3000}/></label>
          <button className="ai-primary" onClick={() => void makePatch()} disabled={busy !== "" || !canUseProvider || !selectedNodes.length}>{busy === "revise" ? "Preparing review…" : "Draft changes for review"}</button>
          {patchResult && <section className="ai-patch-review"><b>Review proposed changes</b><p>{patchResult.proposal.summary}</p>{patchResult.proposal.operations.map((operation, index) => <label key={`${operation.nodeId}:${index}`}><input type="checkbox" checked={acceptedOperations.includes(index)} onChange={event => setAcceptedOperations(current => event.target.checked ? [...current, index] : current.filter(item => item !== index))}/><span>{operationLabel(operation, selectedNodes)}</span></label>)}{patchResult.proposal.considerations.map(item => <small className="ai-consideration" key={item}>{item}</small>)}<button className="ai-primary" onClick={applyPatch} disabled={!acceptedOperations.length}>Apply {acceptedOperations.length} selected change{acceptedOperations.length === 1 ? "" : "s"}</button></section>}
        </>}
        {tab === "evaluate" && <>
          <div className="ai-quality-score"><span>{quality?.score ?? "—"}</span><div><b>Document quality score</b><small>Deterministic first-pass checks across {quality?.pages.length ?? 0} pages.</small></div></div>
          <div data-discovery-id="uds-ai-quality"><button className="ai-secondary" onClick={evaluateCurrent}>Refresh review</button>
          {quality?.pages.map(page => <article className="ai-page-quality" key={page.pageId}><div className="ai-section-title"><b>{page.pageName}</b><strong>{page.report.score}/100</strong></div><p>{page.report.summary}</p>{page.report.checks.map(item => <div className={`ai-check ai-check-${item.result}`} key={item.label}><div><b>{item.label}</b><span>{item.score}</span></div><small>{item.detail}</small></div>)}</article>)}</div>
        </>}
      </div>
      {(error || notice) && <p className={error ? "ai-error" : "ai-notice"} role={error ? "alert" : "status"}>{error || notice}</p>}
      <footer className="ai-studio-footer">Generated screens stay editable. Review proposals before applying; saves still use document revision checks.</footer>
    </section>
  </div>;
}

function operationLabel(operation: AIPatchOperation, selectedNodes: DesignNode[]): string {
  const name = selectedNodes.find(node => node.id === operation.nodeId)?.name || "Selected layer";
  if (operation.op === "setText") return `${name}: replace text with “${operation.value.slice(0, 100)}${operation.value.length > 100 ? "…" : ""}”`;
  if (operation.op === "setFill") return `${name}: set fill to ${operation.value}`;
  if (operation.op === "setColor") return `${name}: set text color to ${operation.value}`;
  if (operation.op === "setFontSize") return `${name}: set font size to ${operation.value}px`;
  return `${name}: rename to ${operation.value}`;
}
