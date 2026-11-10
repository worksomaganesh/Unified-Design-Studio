import { useEffect, useRef, useState } from "react";
import "./design-system.css";
import {
  DESIGN_TOKEN_TYPES,
  type DesignSystem,
  type DesignDocument,
  type DesignNode,
  type DesignToken,
  type DesignTokenType,
  type DesignTokenValue,
  designTokenCssValue,
  parseDesignSystemImport,
  serializeDesignSystem,
  type ComponentDefinition,
  type ComponentProperty,
  type ComponentPropertyValue,
} from "@uds/design-core";
import { exportDtcgTokens, importInterchangeTokens } from "@uds/design-core/token-interchange";
import { exportFigmaVariables, importFigmaVariables } from "@uds/design-core/figma-variables";

type Props = {
  projectId: string;
  documentRevision: number;
  localVersion: number;
  system: DesignSystem;
  activeModeId: string;
  selectedNode?: DesignNode;
  onApplyToken: (tokenId: string) => void;
  onModeChange: (modeId: string) => void;
  onChange: (next: DesignSystem) => boolean | void;
  onImportFigma: (pages: DesignDocument["pages"], system: DesignSystem, baseRevision: number, baseLocalVersion: number) => boolean;
  onDeleteToken: (id: string) => void;
  onCreateComponent: () => void;
  onClose: () => void;
};

const labels: Record<DesignTokenType, string> = {
  color: "Color", number: "Number", dimension: "Dimension", "font-family": "Font family",
  "font-size": "Font size", "line-height": "Line height", radius: "Radius", shadow: "Shadow", border: "Border",
};

function defaultValue(type: DesignTokenType): DesignTokenValue {
  switch (type) {
    case "color": return { type, value: "#6750a4" };
    case "number": return { type, value: 1 };
    case "dimension": return { type, value: 8, unit: "px" };
    case "font-family": return { type, value: "Arial, sans-serif" };
    case "font-size": return { type, value: 16, unit: "px" };
    case "line-height": return { type, value: 1.5 };
    case "radius": return { type, value: 8, unit: "px" };
    case "shadow": return { type, value: "0 4px 12px #0002" };
    case "border": return { type, value: "1px solid #e5e7eb" };
  }
}

function parseValue(type: DesignTokenType, raw: string): DesignTokenValue {
  if (type === "color" || type === "font-family" || type === "shadow" || type === "border") return { type, value: raw } as DesignTokenValue;
  if (type === "number" || type === "line-height") {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error("Enter a valid number.");
    return { type, value } as DesignTokenValue;
  }
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|%)?$/);
  if (!match) throw new Error("Enter a number with px, rem, or % units.");
  const value = Number(match[1]);
  const unit = (match[2] ?? "px") as "px" | "rem" | "%";
  if (type === "font-size" && unit === "%") throw new Error("Font sizes use px or rem.");
  return { type, value, unit } as DesignTokenValue;
}

function modeInputValue(token: DesignToken, modeId: string, defaultModeId: string): string {
  const selected = modeId === defaultModeId ? token.value : token.modeValues[modeId] ?? token.value;
  return designTokenCssValue(selected);
}

