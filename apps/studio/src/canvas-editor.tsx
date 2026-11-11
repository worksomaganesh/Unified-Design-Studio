import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { DesignDocumentSchema, designTokenCssValue, resolveComponentInstance, resolveDesignToken, type ComponentDefinition, type ComponentProperty, type DesignDocument, type DesignNode, type DesignSystem, type Prototype } from "@uds/design-core";
import { type AIPatchOperation, type PatchProposal } from "@uds/ai-engine";
import { ContextualGuide, DiscoveryLauncher, useRegisterDiscoveryActions } from "./discovery/DiscoveryProvider";
import "./conflict-recovery.css";
import "./panel-loading.css";

const DesignSystemPanel = lazy(() => import("./design-system-panel").then(module => ({ default: module.DesignSystemPanel })));
const AIStudioPanel = lazy(() => import("./ai-studio-panel").then(module => ({ default: module.AIStudioPanel })));
const PrototypePanel = lazy(() => import("./prototype-panel").then(module => ({ default: module.PrototypePanel })));
const PrototypePreview = lazy(() => import("./prototype-preview").then(module => ({ default: module.PrototypePreview })));
const CodeHandoffPanel = lazy(() => import("./code-handoff-panel").then(module => ({ default: module.CodeHandoffPanel })));
const ReviewPanel = lazy(() => import("./review-panel").then(module => ({ default: module.ReviewPanel })));

type Asset = { id: string; name: string; mimeType: string; size: number; kind?: "image" | "reference" };
type Props = { projectId: string; initial: DesignDocument; assets: Asset[]; onExit: () => void };
type Viewport = "laptop" | "desktop" | "wide";
type Page = DesignDocument["pages"][number];
type SaveConflict = { currentRevision?: number };
type Drag = {
  id: string;
  pageId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  resize: boolean;
  before: DesignDocument;
  changed: boolean;
};

const size: Record<Viewport, [number, number]> = { laptop: [1280, 800], desktop: [1440, 900], wide: [1920, 1080] };
const freshId = () => crypto.randomUUID();
const nodeName = (node: DesignNode) => node.name || `${node.type[0].toUpperCase()}${node.type.slice(1)}`;

function findNode(nodes: DesignNode[], id: string): DesignNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if ("children" in node) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
}

function changeNode(nodes: DesignNode[], id: string, change: (node: DesignNode) => DesignNode): DesignNode[] {
  return nodes.map(node => node.id === id
    ? change(node)
    : "children" in node ? { ...node, children: changeNode(node.children, id, change) } as DesignNode : node);
}

function removeNodes(nodes: DesignNode[], ids: Set<string>): DesignNode[] {
  return nodes.filter(node => !ids.has(node.id)).map(node =>
    "children" in node ? { ...node, children: removeNodes(node.children, ids) } as DesignNode : node);
}

function flatten(nodes: DesignNode[], depth = 0): { node: DesignNode; depth: number }[] {
  return nodes.flatMap(node => [{ node, depth }, ...( "children" in node ? flatten(node.children, depth + 1) : [])]);
}

function pageChildren(document: DesignDocument, pageId: string, children: DesignNode[]): DesignDocument {
  return { ...document, pages: document.pages.map(page => page.id === pageId ? { ...page, children } : page) };
}

function findSiblingList(nodes: DesignNode[], ids: Set<string>): DesignNode[] | undefined {
  if ([...ids].every(id => nodes.some(node => node.id === id))) return nodes;
  for (const node of nodes) {
    if ("children" in node) {
      const found = findSiblingList(node.children, ids);
      if (found) return found;
    }
  }
}

function replaceSiblingList(nodes: DesignNode[], target: DesignNode[], replacement: DesignNode[]): DesignNode[] {
  if (nodes === target) return replacement;
  return nodes.map(node => "children" in node
    ? { ...node, children: replaceSiblingList(node.children, target, replacement) } as DesignNode
    : node);
}

function dimensions(node: DesignNode): [number, number] {
  if ("width" in node && "height" in node) return [Number(node.width), Number(node.height)];
  if (node.type === "text") return [Math.max(40, node.text.length * node.fontSize * 0.58), node.fontSize * 1.5];
  return [220, 120];
}

function colorFor(system: DesignSystem, tokenId: string | undefined, modeId: string, fallback: string): string {
  const token = tokenId ? resolveDesignToken(system, tokenId, modeId) : undefined;
  return token?.type === "color" ? designTokenCssValue(token) : fallback;
}

