import { useState } from "react";
import { evaluatePrototypeUX, type DesignDocument, type DesignNode, type Prototype } from "@uds/design-core";
import "./prototype.css";

type Props = {
  document: DesignDocument;
  pageId: string;
  selectedNode?: DesignNode;
  onChange: (prototype: Prototype) => void;
  onPreview: () => void;
  onClose: () => void;
};

const id = () => crypto.randomUUID();
const nodeLabel = (node: DesignNode | undefined) => node?.name.trim() || node?.type || "Selected layer";

export function PrototypePanel({ document, pageId, selectedNode, onChange, onPreview, onClose }: Props) {
  const prototype = document.prototype;
  const [variableName, setVariableName] = useState("");
  const [variableType, setVariableType] = useState<"string" | "number" | "boolean">("string");
  const [variableDefault, setVariableDefault] = useState("");
  const [bindingVariableId, setBindingVariableId] = useState("");
  const [trigger, setTrigger] = useState<"click" | "doubleClick" | "hover">("click");
  const [actionType, setActionType] = useState("navigate");
  const [targetPageId, setTargetPageId] = useState(document.pages.find(page => page.id !== pageId)?.id ?? pageId);
  const [actionVariableId, setActionVariableId] = useState("");
  const [actionValue, setActionValue] = useState("");
  const [variantId, setVariantId] = useState("");
  const component = selectedNode?.type === "component-instance"
    ? document.designSystem.components.find(item => item.id === selectedNode.componentId)
    : undefined;
  const checks = evaluatePrototypeUX(document);
  const duplicateConnection = selectedNode && prototype.connections.some(item => item.sourcePageId === pageId && item.sourceNodeId === selectedNode.id && item.trigger === trigger);

  function addVariable() {
    const name = variableName.trim();
    if (!name) return;
    const initialValue = variableType === "number" ? Number(variableDefault || 0) : variableType === "boolean" ? variableDefault === "true" : variableDefault;
    onChange({ ...prototype, variables: [...prototype.variables, { id: id(), name, type: variableType, initialValue }] });
    setVariableName("");
  }

  function addBinding() {
    if (!selectedNode || selectedNode.type !== "text" || !bindingVariableId) return;
    if (prototype.bindings.some(item => item.nodeId === selectedNode.id && item.variableId === bindingVariableId)) return;
    onChange({ ...prototype, bindings: [...prototype.bindings, { nodeId: selectedNode.id, variableId: bindingVariableId }] });
  }

  function addInteraction() {
    if (!selectedNode || duplicateConnection) return;
    const action = actionType === "navigate" ? { type: "navigate" as const, targetPageId }
      : actionType === "openOverlay" ? { type: "openOverlay" as const, targetPageId }
      : actionType === "closeOverlay" ? { type: "closeOverlay" as const }
      : actionType === "setVariable" ? (() => {
        const variable = prototype.variables.find(item => item.id === actionVariableId);
        if (!variable) return undefined;
        const value = variable.type === "number" ? Number(actionValue) : variable.type === "boolean" ? actionValue === "true" : actionValue;
        return { type: "setVariable" as const, variableId: variable.id, value };
      })()
      : selectedNode.type === "component-instance" && variantId ? { type: "setComponentVariant" as const, nodeId: selectedNode.id, variantId } : undefined;
    if (!action) return;
    onChange({ ...prototype, connections: [...prototype.connections, { id: id(), sourcePageId: pageId, sourceNodeId: selectedNode.id, trigger, action }] });
  }

  function actionName(action: Prototype["connections"][number]["action"]): string {
    if (action.type === "navigate") return `Navigate to ${document.pages.find(page => page.id === action.targetPageId)?.name ?? "missing page"}`;
    if (action.type === "openOverlay") return `Open ${document.pages.find(page => page.id === action.targetPageId)?.name ?? "missing page"} as overlay`;
    if (action.type === "closeOverlay") return "Close overlay";
    if (action.type === "setVariable") return `Set ${prototype.variables.find(item => item.id === action.variableId)?.name ?? "variable"}`;
    const target = findNode(document, action.nodeId);
    const definition = target?.type === "component-instance" ? document.designSystem.components.find(item => item.id === target.componentId) : undefined;
    return `Show variant ${definition?.variants.find(item => item.id === action.variantId)?.name ?? action.variantId}`;
  }

  return <div className="prototype-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="prototype-panel" role="dialog" aria-modal="true" aria-label="Prototype and UX">
      <header className="prototype-header"><div><span className="eyebrow">PHASE 6</span><h2>Prototype & UX</h2><p>Connect screens and preview interactions.</p></div><button onClick={onClose} aria-label="Close prototype panel">×</button></header>
      <div className="prototype-content">
        <button data-discovery-id="uds-prototype-preview" className="prototype-primary" onClick={onPreview}>▶ Open clickable preview</button>
        <section className="prototype-section" data-discovery-id="uds-prototype-variables"><h3>Variables</h3><p>Prototype-only values can update bound text while previewing.</p>
          <div className="prototype-row"><input aria-label="Variable name" placeholder="Variable name" value={variableName} onChange={event => setVariableName(event.target.value)}/><select aria-label="Variable type" value={variableType} onChange={event => setVariableType(event.target.value as typeof variableType)}><option value="string">Text</option><option value="number">Number</option><option value="boolean">True / false</option></select></div>
          {variableType === "boolean" ? <select aria-label="Initial value" value={variableDefault || "false"} onChange={event => setVariableDefault(event.target.value)}><option value="false">False</option><option value="true">True</option></select> : <input aria-label="Initial value" placeholder="Initial value" value={variableDefault} onChange={event => setVariableDefault(event.target.value)}/>}
          <button className="prototype-secondary" onClick={addVariable} disabled={!variableName.trim()}>Add variable</button>
          {prototype.variables.map(variable => <div className="prototype-list-row" key={variable.id}><span><b>{variable.name}</b><small>{variable.type} · {String(variable.initialValue)}</small></span><button onClick={() => onChange({ ...prototype, variables: prototype.variables.filter(item => item.id !== variable.id), bindings: prototype.bindings.filter(item => item.variableId !== variable.id), connections: prototype.connections.filter(item => item.action.type !== "setVariable" || item.action.variableId !== variable.id) })} aria-label={`Delete ${variable.name}`}>×</button></div>)}
        </section>
        <section className="prototype-section" data-discovery-id="uds-prototype-bindings"><h3>Bind a variable to text</h3><p>{selectedNode?.type === "text" ? `Selected text: ${nodeLabel(selectedNode)}` : "Select a text layer on the canvas first."}</p>
          <div className="prototype-row"><select value={bindingVariableId} onChange={event => setBindingVariableId(event.target.value)}><option value="">Choose variable</option>{prototype.variables.map(variable => <option key={variable.id} value={variable.id}>{variable.name}</option>)}</select><button className="prototype-secondary" onClick={addBinding} disabled={selectedNode?.type !== "text" || !bindingVariableId}>Bind</button></div>
          {prototype.bindings.map(binding => <div className="prototype-list-row" key={`${binding.nodeId}:${binding.variableId}`}><span><b>{nodeLabel(findNode(document, binding.nodeId))}</b><small>{prototype.variables.find(item => item.id === binding.variableId)?.name ?? "Missing variable"}</small></span><button onClick={() => onChange({ ...prototype, bindings: prototype.bindings.filter(item => item !== binding) })} aria-label="Remove variable binding">×</button></div>)}
        </section>
        <section className="prototype-section" data-discovery-id="uds-prototype-interaction"><h3>Add interaction</h3><p>{selectedNode ? `From ${nodeLabel(selectedNode)} on ${document.pages.find(page => page.id === pageId)?.name ?? "this page"}` : "Select a source layer in the canvas first."}</p>
          <div className="prototype-row"><label>Trigger<select value={trigger} onChange={event => setTrigger(event.target.value as typeof trigger)}><option value="click">Click</option><option value="doubleClick">Double click</option><option value="hover">Hover</option></select></label><label>Action<select value={actionType} onChange={event => setActionType(event.target.value)}><option value="navigate">Navigate</option><option value="openOverlay">Open overlay</option><option value="closeOverlay">Close overlay</option><option value="setVariable">Set variable</option><option value="setComponentVariant">Change component variant</option></select></label></div>
          {(actionType === "navigate" || actionType === "openOverlay") && <label>Target page<select value={targetPageId} onChange={event => setTargetPageId(event.target.value)}>{document.pages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>}
          {actionType === "setVariable" && <div className="prototype-row"><select value={actionVariableId} onChange={event => setActionVariableId(event.target.value)}><option value="">Choose variable</option>{prototype.variables.map(variable => <option key={variable.id} value={variable.id}>{variable.name} ({variable.type})</option>)}</select>{prototype.variables.find(item => item.id === actionVariableId)?.type === "boolean" ? <select value={actionValue || "true"} onChange={event => setActionValue(event.target.value)}><option value="true">True</option><option value="false">False</option></select> : <input aria-label="Action value" placeholder="New value" value={actionValue} onChange={event => setActionValue(event.target.value)}/>}</div>}
          {actionType === "setComponentVariant" && <label>Variant<select value={variantId} onChange={event => setVariantId(event.target.value)} disabled={!component}><option value="">Choose variant</option>{component?.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>}
          {duplicateConnection && <small className="prototype-warning">This layer already has a {trigger} interaction.</small>}
          <button className="prototype-secondary" onClick={addInteraction} disabled={!selectedNode || Boolean(duplicateConnection) || (actionType === "setVariable" && !actionVariableId) || (actionType === "setComponentVariant" && (!component || !variantId))}>Add interaction</button>
          {prototype.connections.map(connection => <div className="prototype-list-row" key={connection.id}><span><b>{document.pages.find(page => page.id === connection.sourcePageId)?.name ?? "Missing page"} · {nodeLabel(findNode(document, connection.sourceNodeId))}</b><small>{connection.trigger} → {actionName(connection.action)}</small></span><button onClick={() => onChange({ ...prototype, connections: prototype.connections.filter(item => item.id !== connection.id) })} aria-label="Delete interaction">×</button></div>)}
        </section>
        <section className="prototype-section prototype-review" data-discovery-id="uds-prototype-preflight"><h3>UX & accessibility review</h3>{checks.map(check => <article key={check.label} className={`prototype-check prototype-${check.result}`}><b>{check.label}</b><small>{check.detail}</small></article>)}</section>
      </div>
    </section>
  </div>;
}

function findNode(document: DesignDocument, nodeId: string): DesignNode | undefined {
  const visit = (nodes: DesignNode[]): DesignNode | undefined => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if ("children" in node) { const found = visit(node.children); if (found) return found; }
    }
    return undefined;
  };
  for (const page of document.pages) { const found = visit(page.children); if (found) return found; }
}