export function DesignSystemPanel({ projectId, documentRevision, localVersion, system, activeModeId, selectedNode, onApplyToken, onModeChange, onChange, onImportFigma, onDeleteToken, onCreateComponent, onClose }: Props) {
  const [themeId, setThemeId] = useState(system.themes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<DesignTokenType>("color");
  const [value, setValue] = useState(designTokenCssValue(defaultValue("color")));
  const [aliasOf, setAliasOf] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [componentError, setComponentError] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaBusy, setFigmaBusy] = useState(false);
  const [figmaStatus, setFigmaStatus] = useState("");
  const importFile = useRef<HTMLInputElement>(null);
  const themes = system.themes.length ? system.themes : [{ id: "", name: "No theme" }];
  const modes = system.modes.filter(mode => mode.themeId === themeId);
  const modeId = modes.some(mode => mode.id === activeModeId) ? activeModeId : modes[0]?.id ?? "";
  const defaultModeId = modes[0]?.id ?? "";

  useEffect(() => {
    if (!system.themes.some(theme => theme.id === themeId)) setThemeId(system.themes[0]?.id ?? "");
  }, [system, themeId]);
  useEffect(() => {
    if (modeId && modeId !== activeModeId) onModeChange(modeId);
  }, [modeId, activeModeId, onModeChange]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/integrations/figma").then(response => response.json()).then((result: { configured?: boolean }) => {
      if (!cancelled) setFigmaConnected(Boolean(result.configured));
    }).catch(() => { if (!cancelled) setFigmaStatus("Figma connection status is unavailable."); });
    return () => { cancelled = true; };
  }, []);

  async function callFigma<T>(path: string, method: "GET" | "PUT" | "DELETE" | "POST", body?: unknown): Promise<T> {
    const response = await fetch(path, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(result.error ?? `Figma request failed (${response.status}).`);
    return result;
  }

  async function saveFigmaToken() {
    if (!figmaToken.trim()) { setFigmaStatus("Enter a Figma access token first."); return; }
    setFigmaBusy(true); setFigmaStatus("");
    try {
      await callFigma("/api/integrations/figma/credential", "PUT", { token: figmaToken.trim() });
      setFigmaToken(""); setFigmaConnected(true); setFigmaStatus("Figma token saved in the local credential store.");
    } catch (reason) { setFigmaStatus((reason as Error).message); }
    finally { setFigmaBusy(false); }
  }

  async function removeFigmaToken() {
    setFigmaBusy(true); setFigmaStatus("");
    try { await callFigma("/api/integrations/figma/credential", "DELETE"); setFigmaConnected(false); setFigmaStatus("Saved Figma token removed."); }
    catch (reason) { setFigmaStatus((reason as Error).message); }
    finally { setFigmaBusy(false); }
  }

  async function importFigmaVariablesDirectly() {
    if (!figmaFileKey.trim()) { setFigmaStatus("Enter the Figma file key first."); return; }
    setFigmaBusy(true); setFigmaStatus("");
    try {
      const payload = await callFigma<unknown>("/api/integrations/figma/variables/read", "POST", { fileKey: figmaFileKey.trim() });
      const imported = importFigmaVariables(payload, system);
      if (onChange(imported.designSystem) === false) { setFigmaStatus("Import rejected because it would break an existing canvas or component token reference."); return; }
      setFigmaStatus(imported.warnings.length ? `Imported from Figma with limits: ${imported.warnings.join(" ")}` : "Imported Figma Variables collections and modes.");
    } catch (reason) { setFigmaStatus((reason as Error).message); }
    finally { setFigmaBusy(false); }
  }

  async function importFigmaFile() {
    if (!figmaFileKey.trim()) { setFigmaStatus("Enter the Figma file key first."); return; }
    setFigmaBusy(true); setFigmaStatus("");
    try {
      const result = await callFigma<{ fileName: string; pages: DesignDocument["pages"]; designSystem: DesignSystem; layersImported: number; componentsImported: number; tokensImported: number; warnings: string[] }>("/api/integrations/figma/file/import", "POST", { fileKey: figmaFileKey.trim(), designSystem: system });
      if (!onImportFigma(result.pages, result.designSystem, documentRevision, localVersion)) {
        setFigmaStatus("The project changed while Figma was loading, or its content could not be validated. No imported pages were applied.");
        return;
      }
      const summary = `Imported ${result.pages.length} page${result.pages.length === 1 ? "" : "s"}, ${result.layersImported} layer${result.layersImported === 1 ? "" : "s"}${result.componentsImported ? `, and ${result.componentsImported} component${result.componentsImported === 1 ? "" : "s"}` : ""} from ${result.fileName}${result.tokensImported ? ` with ${result.tokensImported} variables` : ""}.`;
      setFigmaStatus(result.warnings.length ? `${summary} Limits: ${result.warnings.join(" ")}` : `${summary} Save the project to keep these changes.`);
    } catch (reason) { setFigmaStatus((reason as Error).message); }
    finally { setFigmaBusy(false); }
  }

  async function createFigmaVariables() {
    if (!figmaFileKey.trim()) { setFigmaStatus("Enter the Figma file key first."); return; }
    const confirmed = window.confirm(`This will create new variable collections and variables in Figma file ${figmaFileKey.trim()}. Existing Figma variables will not be updated or removed. Continue?`);
    if (!confirmed) return;
    setFigmaBusy(true); setFigmaStatus("");
    try {
      const result = await callFigma<{ warnings?: string[] }>("/api/integrations/figma/variables/write", "POST", { fileKey: figmaFileKey.trim(), projectId, expectedRevision: documentRevision });
      setFigmaStatus(result.warnings?.length ? `Added variables to Figma with conversion limits: ${result.warnings.join(" ")}` : "Added variable collections and variables to Figma.");
    } catch (reason) { setFigmaStatus((reason as Error).message); }
    finally { setFigmaBusy(false); }
  }

  function addTheme() {
    const themeName = window.prompt("Theme name")?.trim();
    if (!themeName) return;
    const id = crypto.randomUUID();
    const mode = { id: crypto.randomUUID(), themeId: id, name: "Default" };
    onChange({ ...system, themes: [...system.themes, { id, name: themeName }], modes: [...system.modes, mode] });
    setThemeId(id);
    onModeChange(mode.id);
  }

  function addMode() {
    if (!themeId) { setError("Create a theme before adding a mode."); return; }
    const modeName = window.prompt("Mode name, such as Light or Dark")?.trim();
    if (!modeName) return;
    const mode = { id: crypto.randomUUID(), themeId, name: modeName };
    onChange({ ...system, modes: [...system.modes, mode] });
    onModeChange(mode.id);
  }

  function addToken(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (system.tokens.some(token => token.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { setError("Token names must be unique."); return; }
    try {
      const parsed = parseValue(type, value);
      const token: DesignToken = {
        id: crypto.randomUUID(), name: name.trim(), type, value: parsed, modeValues: {}, ...(aliasOf ? { aliasOf } : {}),
      };
      onChange({ ...system, tokens: [...system.tokens, token] });
      setName(""); setAliasOf(""); setValue(designTokenCssValue(defaultValue(type)));
    } catch (reason) { setError((reason as Error).message); }
  }

  function saveTokenValue(token: DesignToken, raw: string) {
    try {
      const parsed = parseValue(token.type, raw);
      const updated = system.tokens.map(item => {
        if (item.id !== token.id) return item;
        if (modeId === defaultModeId) return { ...item, value: parsed };
        return { ...item, modeValues: { ...item.modeValues, [modeId]: parsed } };
      });
      onChange({ ...system, tokens: updated });
      setError("");
    } catch (reason) { setError((reason as Error).message); }
  }

  function setAlias(token: DesignToken, nextAliasId: string) {
    let candidate = system.tokens.find(item => item.id === nextAliasId);
    const visited = new Set<string>();
    while (candidate) {
      if (candidate.id === token.id || visited.has(candidate.id)) { setError("Token aliases cannot form a cycle."); return; }
      visited.add(candidate.id);
      candidate = candidate.aliasOf ? system.tokens.find(item => item.id === candidate?.aliasOf) : undefined;
    }
    setError("");
    onChange({ ...system, tokens: system.tokens.map(item => item.id === token.id ? { ...item, aliasOf: nextAliasId || undefined } : item) });
  }

  function updateComponent(updated: ComponentDefinition) {
    onChange({ ...system, components: system.components.map(item => item.id === updated.id ? updated : item) });
  }

  function addVariant(component: ComponentDefinition) {
    const variantName = window.prompt("Variant name, such as Compact or Emphasized")?.trim();
    if (!variantName) return;
    updateComponent({ ...component, variants: [...component.variants, { id: crypto.randomUUID(), name: variantName, values: {} }] });
  }

  function updateProperty(component: ComponentDefinition, property: ComponentProperty, value: ComponentPropertyValue) {
    updateComponent({ ...component, properties: component.properties.map(item => item.id === property.id ? { ...item, defaultValue: value } : item) });
  }

  function updateVariantValue(component: ComponentDefinition, variantId: string, property: ComponentProperty, value: ComponentPropertyValue | undefined) {
    updateComponent({ ...component, variants: component.variants.map(variant => {
      if (variant.id !== variantId) return variant;
      const values = { ...variant.values };
      if (value === undefined) delete values[property.id]; else values[property.id] = value;
      return { ...variant, values };
    }) });
  }

  function exportSystem() {
    const blob = new Blob([serializeDesignSystem(system)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "uds-design-system.json";
    window.document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setTransferMessage("Exported the complete UDS design system file.");
  }

  function exportTokens() {
    const result = exportDtcgTokens(system);
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "uds-tokens-dtcg.json";
    window.document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setTransferMessage(result.warnings.length ? `Export completed with limits: ${result.warnings.join(" ")}` : "Exported DTCG 2025.10 tokens for Penpot and compatible token tools.");
  }

  function exportFigmaTokenPayload() {
    try {
      const result = exportFigmaVariables(system);
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "uds-figma-variables-request.json";
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setTransferMessage(result.warnings.length ? `Figma payload exported with limits: ${result.warnings.join(" ")}` : "Exported a Figma Variables API request payload. Review it before sending it to a Figma file.");
    } catch (reason) { setComponentError((reason as Error).message); }
  }

  async function importSystem(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Token JSON files are limited to 5 MB.");
      const contents = await file.text();
      const parsed: unknown = JSON.parse(contents);
      const isUdsFile = Boolean(parsed && typeof parsed === "object" && "format" in parsed);
      const isFigmaVariables = Boolean(parsed && typeof parsed === "object" && "meta" in parsed && parsed.meta && typeof parsed.meta === "object" && "variables" in parsed.meta);
      const imported = isUdsFile
        ? { designSystem: parseDesignSystemImport(parsed), warnings: [] as string[] }
        : isFigmaVariables ? importFigmaVariables(parsed, system) : importInterchangeTokens(parsed, system);
      if (onChange(imported.designSystem) === false) { setComponentError("Import rejected because it would break an existing canvas or component token reference. Keep referenced tokens in the imported file, then retry."); return; }
      setError(""); setComponentError("");
      setTransferMessage(imported.warnings.length ? `Imported supported tokens with limits: ${imported.warnings.join(" ")}` : isUdsFile ? "Imported the UDS design system." : isFigmaVariables ? "Imported Figma Variables collections and modes. Figma aliases were resolved to their current values." : "Imported token sets and themes. External alias references were resolved to their current values.");
    } catch (reason) { setComponentError((reason as Error).message); }
  }

  function propertyInput(property: ComponentProperty, value: ComponentPropertyValue, onValue: (next: ComponentPropertyValue) => void) {
    if (property.type === "boolean") return <input type="checkbox" checked={Boolean(value)} onChange={event => onValue(event.target.checked)} />;
    if (property.type === "number") return <input type="number" value={Number(value)} onChange={event => onValue(Number(event.target.value))} />;
    return <input type={property.type === "color" ? "color" : "text"} value={String(value)} onChange={event => onValue(event.target.value)} />;
  }

  return <div className="design-system-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="design-system-panel" role="dialog" aria-modal="true" aria-label="Design system">
      <header className="design-system-header"><div><span className="eyebrow">PHASE 4</span><h2>Design system</h2><p>Typed tokens shared across this document.</p></div><button onClick={onClose} aria-label="Close design system">×</button></header>
      <div className="design-system-scope"><label>Theme<select value={themeId} onChange={event => setThemeId(event.target.value)}>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></label><button onClick={addTheme}>＋ Theme</button><label>Mode<select value={modeId} onChange={event => onModeChange(event.target.value)}>{modes.map(mode => <option key={mode.id} value={mode.id}>{mode.name}</option>)}</select></label><button onClick={addMode}>＋ Mode</button></div>
      <section className="design-token-create"><h3>Add token</h3><form onSubmit={addToken}><label>Name<input value={name} onChange={event => setName(event.target.value)} placeholder="color.brand.primary" required maxLength={80}/></label><div className="design-token-form-row"><label>Type<select value={type} onChange={event => { const next = event.target.value as DesignTokenType; setType(next); setValue(designTokenCssValue(defaultValue(next))); setAliasOf(""); }}>{DESIGN_TOKEN_TYPES.map(item => <option key={item} value={item}>{labels[item]}</option>)}</select></label><label>Value<input type={type === "color" ? "color" : "text"} value={value} onChange={event => setValue(event.target.value)}/></label></div><label>Alias of <select value={aliasOf} onChange={event => setAliasOf(event.target.value)}><option value="">No alias</option>{system.tokens.filter(token => token.type === type).map(token => <option key={token.id} value={token.id}>{token.name}</option>)}</select></label><button className="primary" type="submit">Add token</button></form></section>
      <section className="design-token-list"><div className="design-token-list-heading"><h3>Tokens</h3><span>{system.tokens.length}</span></div>{system.tokens.length ? system.tokens.map(token => {
        const inputKey = `${token.id}:${modeId}`;
        const currentValue = drafts[inputKey] ?? modeInputValue(token, modeId, defaultModeId);
        const isAlias = Boolean(token.aliasOf);
        return <article className="design-token-row" key={token.id}><div className="design-token-row-title"><div><b>{token.name}</b><small>{labels[token.type]}</small></div><div className="design-token-actions">{token.type === "color" && (selectedNode?.type === "shape" || selectedNode?.type === "text") && <button onClick={() => onApplyToken(token.id)}>Apply</button>}<button onClick={() => onDeleteToken(token.id)} aria-label={`Delete ${token.name}`}>×</button></div></div><div className="design-token-edit-row"><input type={token.type === "color" ? "color" : "text"} value={currentValue} disabled={isAlias} onChange={event => setDrafts(current => ({ ...current, [inputKey]: event.target.value }))} onBlur={event => { if (!isAlias && event.target.value !== modeInputValue(token, modeId, defaultModeId)) saveTokenValue(token, event.target.value); }}/><select value={token.aliasOf ?? ""} onChange={event => setAlias(token, event.target.value)} aria-label={`Alias target for ${token.name}`}><option value="">Value</option>{system.tokens.filter(item => item.id !== token.id && item.type === token.type).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></article>;
      }) : <p className="empty-token-list">No tokens yet. Add a typed token above.</p>}</section>
      <section className="design-component-list"><div className="design-token-list-heading"><h3>Components</h3><span>{system.components.length}</span></div><button className="component-create" disabled={!selectedNode || selectedNode.type === "component-instance"} onClick={onCreateComponent}>＋ Create from selected layer</button>
        {system.components.map(component => <article className="design-component-row" key={component.id}><label>Definition name<input value={component.name} onChange={event => updateComponent({ ...component, name: event.target.value })}/></label>
          {component.properties.map(property => <div className="component-property-edit" key={property.id}><span>{property.name} <small>{property.type}</small></span>{propertyInput(property, property.defaultValue, value => updateProperty(component, property, value))}</div>)}
          <div className="component-variant-heading"><b>Variants</b><button onClick={() => addVariant(component)}>＋ Variant</button></div>
          {component.variants.map(variant => <div className="component-variant" key={variant.id}><div className="component-variant-name"><b>{variant.name}</b><button aria-label={`Delete ${variant.name} variant`} onClick={() => updateComponent({ ...component, variants: component.variants.filter(item => item.id !== variant.id) })}>×</button></div>
            {component.properties.map(property => { const value = variant.values[property.id] ?? property.defaultValue; return <label className="component-property-edit" key={property.id}><span>{property.name}</span>{propertyInput(property, value, next => updateVariantValue(component, variant.id, property, Object.is(next, property.defaultValue) ? undefined : next))}</label>; })}
          </div>)}
        </article>)}{!system.components.length && <p className="empty-token-list">Select a canvas layer and create a reusable component.</p>}
      </section>
      <section className="design-system-transfer"><h3>Interchange</h3><div><button onClick={exportSystem}>Export UDS</button><button onClick={exportTokens}>Export DTCG</button><button onClick={exportFigmaTokenPayload}>Export Figma API JSON</button><button onClick={() => importFile.current?.click()}>Import JSON</button><input ref={importFile} type="file" accept="application/json,.json" hidden onChange={event => { void importSystem(event.target.files?.[0]); event.currentTarget.value = ""; }}/></div><p>UDS files include components. Token import accepts DTCG, Penpot/Tokens Studio sets, and Figma Variables API JSON. Import replaces tokens but keeps components; canvas references must remain valid.</p>{transferMessage && <p className="design-system-transfer-message" role="status">{transferMessage}</p>}
      <details className="figma-variables-connection"><summary>Figma file and Variables</summary><p>File import needs file access and a token with file_content:read. Variable values and bindings also need an eligible Enterprise full seat and file_variables:read. Variables can be sent to Figma with file_variables:write. The token stays in the local credential store.</p><label>Figma file key<input value={figmaFileKey} onChange={event => setFigmaFileKey(event.target.value)} maxLength={128} placeholder="File key from the Figma URL"/></label>{!figmaConnected && <label>Figma access token<input type="password" autoComplete="new-password" value={figmaToken} onChange={event => setFigmaToken(event.target.value)} maxLength={512} placeholder="Paste a Figma token"/></label>}<div><button disabled={figmaBusy || !figmaToken.trim()} onClick={() => void saveFigmaToken()}>{figmaBusy ? "Working…" : "Save token"}</button><button disabled={figmaBusy || !figmaConnected} onClick={() => void importFigmaFile()}>{figmaBusy ? "Working…" : "Import Figma file"}</button><button disabled={figmaBusy || !figmaConnected} onClick={() => void importFigmaVariablesDirectly()}>Import variables only</button><button disabled={figmaBusy || !figmaConnected} onClick={() => void createFigmaVariables()}>Create variables in Figma</button>{figmaConnected && <button disabled={figmaBusy} onClick={() => void removeFigmaToken()}>Remove token</button>}</div>{figmaStatus && <p className="design-system-transfer-message" role="status">{figmaStatus}</p>}</details>
      </section>
      {(error || componentError) && <p className="design-system-error" role="alert">{error || componentError}</p>}
      <footer className="design-system-footer">Values and references are validated before they are saved to the design document.</footer>
    </section>
  </div>;
}
