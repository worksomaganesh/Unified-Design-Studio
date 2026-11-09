import { type DesignDocument, type DesignNode } from "@uds/design-core";
import { renderDocument } from "./index.js";

export type ExportFinding = { severity: "info" | "warning"; code: string; message: string; location?: string };
export type CodeExportOptions = { htmlAssetPaths?: Record<string, string>; reactAssetPaths?: Record<string, string>; includeGitHandoff?: boolean };
export type CodeExportFiles = Record<string, string>;

export function buildGitHandoffFiles(): CodeExportFiles {
  return {
    ".gitignore": `.DS_Store\nThumbs.db\ndesktop.ini\n**/node_modules/\n**/dist/\n**/coverage/\n*.log\n*.tmp\n.env\n.env.*\n!.env.example\n`,
    "GIT_HANDOFF.md": `# Local Git handoff\n\nThis bundle is prepared for a local Git repository. No repository is initialized automatically, and these steps do not connect to GitHub or push anything.\n\n1. Extract this bundle into the folder you want to track.\n2. In PowerShell or a terminal, install the React project's dependencies so its lockfile is created:\n\n   \`\`\`powershell\n   Set-Location react\n   npm install\n   Set-Location ..\n   \`\`\`\n\n3. Initialize the repository, review its files, and make your first local commit: \`git status --short\`, then initialize and make your first local commit:\n\n   \`\`\`powershell\n   git init\n   git status --short\n   git add .\n   git commit -m "Initial design handoff"\n   \`\`\`\n\nGit may ask you to set \`user.name\` and \`user.email\` before the first commit. Configure those values for your account, then repeat the commit. Add a remote and push only when you choose to publish the repository.\n`,
  };
}
function flatten(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap(node => [node, ...( "children" in node ? flatten(node.children) : [])]);
}

export function collectImageSources(document: DesignDocument): string[] {
  const pageNodes = document.pages.flatMap(page => flatten(page.children));
  const componentNodes = document.designSystem.components.flatMap(component => flatten([component.root as DesignNode]));
  return [...new Set([...pageNodes, ...componentNodes].filter((node): node is Extract<DesignNode, { type: "image" }> => node.type === "image").map(node => node.src))];
}

export function inspectExportSupport(document: DesignDocument): ExportFinding[] {
  const findings: ExportFinding[] = [];
  const allNodes = [...document.pages.flatMap(page => flatten(page.children)), ...document.designSystem.components.flatMap(component => flatten([component.root as DesignNode]))];
  const lineShapes = allNodes.filter((node): node is Extract<DesignNode, { type: "shape" }> => node.type === "shape" && node.shape === "line").length;
  if (lineShapes) findings.push({ severity: "warning", code: "line-shape", message: `${lineShapes} line shape(s) are exported as filled rectangles; line-specific stroke styling is not yet supported.` });
  const externalImages = collectImageSources(document).filter(src => !/^\/api\/projects\/[^/]+\/assets\/[^/]+\/content$/.test(src));
  if (externalImages.length) findings.push({ severity: "warning", code: "external-image", message: `${externalImages.length} image source(s) are not project assets and will be omitted from the portable bundle.` });
  if (document.prototype.connections.length || document.prototype.variables.length || document.prototype.bindings.length) findings.push({ severity: "warning", code: "prototype-state", message: "Prototype interactions, variable values, and transitions are not included; exported screens show the current static design state." });
  if (document.designSystem.tokens.some(token => token.type !== "color")) findings.push({ severity: "info", code: "tokens-json", message: "All design tokens are included in JSON; only color tokens currently affect generated canvas styles." });
  if (document.designSystem.components.length) findings.push({ severity: "info", code: "components-static", message: "Component instances are rendered from their selected variant and current overrides as static UI." });
  if (document.designSystem.modes.length > 1) findings.push({ severity: "info", code: "active-mode", message: "Generated screens use the first design-system mode; every mode and its values remain in the token JSON." });
  if (!findings.length) findings.push({ severity: "info", code: "complete", message: "All document constructs used here are supported by the current static export." });
  return findings;
}