export function CanvasEditor({ projectId, initial, assets, onExit }: Props) {
  const [document, setDocument] = useState(initial);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePageId, setActivePageId] = useState(initial.pages[0].id);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [zoom, setZoom] = useState(0.62);
  const [pan, setPan] = useState({ x: 32, y: 42 });
  const [saving, setSaving] = useState(false);
  const [designSystemOpen, setDesignSystemOpen] = useState(false);
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [prototypeOpen, setPrototypeOpen] = useState(false);
  const [prototypePreviewOpen, setPrototypePreviewOpen] = useState(false);
  const [codeHandoffOpen, setCodeHandoffOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<"comments" | "revisions">("comments");
  const [activeModeId, setActiveModeId] = useState(initial.designSystem.modes[0]?.id ?? "");
  const [status, setStatus] = useState("All changes saved");
  const [saveConflict, setSaveConflict] = useState<SaveConflict | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [conflictError, setConflictError] = useState("");
  const [conflictNotice, setConflictNotice] = useState("");
  const [undoStack, setUndoStack] = useState<DesignDocument[]>([]);
  const [redoStack, setRedoStack] = useState<DesignDocument[]>([]);
  const [panMode, setPanMode] = useState(false);
  const drag = useRef<Drag | null>(null);
  const panDrag = useRef<{ x: number; y: number } | null>(null);
  const changeVersion = useRef(0);
  const savedVersion = useRef(0);
  const closeDiscoveryPanels = () => {
    setDesignSystemOpen(false);
    setAiStudioOpen(false);
    setPrototypeOpen(false);
    setPrototypePreviewOpen(false);
    setCodeHandoffOpen(false);
    setReviewOpen(false);
  };
  useRegisterDiscoveryActions({
    "editor.canvas": () => { closeDiscoveryPanels(); return true; },
    "editor.ai": () => { closeDiscoveryPanels(); setAiStudioOpen(true); return true; },
    "editor.design-system": () => { closeDiscoveryPanels(); setDesignSystemOpen(true); return true; },
    "editor.prototype": () => { closeDiscoveryPanels(); setPrototypeOpen(true); return true; },
    "editor.review": () => { closeDiscoveryPanels(); setReviewTab("comments"); setReviewOpen(true); return true; },
    "editor.history": () => { closeDiscoveryPanels(); setReviewTab("revisions"); setReviewOpen(true); return true; },
    "editor.handoff": () => { closeDiscoveryPanels(); setCodeHandoffOpen(true); return true; }
  });

  const page = document.pages.find(item => item.id === activePageId) ?? document.pages[0];
  const nodes = page?.children ?? [];
  const layers = useMemo(() => flatten(nodes), [nodes]);
  const selectedId = selectedIds[0] ?? null;
  const selectedNode = selectedIds.length === 1 && selectedId ? findNode(nodes, selectedId) : undefined;
  const selectedNodes = selectedIds.map(id => findNode(nodes, id)).filter((node): node is DesignNode => Boolean(node));
  const modeId = document.designSystem.modes.some(mode => mode.id === activeModeId) ? activeModeId : document.designSystem.modes[0]?.id ?? "";
  const [width, height] = size[viewport];
  const imageAssets = assets.filter(asset => ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(asset.mimeType));

  function commit(next: DesignDocument) {
    changeVersion.current += 1;
    setUndoStack(stack => [...stack.slice(-49), document]);
    setRedoStack([]);
    setDocument(next);
    setStatus("Unsaved changes");
  }

  function patch(id: string, values: Partial<DesignNode>) {
    commit(pageChildren(document, page.id, changeNode(nodes, id, node => ({ ...node, ...values }) as DesignNode)));
  }

  function updateDesignSystem(next: DesignSystem): boolean {
    const candidate = DesignDocumentSchema.safeParse({ ...document, designSystem: next });
    if (!candidate.success) { setStatus(`Design-system change rejected: ${candidate.error.issues[0]?.message ?? "invalid reference"}`); return false; }
    commit(candidate.data);
    if (!next.modes.some(mode => mode.id === activeModeId)) setActiveModeId(next.modes[0]?.id ?? "");
    return true;
  }

  function updatePrototype(next: Prototype) {
    const candidate = DesignDocumentSchema.safeParse({ ...document, prototype: next });
    if (!candidate.success) { setStatus(`Prototype change rejected: ${candidate.error.issues[0]?.message ?? "invalid interaction"}`); return; }
    commit(candidate.data);
  }

  function createComponentFromSelection() {
    if (!selectedNode || selectedNode.type === "component-instance") return;
    const cloneNode = (item: DesignNode): DesignNode => {
      const id = freshId();
      const cloned = { ...item, id, ...( "children" in item ? { children: item.children.map(cloneNode) } : {}) } as DesignNode;
      return cloned;
    };
    const rawRoot = cloneNode(selectedNode);
    const root = { ...rawRoot, x: 0, y: 0 } as DesignNode;
    const property: ComponentDefinition["properties"] = [];
    const eachNode = (item: DesignNode, visit: (node: DesignNode) => void) => {
      visit(item);
      if ("children" in item) item.children.forEach((child: DesignNode) => eachNode(child, visit));
    };
    let containsInstance = false;
    eachNode(root, item => { if (item.type === "component-instance") containsInstance = true; });
    if (containsInstance) { setStatus("Create components from layers without existing component instances."); return; }
    eachNode(root, item => {
      const targetNodeId = item.id;
      if (item.type === "text") {
        property.push({ id: freshId(), name: `${item.name || "Text"} content`, type: "text", targetNodeId, field: "text", defaultValue: item.text });
        property.push({ id: freshId(), name: `${item.name || "Text"} color`, type: "color", targetNodeId, field: "color", defaultValue: item.color });
        property.push({ id: freshId(), name: `${item.name || "Text"} size`, type: "number", targetNodeId, field: "fontSize", defaultValue: item.fontSize });
      }
      if (item.type === "shape") property.push({ id: freshId(), name: `${item.name || "Shape"} fill`, type: "color", targetNodeId, field: "fill", defaultValue: item.fill });
      property.push({ id: freshId(), name: `${item.name || "Layer"} visibility`, type: "boolean", targetNodeId, field: "visible", defaultValue: item.visible });
    });
    const baseName = selectedNode.name.trim() || "Component";
    let componentName = baseName;
    let suffix = 2;
    while (document.designSystem.components.some(item => item.name.toLocaleLowerCase() === componentName.toLocaleLowerCase())) componentName = `${baseName} ${suffix++}`;
    const component: ComponentDefinition = { id: freshId(), name: componentName, root, properties: property, variants: [] };
    const instance: DesignNode = { id: selectedNode.id, name: selectedNode.name, type: "component-instance", visible: selectedNode.visible, locked: selectedNode.locked, x: selectedNode.x, y: selectedNode.y, componentId: component.id, overrides: {}, variants: {} };
    const next = pageChildren(document, page.id, changeNode(nodes, selectedNode.id, () => instance));
    const candidate = DesignDocumentSchema.safeParse({ ...next, designSystem: { ...document.designSystem, components: [...document.designSystem.components, component] } });
    if (!candidate.success) { setStatus(`Component could not be created: ${candidate.error.issues[0]?.message ?? "invalid definition"}`); return; }
    commit(candidate.data);
    setSelectedIds([instance.id]);
    setStatus("Component created");
  }

  function deleteDesignToken(tokenId: string) {
    const resolved = resolveDesignToken(document.designSystem, tokenId, modeId);
    const fallbackColor = resolved?.type === "color" ? designTokenCssValue(resolved) : undefined;
    const tokens = document.designSystem.tokens
      .filter(token => token.id !== tokenId)
      .map(token => token.aliasOf === tokenId ? { ...token, aliasOf: undefined } : token);
    const clearReferences = (items: DesignNode[]): DesignNode[] => items.map(item => {
      let next = item;
      if (item.type === "text" && item.colorTokenId === tokenId) { const { colorTokenId: _removed, ...rest } = item; next = { ...rest, ...(fallbackColor ? { color: fallbackColor } : {}) } as DesignNode; }
      if (item.type === "shape" && item.fillTokenId === tokenId) { const { fillTokenId: _removed, ...rest } = item; next = { ...rest, ...(fallbackColor ? { fill: fallbackColor } : {}) } as DesignNode; }
      if ("children" in next) next = { ...next, children: clearReferences(next.children) } as DesignNode;
      return next;
    });
    const components = document.designSystem.components.map(component => {
      const [root] = clearReferences([component.root as DesignNode]);
      return { ...component, root };
    });
    commit({ ...document, designSystem: { ...document.designSystem, tokens, components }, pages: document.pages.map(item => ({ ...item, children: clearReferences(item.children) })) });
  }

  function applyColorToken(node: DesignNode, tokenId: string) {
    const token = tokenId ? resolveDesignToken(document.designSystem, tokenId, modeId) : undefined;
    const color = token?.type === "color" ? designTokenCssValue(token) : undefined;
    if (node.type === "text") patch(node.id, { colorTokenId: tokenId || undefined, ...(color ? { color } : {}) });
    if (node.type === "shape") patch(node.id, { fillTokenId: tokenId || undefined, ...(color ? { fill: color } : {}) });
  }

  function applyGeneratedPages(pages: DesignDocument["pages"], baseRevision: number, baseLocalVersion: number): boolean {
    if (document.revision !== baseRevision || changeVersion.current !== baseLocalVersion) return false;
    const candidate = DesignDocumentSchema.safeParse({ ...document, pages: [...document.pages, ...pages] });
    if (!candidate.success) { setStatus(`Generated screens were rejected: ${candidate.error.issues[0]?.message ?? "invalid document"}`); return false; }
    commit(candidate.data);
    setActivePageId(pages[0]?.id ?? document.pages[0].id);
    setSelectedIds([]);
    return true;
  }

  function applyFigmaImport(pages: DesignDocument["pages"], designSystem: DesignSystem, baseRevision: number, baseLocalVersion: number): boolean {
    if (document.revision !== baseRevision || changeVersion.current !== baseLocalVersion || !pages.length) return false;
    const candidate = DesignDocumentSchema.safeParse({ ...document, pages: [...document.pages, ...pages], designSystem });
    if (!candidate.success) { setStatus(`Figma import rejected: ${candidate.error.issues[0]?.message ?? "invalid document"}`); return false; }
    commit(candidate.data);
    setActivePageId(pages[0].id);
    setSelectedIds([]);
    return true;
  }

  function applyAIProposal(_proposal: PatchProposal, operations: AIPatchOperation[], baseRevision: number, baseLocalVersion: number): boolean {
    if (document.revision !== baseRevision || changeVersion.current !== baseLocalVersion) return false;
    if (operations.some(operation => !findNode(nodes, operation.nodeId))) return false;
    let nextChildren = nodes;
    for (const operation of operations) {
      nextChildren = changeNode(nextChildren, operation.nodeId, node => {
        if (operation.op === "setText" && node.type === "text") return { ...node, text: operation.value };
        if (operation.op === "setFill" && node.type === "shape") return { ...node, fill: operation.value, fillTokenId: undefined };
        if (operation.op === "setColor" && node.type === "text") return { ...node, color: operation.value, colorTokenId: undefined };
        if (operation.op === "setFontSize" && node.type === "text") return { ...node, fontSize: operation.value };
        if (operation.op === "setName") return { ...node, name: operation.value } as DesignNode;
        return node;
      });
    }
    const candidate = DesignDocumentSchema.safeParse(pageChildren(document, page.id, nextChildren));
    if (!candidate.success) { setStatus(`AI changes were rejected: ${candidate.error.issues[0]?.message ?? "invalid document"}`); return false; }
    commit(candidate.data);
    return true;
  }

  function add(type: "text" | "shape" | "container" | "frame" | "image") {
    if (type === "image" && !imageAssets.length) { setStatus("Import a PNG, JPEG, WebP, or GIF asset in the project workspace first."); return; }
    const base = { id: freshId(), name: type === "text" ? "Heading" : `${type[0].toUpperCase()}${type.slice(1)}`, visible: true, locked: false, x: 36 + nodes.length * 18, y: 36 + nodes.length * 18 };
    const newNode: DesignNode = type === "text" ? { ...base, type, text: "Double-click to edit", fontSize: 28, color: "#1f2937" }
      : type === "shape" ? { ...base, type, shape: "rectangle", fill: "#ddd8ff", width: 180, height: 112 }
      : type === "frame" ? { ...base, type, width: 640, height: 420, children: [] }
      : type === "image" ? { ...base, type, src: `/api/projects/${projectId}/assets/${imageAssets[0].id}/content`, alt: imageAssets[0].name, fit: "contain", width: 320, height: 200 }
      : { ...base, type, layout: { display: "flex", direction: "column", gap: 12, align: "stretch", justify: "start" }, width: 320, height: 220, children: [] };
    const parent = selectedNode && "children" in selectedNode ? selectedNode.id : null;
    const nextChildren = parent ? changeNode(nodes, parent, node => ({ ...node, children: [...node.children, newNode] }) as DesignNode) : [...nodes, newNode];
    commit(pageChildren(document, page.id, nextChildren));
    setSelectedIds([newNode.id]);
  }

  function addPage() {
    const nextPage = { id: freshId(), name: `Page ${document.pages.length + 1}`, children: [] };
    commit({ ...document, pages: [...document.pages, nextPage] });
    setActivePageId(nextPage.id);
    setSelectedIds([]);
  }

  function renamePage(target: Page) {
    const name = window.prompt("Page name", target.name)?.trim();
    if (!name || name === target.name) return;
    commit({ ...document, pages: document.pages.map(item => item.id === target.id ? { ...item, name } : item) });
  }

  function deletePage(target: Page) {
    if (document.pages.length < 2) { setStatus("A document must have at least one page."); return; }
    if (!window.confirm(`Delete “${target.name}” and its layers?`)) return;
    const pages = document.pages.filter(item => item.id !== target.id);
    commit({ ...document, pages });
    if (target.id === activePageId) setActivePageId(pages[0].id);
    setSelectedIds([]);
  }

  function groupSelection() {
    const ids = new Set(selectedIds);
    if (ids.size < 2) return;
    const siblings = findSiblingList(nodes, ids);
    if (!siblings) { setStatus("Group layers together only when they share the same parent."); return; }
    const selected = siblings.filter(node => ids.has(node.id));
    const minX = Math.min(...selected.map(node => node.x));
    const minY = Math.min(...selected.map(node => node.y));
    const maxX = Math.max(...selected.map(node => node.x + dimensions(node)[0]));
    const maxY = Math.max(...selected.map(node => node.y + dimensions(node)[1]));
    const groupId = freshId();
    const groupedChildren = selected.map(node => ({ ...node, x: node.x - minX, y: node.y - minY }) as DesignNode);
    const group: DesignNode = {
      id: groupId, name: "Group", type: "container", visible: true, locked: false, x: minX, y: minY,
      width: Math.max(24, maxX - minX), height: Math.max(24, maxY - minY),
      layout: { display: "block" }, children: groupedChildren,
    };
    const replacement: DesignNode[] = [];
    let inserted = false;
    for (const node of siblings) {
      if (ids.has(node.id)) {
        if (!inserted) { replacement.push(group); inserted = true; }
      } else replacement.push(node);
    }
    commit(pageChildren(document, page.id, replaceSiblingList(nodes, siblings, replacement)));
    setSelectedIds([groupId]);
  }

  async function save(): Promise<boolean> {
    if (saving || saveConflict) return false;
    if (changeVersion.current === savedVersion.current) { setStatus("All changes saved"); return true; }
    const saveVersion = changeVersion.current;
    setSaving(true); setStatus("Saving…");
    try {
      const snapshot = document;
      const response = await fetch(`/api/projects/${projectId}/document`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(snapshot) });
      const body = await response.json().catch(() => null) as { error?: string; currentRevision?: number; revision?: number; metadata?: DesignDocument["metadata"] } | null;
      if (response.status === 409) {
        setSaveConflict({ currentRevision: Number.isSafeInteger(body?.currentRevision) ? body!.currentRevision : undefined });
        setConflictError("");
        setConflictNotice("");
        setStatus("Revision conflict · local changes preserved");
        return false;
      }
      if (!response.ok) throw new Error(body?.error ?? "Save failed");
      setDocument(current => {
        const editsRemain = JSON.stringify(current) !== JSON.stringify(snapshot);
        return editsRemain ? { ...current, revision: body!.revision!, metadata: body!.metadata! } : body as DesignDocument;
      });
      const currentVersionSaved = changeVersion.current === saveVersion;
      savedVersion.current = saveVersion;
      setStatus(currentVersionSaved ? "All changes saved" : "Newer changes still need saving");
      return currentVersionSaved;
    } catch (error) { setStatus((error as Error).message); return false; }
    finally { setSaving(false); }
  }

  function downloadLocalDraft() {
    setConflictError("");
    setConflictNotice("");
    try {
      const slug = (document.metadata.name || "design").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").slice(0, 72) || "design";
      const blobUrl = window.URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
      const link = window.document.createElement("a");
      link.href = blobUrl;
      link.download = `UDS-${slug}-local-draft-based-on-r${document.revision}.json`;
      window.document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      setConflictNotice("Draft backup downloaded. Keep it before choosing to replace your local draft.");
    } catch {
      setConflictError("Could not create the draft backup. Your local changes are still open in this editor.");
    }
  }

  async function loadLatestSavedVersion() {
    if (conflictBusy) return;
    setConflictBusy(true);
    setConflictError("");
    setConflictNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const body = await response.json().catch(() => null) as { error?: string; document?: unknown } | null;
      if (!response.ok || !body?.document) throw new Error(body?.error ?? "Could not load the latest saved version.");
      const parsed = DesignDocumentSchema.safeParse(body.document);
      if (!parsed.success) throw new Error("The latest saved version did not pass document validation. Your local draft remains open.");
      const latest = parsed.data;
      changeVersion.current += 1;
      savedVersion.current = changeVersion.current;
      setDocument(latest);
      setUndoStack([]);
      setRedoStack([]);
      setActivePageId(current => latest.pages.some(item => item.id === current) ? current : latest.pages[0].id);
      setSelectedIds([]);
      setSaveConflict(null);
      setStatus(`Loaded saved revision ${latest.revision}`);
    } catch (error) {
      setConflictError((error as Error).message || "Could not load the latest saved version. Your local draft remains open.");
    } finally {
      setConflictBusy(false);
    }
  }

  function keepEditingAfterConflict() {
    setSaveConflict(null);
    setConflictError("");
    setConflictNotice("");
    setStatus("Revision conflict · local draft kept");
  }

  async function prepareReviewAnchor(): Promise<{ documentId: string; revision: number; pageId: string; nodeId?: string } | null> {
    if (!(await save())) return null;
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const body = await response.json();
      if (!response.ok || !body.document) throw new Error(body.error ?? "Could not load the saved project revision.");
      const saved = body.document as DesignDocument;
      const savedPage = saved.pages.find(item => item.id === page.id);
      if (!savedPage) throw new Error("Save or reopen the page before adding a review comment.");
      if (selectedNode && !findNode(savedPage.children, selectedNode.id)) throw new Error("Save this layer before attaching a review comment to it.");
      return { documentId: saved.documentId, revision: saved.revision, pageId: savedPage.id, ...(selectedNode ? { nodeId: selectedNode.id } : {}) };
    } catch (error) { setStatus((error as Error).message); return null; }
  }

  async function restoreRevision(documentId: string, revision: number) {
    try {
      if (changeVersion.current !== savedVersion.current && !(await save())) return;
      const query = new URLSearchParams({ documentId });
      const restored = await fetch(`/api/projects/${projectId}/revisions/${encodeURIComponent(revision)}/restore?${query}`, { method: "POST" }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Restore failed"); return body as DesignDocument; });
      changeVersion.current += 1;
      savedVersion.current = changeVersion.current;
      setUndoStack(stack => [...stack, document]); setRedoStack([]); setDocument(restored);
      setActivePageId(restored.pages[0].id); setSelectedIds([]); setStatus(`Restored as revision ${restored.revision}`);
      setReviewOpen(false);
    } catch (error) { setStatus((error as Error).message); throw error; }
  }

  function undo() {
    if (!undoStack.length) return;
    const previous = undoStack.at(-1)!;
    changeVersion.current += 1;
    setRedoStack(stack => [...stack, document]); setUndoStack(stack => stack.slice(0, -1));
    setDocument({ ...previous, revision: document.revision });
    setActivePageId(current => previous.pages.some(item => item.id === current) ? current : previous.pages[0].id);
    setSelectedIds([]); setStatus("Unsaved changes");
  }

  function redo() {
    if (!redoStack.length) return;
    const next = redoStack.at(-1)!;
    changeVersion.current += 1;
    setUndoStack(stack => [...stack, document]); setRedoStack(stack => stack.slice(0, -1));
    setDocument({ ...next, revision: document.revision });
    setActivePageId(current => next.pages.some(item => item.id === current) ? current : next.pages[0].id);
    setSelectedIds([]); setStatus("Unsaved changes");
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || saveConflict) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save(); }
      if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (!typing && event.key === "Delete" && selectedIds.length) {
        commit(pageChildren(document, page.id, removeNodes(nodes, new Set(selectedIds)))); setSelectedIds([]);
      }
      if (event.key === "Escape") setSelectedIds([]);
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [document, nodes, page, selectedIds, undoStack, redoStack, saveConflict]);

  function onPointerMove(event: React.PointerEvent) {
    if (panDrag.current) {
      const deltaX = event.clientX - panDrag.current.x;
      const deltaY = event.clientY - panDrag.current.y;
      setPan(current => ({ x: current.x + deltaX, y: current.y + deltaY }));
      panDrag.current = { x: event.clientX, y: event.clientY };
      return;
    }
    const currentDrag = drag.current;
    if (!currentDrag) return;
    const dx = (event.clientX - currentDrag.startX) / zoom;
    const dy = (event.clientY - currentDrag.startY) / zoom;
    setDocument(current => {
      const dragPage = current.pages.find(item => item.id === currentDrag.pageId);
      if (!dragPage || !findNode(dragPage.children, currentDrag.id)) return current;
      const values = currentDrag.resize
        ? { width: Math.max(24, currentDrag.width + dx), height: Math.max(24, currentDrag.height + dy) }
        : { x: currentDrag.x + dx, y: currentDrag.y + dy };
      return pageChildren(current, currentDrag.pageId, changeNode(dragPage.children, currentDrag.id, node => ({ ...node, ...values }) as DesignNode));
    });
    changeVersion.current += 1;
    currentDrag.changed = true;
    setStatus("Unsaved changes");
  }

  function finishPointer() {
    if (drag.current?.changed) {
      const before = drag.current.before;
      setUndoStack(stack => [...stack.slice(-49), before]);
      setRedoStack([]);
    }
    drag.current = null;
    panDrag.current = null;
  }

  function startDrag(target: DesignNode, event: React.PointerEvent<HTMLDivElement>, resize = false) {
    if (target.locked || panMode) return;
    const [nodeWidth, nodeHeight] = dimensions(target);
    setSelectedIds([target.id]);
    drag.current = {
      id: target.id, pageId: page.id, startX: event.clientX, startY: event.clientY,
      x: target.x, y: target.y, width: nodeWidth, height: nodeHeight, resize, before: document, changed: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateLayout(display: "block" | "flex" | "grid") {
    if (selectedNode?.type !== "container") return;
    const layout = display === "block" ? { display: "block" as const }
      : display === "flex" ? { display: "flex" as const, direction: "column" as const, gap: 12, align: "stretch" as const, justify: "start" as const }
      : { display: "grid" as const, columns: ["1fr", "1fr"], gap: 12 };
    patch(selectedNode.id, { layout });
  }

  function updateFlexLayout(values: Record<string, unknown>) {
    if (selectedNode?.type !== "container" || selectedNode.layout.display !== "flex") return;
    patch(selectedNode.id, { layout: { ...selectedNode.layout, ...values } });
  }

  function updateGridLayout(values: Record<string, unknown>) {
    if (selectedNode?.type !== "container" || selectedNode.layout.display !== "grid") return;
    patch(selectedNode.id, { layout: { ...selectedNode.layout, ...values } });
  }

  return <div className="editor-shell">
    {saveConflict && <SaveConflictDialog localRevision={document.revision} currentRevision={saveConflict.currentRevision} busy={conflictBusy} error={conflictError} notice={conflictNotice} onKeepEditing={keepEditingAfterConflict} onDownloadDraft={downloadLocalDraft} onLoadLatest={() => void loadLatestSavedVersion()}/>}
    <Suspense fallback={<div className="editor-panel-loading" role="status" aria-live="polite">Opening workspace panel…</div>}>
    {designSystemOpen && <><DesignSystemPanel projectId={projectId} documentRevision={document.revision} localVersion={changeVersion.current} system={document.designSystem} activeModeId={modeId} selectedNode={selectedNode} onApplyToken={tokenId => selectedNode && applyColorToken(selectedNode, tokenId)} onModeChange={setActiveModeId} onChange={updateDesignSystem} onImportFigma={applyFigmaImport} onDeleteToken={deleteDesignToken} onCreateComponent={createComponentFromSelection} onClose={() => setDesignSystemOpen(false)}/><ContextualGuide id="guide-design-tokens"/></>}
    {aiStudioOpen && <><AIStudioPanel projectId={projectId} document={document} pageId={page.id} selectedNodes={selectedNodes} assets={assets} localVersion={changeVersion.current} onApplyDirection={applyGeneratedPages} onApplyPatch={applyAIProposal} onClose={() => setAiStudioOpen(false)}/><ContextualGuide id="guide-ai-brief"/></>}
    {prototypeOpen && <><PrototypePanel document={document} pageId={page.id} selectedNode={selectedNode} onChange={updatePrototype} onPreview={() => { setPrototypeOpen(false); setPrototypePreviewOpen(true); }} onClose={() => setPrototypeOpen(false)}/><ContextualGuide id="guide-prototype-interactions"/></>}
    {prototypePreviewOpen && <PrototypePreview document={document} projectId={projectId} assets={assets} startPageId={page.id} onClose={() => setPrototypePreviewOpen(false)}/>}
    {codeHandoffOpen && <CodeHandoffPanel projectId={projectId} document={document} assets={assets} onSave={save} onClose={() => setCodeHandoffOpen(false)}/>}
    {reviewOpen && <><ReviewPanel projectId={projectId} documentId={document.documentId} currentRevision={document.revision} initialTab={reviewTab} anchor={{ pageId: page.id, pageName: page.name, ...(selectedNode ? { nodeId: selectedNode.id, nodeName: nodeName(selectedNode) } : {}) }} ensureSaved={prepareReviewAnchor} onRestore={restoreRevision} onClose={() => setReviewOpen(false)}/><ContextualGuide id="guide-review-comments"/></>}
    </Suspense>
    <header className="editor-top"><button className="back-projects" onClick={onExit}>← Projects</button><span className="editor-divider"/><b>{document.metadata.name || "Untitled project"}</b><span className="save-state" role="status">{status}</span><div className="editor-top-actions"><DiscoveryLauncher/><button data-discovery-id="uds-editor-review" onClick={() => { setReviewTab("comments"); setReviewOpen(true); }}>Review</button><button data-discovery-id="uds-editor-ai" onClick={() => setAiStudioOpen(true)}>AI Studio</button><button data-discovery-id="uds-editor-design-system" onClick={() => setDesignSystemOpen(true)}>Design system</button><button data-discovery-id="uds-editor-prototype" onClick={() => setPrototypeOpen(true)}>Prototype</button><button data-discovery-id="uds-editor-handoff" onClick={() => setCodeHandoffOpen(true)}>Code handoff</button><button data-discovery-id="uds-editor-history" title="Compare saved revisions and restore history" onClick={() => { setReviewTab("revisions"); setReviewOpen(true); }}>History</button><button data-discovery-id="uds-editor-undo" title="Undo (Ctrl+Z)" disabled={!undoStack.length} onClick={undo}>↶</button><button title="Redo (Ctrl+Shift+Z)" disabled={!redoStack.length} onClick={redo}>↷</button><button data-discovery-id="uds-editor-save" className="save-button" onClick={() => void save()} disabled={saving || Boolean(saveConflict)}>{saving ? "Saving…" : "Save"}</button></div></header>
    <nav className="editor-toolbar"><div className="tool-group"><button data-discovery-id="uds-editor-select" className={!panMode ? "tool-active" : ""} onClick={() => setPanMode(false)} title="Select">↖ Select</button><button className={panMode ? "tool-active" : ""} onClick={() => setPanMode(true)} title="Pan canvas">✋ Pan</button><button data-discovery-id="uds-editor-frame" onClick={() => add("frame")}>▣ Frame</button><button data-discovery-id="uds-editor-text" onClick={() => add("text")}>T Text</button><button data-discovery-id="uds-editor-shape" onClick={() => add("shape")}>▱ Shape</button><button data-discovery-id="uds-editor-image" onClick={() => add("image")}>▧ Image</button><button data-discovery-id="uds-editor-container" onClick={() => add("container")}>▤ Container</button><button data-discovery-id="uds-editor-component" disabled={!selectedNode || selectedNode.type === "component-instance"} onClick={createComponentFromSelection}>Create component</button><div className="discovery-align-tools" data-discovery-id="uds-editor-align"><button disabled={!selectedNode} onClick={() => selectedNode && patch(selectedNode.id, { x: 0 })}>Align left</button><button disabled={!selectedNode} onClick={() => selectedNode && patch(selectedNode.id, { x: Math.round((width - dimensions(selectedNode)[0]) / 2) })}>Center</button></div><button data-discovery-id="uds-editor-group" disabled={selectedIds.length < 2} onClick={groupSelection}>Group {selectedIds.length > 1 ? `(${selectedIds.length})` : ""}</button></div><div className="tool-group" data-discovery-id="uds-editor-viewport"><label>Desktop size <select value={viewport} onChange={event => setViewport(event.target.value as Viewport)}><option value="laptop">Laptop · 1280</option><option value="desktop">Desktop · 1440</option><option value="wide">Wide desktop · 1920</option></select></label><button onClick={() => setZoom(value => Math.max(.25, value - .1))}>−</button><span className="zoom-readout">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(1.5, value + .1))}>＋</button></div></nav>
    <div className="editor-main"><aside className="layers-panel"><div className="panel-heading"><b>Pages</b><button onClick={addPage} title="Add page">＋</button></div><div className="page-list" data-discovery-id="uds-editor-page-list">{document.pages.map(item => <div key={item.id} className={`page-tab ${item.id === page.id ? "page-active" : ""}`}><button onClick={() => { setActivePageId(item.id); setSelectedIds([]); }} onDoubleClick={() => renamePage(item)} title="Double-click to rename">▱ <span>{item.name}</span></button><button className="page-menu" onClick={() => renamePage(item)} aria-label={`Rename ${item.name}`}>···</button></div>)}</div><div className="layer-heading"><b>Layers</b><button onClick={() => add("shape")} title="Add layer">＋</button></div><div data-discovery-id="uds-editor-layers">{layers.map(({ node, depth }) => <button key={node.id} className={`layer-row ${selectedIds.includes(node.id) ? "layer-selected" : ""}`} style={{ paddingLeft: 9 + depth * 15 }} onClick={event => {
      if (event.ctrlKey || event.metaKey) {
        setSelectedIds(current => current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id]);
      } else setSelectedIds([node.id]);
    }}><span>{node.type === "text" ? "T" : node.type === "shape" ? "◇" : node.type === "frame" ? "▣" : node.type === "image" ? "▧" : "▤"}</span><span className="layer-title">{nodeName(node)}</span><span onClick={event => { event.stopPropagation(); patch(node.id, { visible: !node.visible }); }} title="Toggle visibility">{node.visible ? "◉" : "○"}</span></button>)}</div><button className="delete-page" onClick={() => deletePage(page)}>Delete current page</button></aside>
      <section className={`canvas-workspace ${panMode ? "pan-cursor" : ""}`} onPointerDown={event => { if (panMode || event.button === 1) { panDrag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onWheel={event => { if (event.ctrlKey) { event.preventDefault(); setZoom(value => Math.min(1.5, Math.max(.25, value - Math.sign(event.deltaY) * .05))); } }}><div className="canvas-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width, height }} onPointerDown={event => { if (event.target === event.currentTarget && event.button === 0 && !panMode) setSelectedIds([]); }}><div className="artboard" style={{ width, height }}><div className="artboard-label">{page.name} · {viewport} · {width} × {height}</div>{nodes.map(node => <CanvasNode key={node.id} node={node} projectId={projectId} designSystem={document.designSystem} modeId={modeId} selected={selectedIds.includes(node.id)} selection={selectedIds} onSelect={target => setSelectedIds([target.id])} onStartDrag={(target, event) => startDrag(target, event)} onResize={(target, event) => { event.stopPropagation(); startDrag(target, event as unknown as React.PointerEvent<HTMLDivElement>, true); }}/>)}</div></div></section>
      <aside className="inspector-panel" data-discovery-id="uds-editor-inspector"><div className="panel-heading"><b>Design</b></div>{selectedNode ? <>
        <div className="inspector-name">{nodeName(selectedNode)}</div>
        <label className="prop-label">Name<input value={selectedNode.name} onChange={event => patch(selectedNode.id, { name: event.target.value })}/></label>
        <div className="prop-grid"><label className="prop-label">X<input type="number" value={selectedNode.x} onChange={event => patch(selectedNode.id, { x: Number(event.target.value) })}/></label><label className="prop-label">Y<input type="number" value={selectedNode.y} onChange={event => patch(selectedNode.id, { y: Number(event.target.value) })}/></label>{"width" in selectedNode && <label className="prop-label">W<input type="number" value={selectedNode.width as number} onChange={event => patch(selectedNode.id, { width: Math.max(24, Number(event.target.value)) })}/></label>}{"height" in selectedNode && <label className="prop-label">H<input type="number" value={selectedNode.height as number} onChange={event => patch(selectedNode.id, { height: Math.max(24, Number(event.target.value)) })}/></label>}</div>
        {selectedNode.type === "text" && <label className="prop-label">Text<textarea value={selectedNode.text} onChange={event => patch(selectedNode.id, { text: event.target.value })}/></label>}
        {selectedNode.type === "shape" && <label className="prop-label">Fill<input type="color" value={selectedNode.fill} onChange={event => patch(selectedNode.id, { fill: event.target.value, fillTokenId: undefined })}/></label>}
        {selectedNode.type === "component-instance" && (() => {
          const component = document.designSystem.components.find(item => item.id === selectedNode.componentId);
          const variant = component?.variants.find(item => item.id === selectedNode.variants.variant);
          if (!component) return <p className="inspector-hint">This component definition is missing.</p>;
          return <section className="component-instance-properties"><b>{component.name} properties</b>
            {component.variants.length > 0 && <label className="prop-label">Variant<select value={variant?.id ?? ""} onChange={event => patch(selectedNode.id, { variants: { ...selectedNode.variants, variant: event.target.value } })}><option value="">Default</option>{component.variants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
            {component.properties.map((property: ComponentProperty) => {
              const value = selectedNode.overrides[property.id] ?? variant?.values[property.id] ?? property.defaultValue;
              const update = (next: string | number | boolean) => patch(selectedNode.id, { overrides: { ...selectedNode.overrides, [property.id]: next } });
              return <label className="prop-label" key={property.id}>{property.name}{property.type === "boolean" ? <input type="checkbox" checked={Boolean(value)} onChange={event => update(event.target.checked)}/> : property.type === "number" ? <input type="number" value={Number(value)} onChange={event => update(Number(event.target.value))}/> : <input type={property.type === "color" ? "color" : "text"} value={String(value)} onChange={event => update(event.target.value)}/>}</label>;
            })}
          </section>;
        })()}
        {selectedNode.type === "container" && <><label className="prop-label">Layout<select value={selectedNode.layout.display} onChange={event => updateLayout(event.target.value as "block" | "flex" | "grid")}><option value="block">Block</option><option value="flex">Flex</option><option value="grid">Grid</option></select></label>{selectedNode.layout.display === "flex" && <><label className="prop-label">Direction<select value={selectedNode.layout.direction} onChange={event => updateFlexLayout({ direction: event.target.value })}><option value="row">Row</option><option value="column">Column</option></select></label><label className="prop-label">Align items<select value={selectedNode.layout.align} onChange={event => updateFlexLayout({ align: event.target.value })}><option value="stretch">Stretch</option><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></label><label className="prop-label">Justify content<select value={selectedNode.layout.justify} onChange={event => updateFlexLayout({ justify: event.target.value })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="space-between">Space between</option></select></label><label className="prop-label">Gap<input type="number" min="0" value={selectedNode.layout.gap} onChange={event => updateFlexLayout({ gap: Math.max(0, Number(event.target.value)) })}/></label></>}{selectedNode.layout.display === "grid" && <><label className="prop-label">Columns<input type="number" min="1" max="12" value={selectedNode.layout.columns.length} onChange={event => updateGridLayout({ columns: Array.from({ length: Math.min(12, Math.max(1, Number(event.target.value))) }, () => "1fr") })}/></label><label className="prop-label">Gap<input type="number" min="0" value={selectedNode.layout.gap} onChange={event => updateGridLayout({ gap: Math.max(0, Number(event.target.value)) })}/></label></>}</>}
        <button className="delete-layer" onClick={() => { commit(pageChildren(document, page.id, removeNodes(nodes, new Set(selectedIds)))); setSelectedIds([]); }}>Delete layer</button>
      </> : selectedIds.length > 1 ? <div className="selection-summary">{selectedIds.length} layers selected. Use Group to create a nested parent.</div> : <p className="inspector-hint">Select a layer on the canvas to edit its properties.</p>}
        <div className="inspector-section"><b>Canvas</b><div className="detail-row"><span>Page</span><b>{document.pages.length} total</b></div><div className="detail-row"><span>Revision</span><b>{document.revision}</b></div></div></aside></div>
  </div>;
}

function SaveConflictDialog({ localRevision, currentRevision, busy, error, notice, onKeepEditing, onDownloadDraft, onLoadLatest }: {
  localRevision: number;
  currentRevision?: number;
  busy: boolean;
  error: string;
  notice: string;
  onKeepEditing: () => void;
  onDownloadDraft: () => void;
  onLoadLatest: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const keepEditingRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const previousFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => keepEditingRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onKeepEditing();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (!controls.length) { event.preventDefault(); return; }
    if (event.shiftKey && window.document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && window.document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }
  return <div className="conflict-recovery-scrim"><section ref={dialogRef} className="conflict-recovery-dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-recovery-title" aria-describedby="conflict-recovery-copy" tabIndex={-1} onKeyDown={handleKeyDown}>
    <span className="conflict-recovery-eyebrow">SAVE CONFLICT</span>
    <h2 id="conflict-recovery-title">A newer saved version exists</h2>
    <p id="conflict-recovery-copy">Your local draft is based on revision {localRevision}{currentRevision === undefined ? "" : `, while the project now has revision ${currentRevision}`}. Your draft is still open here and has not been replaced.</p>
    <p className="conflict-recovery-guidance">There is no automatic merge. Download a backup before discarding your draft, or keep editing and reconcile the versions yourself.</p>
    {error && <p className="conflict-recovery-error" role="alert">{error}</p>}
    {notice && <p className="conflict-recovery-notice" role="status">{notice}</p>}
    <div className="conflict-recovery-actions">
      <button ref={keepEditingRef} type="button" className="conflict-recovery-secondary" onClick={onKeepEditing}>Keep editing</button>
      <button type="button" className="conflict-recovery-secondary" onClick={onDownloadDraft}>Download draft backup</button>
      <button type="button" className="conflict-recovery-danger" onClick={onLoadLatest} disabled={busy}>{busy ? "Loading saved version…" : `Discard draft and load ${currentRevision === undefined ? "latest saved version" : `revision ${currentRevision}`}`}</button>
    </div>
  </section></div>;
}

function CanvasNode({ node, projectId, designSystem, modeId, selected, selection, onSelect, onStartDrag, onResize, flowItem = false }: { node: DesignNode; projectId: string; designSystem: DesignSystem; modeId: string; selected: boolean; selection: string[]; onSelect: (node: DesignNode) => void; onStartDrag: (node: DesignNode, event: React.PointerEvent<HTMLDivElement>) => void; onResize: (node: DesignNode, event: React.PointerEvent<HTMLButtonElement>) => void; flowItem?: boolean }) {
  const style: React.CSSProperties = { position: flowItem ? "relative" : "absolute", left: flowItem ? undefined : node.x, top: flowItem ? undefined : node.y, outline: selected ? "1px solid #6554dc" : "none", cursor: "move", opacity: node.visible ? 1 : .35 };
  let content: React.ReactNode;
  if (node.type === "text") content = <div style={{ color: colorFor(designSystem, node.colorTokenId, modeId, node.color), fontSize: node.fontSize, whiteSpace: "pre-wrap" }}>{node.text}</div>;
  else if (node.type === "shape") content = <div style={{ width: node.width, height: node.height, background: colorFor(designSystem, node.fillTokenId, modeId, node.fill), borderRadius: node.shape === "ellipse" ? "50%" : 5 }} />;
  else if (node.type === "frame") content = <div className="nested-frame" style={{ width: node.width, height: node.height }}>{node.children.map((child: DesignNode) => <CanvasNode key={child.id} node={child} projectId={projectId} designSystem={designSystem} modeId={modeId} selected={selection.includes(child.id)} selection={selection} onSelect={onSelect} onStartDrag={onStartDrag} onResize={onResize}/>)}</div>;
  else if (node.type === "container") content = <div className="container-layout" style={{ width: node.width, height: node.height, display: node.layout.display === "block" ? "block" : node.layout.display, flexDirection: node.layout.display === "flex" ? node.layout.direction : undefined, gap: node.layout.display === "block" ? 0 : node.layout.gap, gridTemplateColumns: node.layout.display === "grid" ? node.layout.columns.join(" ") : undefined, alignItems: node.layout.display === "flex" ? node.layout.align : undefined, justifyContent: node.layout.display === "flex" ? node.layout.justify : undefined }}>{node.children.map((child: DesignNode) => <CanvasNode key={child.id} node={child} projectId={projectId} designSystem={designSystem} modeId={modeId} selected={selection.includes(child.id)} selection={selection} onSelect={onSelect} onStartDrag={onStartDrag} onResize={onResize} flowItem={node.layout.display === "flex" || node.layout.display === "grid"}/>)}</div>;
  else if (node.type === "image") content = <img className="canvas-image" src={node.src.startsWith("/") ? node.src : `/api/projects/${projectId}/assets/${node.src}/content`} alt={node.alt} style={{ width: node.width, height: node.height, objectFit: node.fit }} />;
  else {
    const root = resolveComponentInstance(designSystem, node);
    if (!root) content = <div className="container-placeholder">Missing component</div>;
    else {
      const [componentWidth, componentHeight] = dimensions(root);
      content = <div className="component-instance-preview" style={{ width: componentWidth, height: componentHeight, position: "relative", pointerEvents: "none" }}><CanvasNode node={root} projectId={projectId} designSystem={designSystem} modeId={modeId} selected={false} selection={[]} onSelect={() => undefined} onStartDrag={() => undefined} onResize={() => undefined}/></div>;
    }
  }
  return <div style={style} onPointerDown={event => { event.stopPropagation(); onSelect(node); onStartDrag(node, event); }} onClick={event => { event.stopPropagation(); onSelect(node); }}>{content}{selected && "width" in node && "height" in node && <button className="resize-handle" onPointerDown={event => onResize(node, event)} aria-label="Resize selected layer"/>}</div>;
}
