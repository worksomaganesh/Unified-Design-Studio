import { useEffect, useMemo, useRef, useState } from "react";
import { type DesignDocument, type DesignNode } from "@uds/design-core";
import { renderDocument } from "@uds/renderer";
import "./prototype.css";

type Asset = { id: string; mimeType: string };
type Props = { document: DesignDocument; projectId: string; assets: Asset[]; startPageId: string; onClose: () => void };
type TriggerMessage = { type: "uds-trigger"; nodeId: string; trigger: "click" | "doubleClick" | "hover" };
const escapeAttr = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function PrototypePreview({ document, projectId, assets, startPageId, onClose }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [previewDocument, setPreviewDocument] = useState(document);
  const [activePageId, setActivePageId] = useState(startPageId);
  const [overlays, setOverlays] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string | number | boolean>>(() => Object.fromEntries(document.prototype.variables.map(variable => [variable.id, variable.initialValue])));

  const srcDoc = useMemo(() => {
    const allowedImages = new Set(assets.filter(asset => ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(asset.mimeType)).map(asset => `/api/projects/${projectId}/assets/${asset.id}/content`));
    const safeDocument = {
      ...previewDocument,
      designSystem: {
        ...previewDocument.designSystem,
        components: previewDocument.designSystem.components.map(component => ({ ...component, root: sanitizeImages([component.root], allowedImages)[0] })),
      },
      pages: previewDocument.pages.map(page => ({
        ...page,
        children: applyBindings(sanitizeImages(page.children, allowedImages), previewDocument.prototype.bindings, variables),
      })),
    };
    const visiblePageIds = new Set([activePageId, ...overlays]);
    const markup = safeDocument.pages.map(page => {
      let html = renderDocument({ ...safeDocument, pages: [page] });
      for (const connection of safeDocument.prototype.connections.filter(item => item.sourcePageId === page.id)) {
        const node = findNode(page.children, connection.sourceNodeId);
        if (!node) continue;
        const original = `data-node-id="${escapeAttr(node.id)}"`;
        const interactive = `${original} data-uds-prototype-control="true" role="button" tabindex="0" aria-label="${escapeAttr(node.name || node.type)}"`;
        html = html.replace(original, interactive);
      }
      const isOverlay = overlays.includes(page.id);
      const visible = visiblePageIds.has(page.id);
      return `<div class="page${isOverlay ? " overlay" : ""}" data-page="${escapeAttr(page.id)}" style="display:${visible ? "block" : "none"};${isOverlay ? `z-index:${10 + overlays.indexOf(page.id)};` : ""}">${html}${isOverlay ? '<button class="close-overlay" data-uds-close-overlay="true" aria-label="Close overlay">×</button>' : ""}</div>`;
    }).join("");
    const triggerScript = `(()=>{const send=(nodeId,trigger)=>parent.postMessage({type:"uds-trigger",nodeId,trigger},"*");document.addEventListener("click",e=>{if(e.target.closest("[data-uds-close-overlay]")){parent.postMessage({type:"uds-close-overlay"},"*");return}const n=e.target.closest("[data-uds-prototype-control]");if(n)send(n.dataset.nodeId,"click")});document.addEventListener("dblclick",e=>{const n=e.target.closest("[data-uds-prototype-control]");if(n)send(n.dataset.nodeId,"doubleClick")});document.addEventListener("mouseover",e=>{const n=e.target.closest("[data-uds-prototype-control]");if(n&&(!e.relatedTarget||!n.contains(e.relatedTarget)))send(n.dataset.nodeId,"hover")});document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-uds-prototype-control]")){e.preventDefault();send(e.target.dataset.nodeId,"click")}})})();`;
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: http://127.0.0.1:* http://localhost:* http://[::1]:*; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,Segoe UI,sans-serif;background:#eef0f5}.viewport{position:relative;min-height:100vh;padding:28px;overflow:auto}.page{position:relative;width:1280px;height:800px;margin:0 auto;background:white;overflow:hidden}.page main{position:relative;width:1280px;height:800px;overflow:hidden}.overlay{position:fixed!important;inset:28px;z-index:20!important;width:auto;height:auto;padding:0;background:#12121f66;display:grid!important;place-items:center}.overlay main{box-shadow:0 20px 60px #16152c55}.close-overlay{position:absolute;right:24px;top:24px;z-index:100;width:38px;height:38px;border:0;border-radius:50%;background:#fff;color:#34343c;font-size:24px;cursor:pointer}[data-uds-prototype-control]{cursor:pointer;outline-offset:3px}[data-uds-prototype-control]:focus-visible{outline:3px solid #5948dd}</style></head><body><div class="viewport">${markup}</div><script>${triggerScript}</script></body></html>`;
  }, [previewDocument, projectId, assets, activePageId, overlays, variables]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: string; nodeId?: unknown; trigger?: unknown };
      if (message.type === "uds-close-overlay") { setOverlays(current => current.slice(0, -1)); return; }
      if (message.type !== "uds-trigger" || typeof message.nodeId !== "string" || !["click", "doubleClick", "hover"].includes(String(message.trigger))) return;
      const sourcePageId = overlays.at(-1) ?? activePageId;
      const connection = previewDocument.prototype.connections.find(item => item.sourcePageId === sourcePageId && item.sourceNodeId === message.nodeId && item.trigger === message.trigger);
      if (!connection) return;
      const action = connection.action;
      if (action.type === "navigate") { setOverlays([]); setActivePageId(action.targetPageId); }
      else if (action.type === "openOverlay") setOverlays(current => [...current, action.targetPageId]);
      else if (action.type === "closeOverlay") setOverlays(current => current.slice(0, -1));
      else if (action.type === "setVariable") {
        setVariables(current => ({ ...current, [action.variableId]: action.value }));
      } else if (action.type === "setComponentVariant") {
        setPreviewDocument(current => ({ ...current, pages: current.pages.map(page => ({ ...page, children: updateNodes(page.children, node => node.id === action.nodeId && node.type === "component-instance" ? { ...node, variants: { ...node.variants, variant: action.variantId } } : node) })) }));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activePageId, overlays, previewDocument]);

  return <div className="prototype-preview-scrim"><section className="prototype-preview-dialog" role="dialog" aria-modal="true" aria-label="Clickable prototype preview"><header><div><b>Clickable prototype</b><small>Isolated preview · changes here do not modify the document</small></div><span>{String(Object.keys(variables).length)} variable(s)</span><button onClick={onClose}>Close preview</button></header><iframe ref={frame} title="Interactive prototype" sandbox="allow-scripts" srcDoc={srcDoc}/></section></div>;
}