function mapImages(nodes: DesignNode[], paths: Record<string, string>): DesignNode[] {
  return nodes.map(node => {
    if (node.type === "image") return { ...node, src: paths[node.src] ?? "data:," };
    if ("children" in node) return { ...node, children: mapImages(node.children, paths) } as DesignNode;
    return node;
  });
}

function withImagePaths(document: DesignDocument, paths: Record<string, string>): DesignDocument {
  return {
    ...document,
    pages: document.pages.map(page => ({ ...page, children: mapImages(page.children, paths) })),
    designSystem: {
      ...document.designSystem,
      components: document.designSystem.components.map(component => ({ ...component, root: mapImages([component.root as DesignNode], paths)[0] })),
    },
  };
}

const jsonLiteral = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const appRuntime = String.raw`import React from "react";
import "./styles.css";

const designDocument = __DOCUMENT__;
function resolveToken(system, tokenId, modeId) {
  const tokens = new Map(system.tokens.map(token => [token.id, token]));
  const visited = new Set(); let token = tokens.get(tokenId);
  while (token && !visited.has(token.id)) {
    visited.add(token.id);
    if (modeId && token.modeValues?.[modeId]) return token.modeValues[modeId];
    if (token.aliasOf) { token = tokens.get(token.aliasOf); continue; }
    return token.value;
  }
}
function setProperty(nodes, property, value) {
  return nodes.map(node => {
    let next = node;
    if (node.id === property.targetNodeId) next = { ...node, [property.field]: value, ...(property.field === "color" && node.type === "text" ? { colorTokenId: undefined } : {}), ...(property.field === "fill" && node.type === "shape" ? { fillTokenId: undefined } : {}) };
    if (next.children) next = { ...next, children: setProperty(next.children, property, value) };
    return next;
  });
}
function componentRoot(system, instance) {
  const definition = system.components.find(component => component.id === instance.componentId);
  if (!definition) return null;
  const variant = definition.variants.find(item => item.id === instance.variants?.variant);
  let roots = [structuredClone(definition.root)];
  for (const property of definition.properties) {
    const value = instance.overrides?.[property.id] ?? variant?.values?.[property.id] ?? property.defaultValue;
    roots = setProperty(roots, property, value);
  }
  return roots[0];
}
function nodeStyle(node, system, modeId, flowItem) {
  const style = flowItem ? { position: "relative" } : { position: "absolute", left: node.x, top: node.y };
  if (node.type === "frame") Object.assign(style, { width: node.width, height: node.height, overflow: "hidden" });
  if (node.type === "container") {
    Object.assign(style, { width: node.width, height: node.height });
    if (node.layout.display === "flex") Object.assign(style, { display: "flex", flexDirection: node.layout.direction, gap: node.layout.gap, alignItems: node.layout.align, justifyContent: node.layout.justify });
    else if (node.layout.display === "grid") Object.assign(style, { display: "grid", gridTemplateColumns: node.layout.columns.join(" "), gap: node.layout.gap });
  }
  if (node.type === "text") { const value = node.colorTokenId ? resolveToken(system, node.colorTokenId, modeId) : null; Object.assign(style, { color: value?.type === "color" ? value.value : node.color, fontSize: node.fontSize }); }
  if (node.type === "image") Object.assign(style, { width: node.width, height: node.height, objectFit: node.fit });
  if (node.type === "shape") { const value = node.fillTokenId ? resolveToken(system, node.fillTokenId, modeId) : null; Object.assign(style, { width: node.width, height: node.height, background: value?.type === "color" ? value.value : node.fill, borderRadius: node.shape === "ellipse" ? "50%" : node.shape === "line" ? 0 : 5 }); }
  return style;
}
function NodeView({ node, system, modeId, flowItem = false }) {
  if (!node.visible) return null;
  const style = nodeStyle(node, system, modeId, flowItem);
  if (node.type === "text") return <span style={style}>{node.text}</span>;
  if (node.type === "image") return <img style={style} src={node.src} alt={node.alt} />;
  if (node.type === "shape") return <div style={style} aria-hidden="true" />;
  if (node.type === "component-instance") { const root = componentRoot(system, node); return <div style={style} data-component-id={node.componentId}>{root && <NodeView node={root} system={system} modeId={modeId} />}</div>; }
  const tag = node.type === "frame" ? "section" : "div";
  const flow = node.type === "container" && ["flex", "grid"].includes(node.layout.display);
  return React.createElement(tag, { style }, ...node.children.map(child => <NodeView key={child.id} node={child} system={system} modeId={modeId} flowItem={flow} />));
}
export default function App() {
  const system = designDocument.designSystem;
  const modeId = system.modes[0]?.id ?? "";
  return <div className="uds-export">{designDocument.pages.map(page => <main key={page.id} data-page-id={page.id} className="uds-page">{page.children.map(node => <NodeView key={node.id} node={node} system={system} modeId={modeId} />)}</main>)}</div>;
}`;

