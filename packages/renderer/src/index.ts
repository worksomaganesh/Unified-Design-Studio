import { designTokenCssValue, resolveComponentInstance, resolveDesignToken, type DesignDocument, type DesignNode } from "@uds/design-core";

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const css = (node: DesignNode, document: DesignDocument, modeId: string, flowItem = false): string => {
  const position = flowItem ? "position:relative" : `position:absolute;left:${node.x}px;top:${node.y}px`;
  if (node.type === "container") {
    const l = node.layout;
    if (l.display === "flex") return `${position};display:flex;width:${node.width}px;height:${node.height}px;flex-direction:${l.direction};gap:${l.gap}px;align-items:${l.align};justify-content:${l.justify}`;
    if (l.display === "grid") return `${position};display:grid;width:${node.width}px;height:${node.height}px;grid-template-columns:${l.columns.join(" ")};gap:${l.gap}px`;
    return `${position};display:block;width:${node.width}px;height:${node.height}px`;
  }
  if (node.type === "frame") return `${position};width:${node.width}px;height:${node.height}px;overflow:hidden`;
  if (node.type === "text") {
    const token = node.colorTokenId ? resolveDesignToken(document.designSystem, node.colorTokenId, modeId) : undefined;
    const color = token?.type === "color" ? designTokenCssValue(token) : node.color;
    return `${position};color:${esc(color)};font-size:${node.fontSize}px`;
  }
  if (node.type === "image") return `${position};width:${node.width}px;height:${node.height}px;object-fit:${node.fit}`;
  if (node.type === "shape") {
    const token = node.fillTokenId ? resolveDesignToken(document.designSystem, node.fillTokenId, modeId) : undefined;
    const fill = token?.type === "color" ? designTokenCssValue(token) : node.fill;
    return `${position};width:${node.width}px;height:${node.height}px;background:${esc(fill)};border-radius:${node.shape === "ellipse" ? "50%" : node.shape === "line" ? "0" : "5px"}`;
  }
  return "";
};
function renderNode(n: DesignNode, document: DesignDocument, modeId: string, flowItem = false): string {
  if (!n.visible) return "";
  const style = css(n, document, modeId, flowItem);
  const attr = `data-node-id="${esc(n.id)}"${style ? ` style="${style}"` : ""}`;
  if (n.type === "text") return `<span ${attr} data-node-type="text">${esc(n.text)}</span>`;
  if (n.type === "image") return `<img ${attr} src="${esc(n.src)}" alt="${esc(n.alt)}">`;
  if (n.type === "shape") return `<div ${attr} aria-hidden="true"></div>`;
  if (n.type === "component-instance") {
    const resolved = resolveComponentInstance(document.designSystem, n);
    return `<div ${attr} data-component-id="${esc(n.componentId)}">${resolved ? renderNode(resolved, document, modeId) : ""}</div>`;
  }
  const flowChildren = n.type === "container" && (n.layout.display === "flex" || n.layout.display === "grid");
  return `<${n.type === "frame" ? "section" : "div"} ${attr}>${n.children.map((child: DesignNode) => renderNode(child, document, modeId, flowChildren)).join("")}</${n.type === "frame" ? "section" : "div"}>`;
}
/** Pure renderer: identical validated input produces identical markup. */
export function renderDocument(document: DesignDocument, modeId = document.designSystem.modes[0]?.id ?? ""): string {
  return document.pages.map(p => `<main data-page-id="${esc(p.id)}">${p.children.map(node => renderNode(node, document, modeId)).join("")}</main>`).join("");
}

export { buildCodeExportFiles, collectImageSources, inspectExportSupport, type CodeExportFiles, type ExportFinding } from "./codegen.js";