function findNode(nodes: DesignNode[], id: string): DesignNode | undefined {
  for (const node of nodes) { if (node.id === id) return node; if ("children" in node) { const found = findNode(node.children, id); if (found) return found; } }
}

function updateNodes(nodes: DesignNode[], update: (node: DesignNode) => DesignNode): DesignNode[] {
  return nodes.map(node => {
    const changed = update(node);
    return "children" in changed ? { ...changed, children: updateNodes(changed.children, update) } as DesignNode : changed;
  });
}

function sanitizeImages(nodes: DesignNode[], allowed: Set<string>): DesignNode[] {
  return nodes.map(node => {
    if (node.type === "image") return { ...node, src: allowed.has(node.src) ? node.src : "data:," };
    if ("children" in node) return { ...node, children: sanitizeImages(node.children, allowed) } as DesignNode;
    return node;
  });
}

function applyBindings(nodes: DesignNode[], bindings: DesignDocument["prototype"]["bindings"], values: Record<string, string | number | boolean>): DesignNode[] {
  return nodes.map(node => {
    if (node.type === "text") {
      const binding = bindings.find(item => item.nodeId === node.id);
      if (binding && values[binding.variableId] !== undefined) return { ...node, text: String(values[binding.variableId]) };
    }
    if ("children" in node) return { ...node, children: applyBindings(node.children, bindings, values) } as DesignNode;
    return node;
  });
}