export function buildCodeExportFiles(document: DesignDocument, options: CodeExportOptions = {}): CodeExportFiles {
  const htmlDocument = withImagePaths(document, options.htmlAssetPaths ?? {});
  const reactDocument = withImagePaths(document, options.reactAssetPaths ?? {});
  const htmlBody = renderDocument(htmlDocument);
  const title = escapeHtml(document.metadata.name);
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body>${htmlBody}</body></html>`;
  const css = `*{box-sizing:border-box}html,body{margin:0;min-width:1280px;min-height:100%;font-family:Inter,Arial,sans-serif;background:#f2f3f6}[data-page-id]{position:relative;width:1280px;height:800px;overflow:hidden;background:#fff;margin:0 auto 32px}[data-node-type="text"]{white-space:pre-wrap}`;
  const findings = inspectExportSupport(document);
  const reactPackage = JSON.stringify({ name: "uds-developer-handoff", private: true, version: "1.0.0", type: "module", scripts: { dev: "vite --host 127.0.0.1", build: "vite build" }, dependencies: { vite: "^6.1.0", react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: {} }, null, 2);
  const reactIndex = `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`;
  const gitFiles = options.includeGitHandoff ? buildGitHandoffFiles() : {};
  const gitReadme = options.includeGitHandoff ? `\n- \`.gitignore\` and \`GIT_HANDOFF.md\` prepare the extracted folder for a local Git repository; no repository is initialized and nothing is published.\n` : "";
  const readme = `# ${document.metadata.name}\n\nGenerated from Unified Design Studio.\n\n- \`index.html\` and \`styles.css\` provide a static desktop export.\n- \`react/\` is a Vite + React project. From the bundle folder run \`cd react\`, \`npm install\`, then \`npm run dev\`. Use \`npm run build\` for a production build.\n- \`design-system/tokens.json\` contains the source design system.\n- \`export-report.json\` lists unsupported or static-only features.\n- Desktop artboard width: 1280px. Mobile and tablet layouts are not included.\n${gitReadme}`;
  return {
    "index.html": html,
    "styles.css": css,
    "react/package.json": reactPackage,
    "react/index.html": reactIndex,
    "react/src/main.jsx": `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\nimport "./styles.css";\ncreateRoot(document.getElementById("root")).render(<App />);\n`,
    "react/src/App.jsx": appRuntime.replace("__DOCUMENT__", jsonLiteral(reactDocument)),
    "react/src/styles.css": css,
    "design-system/tokens.json": JSON.stringify(document.designSystem, null, 2),
    "export-report.json": JSON.stringify({ generatedAt: new Date().toISOString(), findings, localGitHandoffIncluded: Boolean(options.includeGitHandoff) }, null, 2),
    "README.md": readme,
    ...gitFiles,
  };
}
