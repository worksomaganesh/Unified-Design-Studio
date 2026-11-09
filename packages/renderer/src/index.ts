import type { DesignDocument, DesignNode } from "@uds/design-core";

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const css = (node: DesignNode): string => {
  if (node.type === "container") {
    const l = node.layout;
    if (l.display === "flex") return `display:flex;flex-direction:${l.direction};gap:${l.gap}px;align-items:${l.align};justify-content:${l.justify}`;
    if (l.display === "grid") return `display:grid;grid-template-columns:${l.columns.join(" ")};gap:${l.gap}px`;
  }
  if (node.type === "frame") return `width:${node.width}px;height:${node.height}px;overflow:hidden;position:relative`;
  if (node.type === "text") return `color:${esc(node.color)};font-size:${node.fontSize}px`;
  if (node.type === "image") return `object-fit:${node.fit}`;
  if (node.type === "shape") return `width:${node.width}px;height:${node.height}px;background:${esc(node.fill)};border-radius:${node.shape === "ellipse" ? "50%" : "0"}`;
  return "";
};
function renderNode(n: DesignNode): string {
  if (!n.visible) return "";
  const style = css(n);
  const attr = `data-node-id="${esc(n.id)}"${style ? ` style="${style}"` : ""}`;
  if (n.type === "text") return `<span ${attr}>${esc(n.text)}</span>`;
  if (n.type === "image") return `<img ${attr} src="${esc(n.src)}" alt="${esc(n.alt)}">`;
  if (n.type === "shape") return `<div ${attr} aria-hidden="true"></div>`;
  if (n.type === "component-instance") return `<div ${attr} data-component-id="${esc(n.componentId)}"></div>`;
  return `<${n.type === "frame" ? "section" : "div"} ${attr}>${n.children.map(renderNode).join("")}</${n.type === "frame" ? "section" : "div"}>`;
}
/** Pure renderer: identical validated input produces identical markup. */
export function renderDocument(document: DesignDocument): string {
  return document.pages.map(p => `<main data-page-id="${esc(p.id)}">${p.children.map(renderNode).join("")}</main>`).join("");
}
