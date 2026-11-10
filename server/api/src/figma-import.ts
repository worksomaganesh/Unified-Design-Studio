import { randomUUID } from "node:crypto";
import {
  DesignDocumentSchema,
  DesignNodeSchema,
  DesignSystemSchema,
  type DesignDocument,
  type DesignNode,
  type DesignSystem,
  type DesignToken,
} from "@uds/design-core";
import { importFigmaVariables } from "@uds/design-core/figma-variables";

type RecordValue = Record<string, unknown>;
type FigmaConversion = {
  fileName: string;
  pages: DesignDocument["pages"];
  designSystem: DesignSystem;
  layersImported: number;
  componentsImported: number;
  tokensImported: number;
  warnings: string[];
};

const MAX_PAGES = 100;
const MAX_NODES = 50_000;
const MAX_DEPTH = 100;
const EMPTY_SYSTEM: DesignSystem = { themes: [], modes: [], tokens: [], components: [] };

function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueName(raw: string, used: Set<string>): string {
  const base = (raw.trim() || "Imported").slice(0, 80);
  if (!used.has(base.toLocaleLowerCase())) { used.add(base.toLocaleLowerCase()); return base; }
  for (let index = 2; index < 10_000; index += 1) {
    const suffix = ` (imported ${index})`;
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!used.has(candidate.toLocaleLowerCase())) { used.add(candidate.toLocaleLowerCase()); return candidate; }
  }
  return randomUUID();
}

function mergeDesignSystem(existing: DesignSystem, incoming: DesignSystem): { designSystem: DesignSystem; tokenIds: Map<string, string> } {
  const themes = [...existing.themes];
  const themeIds = new Map<string, string>();
  const themeNames = new Set(themes.map(item => item.name.toLocaleLowerCase()));
  for (const theme of incoming.themes) {
    const id = randomUUID();
    themeIds.set(theme.id, id);
    themes.push({ id, name: uniqueName(theme.name, themeNames) });
  }

  const modes = [...existing.modes];
  const modeIds = new Map<string, string>();
  for (const mode of incoming.modes) {
    const themeId = themeIds.get(mode.themeId);
    if (!themeId) continue;
    const id = randomUUID();
    modeIds.set(mode.id, id);
    const names = new Set(modes.filter(item => item.themeId === themeId).map(item => item.name.toLocaleLowerCase()));
    modes.push({ id, themeId, name: uniqueName(mode.name, names) });
  }

  const tokens = [...existing.tokens];
  const tokenIds = new Map<string, string>();
  const tokenNames = new Set(tokens.map(item => item.name.toLocaleLowerCase()));
  for (const token of incoming.tokens) tokenIds.set(token.id, randomUUID());
  for (const token of incoming.tokens) {
    const id = tokenIds.get(token.id)!;
    const modeValues = Object.fromEntries(Object.entries(token.modeValues ?? {}).flatMap(([modeId, value]) => modeIds.has(modeId) ? [[modeIds.get(modeId)!, value]] : []));
    const next: DesignToken = {
      ...token,
      id,
      name: uniqueName(token.name, tokenNames),
      modeValues,
      ...(token.aliasOf && tokenIds.has(token.aliasOf) ? { aliasOf: tokenIds.get(token.aliasOf)! } : { aliasOf: undefined }),
    };
    tokens.push(next);
  }

  const components = [...existing.components];
  const componentNames = new Set(components.map(item => item.name.toLocaleLowerCase()));
  components.push(...incoming.components.map(item => ({ ...item, name: uniqueName(item.name, componentNames) })));
  return { designSystem: DesignSystemSchema.parse({ themes, modes, tokens, components }), tokenIds };
}

function colorHex(value: unknown, opacity = 1): string | undefined {
  if (!record(value)) return undefined;
  const { r, g, b } = value;
  if (![r, g, b].every(channel => typeof channel === "number" && Number.isFinite(channel))) return undefined;
  const alpha = Math.max(0, Math.min(1, finite(value.a, 1) * Math.max(0, Math.min(1, opacity))));
  const channels = [r, g, b].map(channel => Math.round(Math.max(0, Math.min(1, channel as number)) * 255).toString(16).padStart(2, "0"));
  return `#${channels.join("")}${alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, "0") : ""}`;
}

function colorFromFills(value: unknown, opacity: number, warnings: (message: string) => void): string | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.filter(paint => record(paint) && paint.visible !== false && finite(paint.opacity, 1) !== 0).length > 1) {
    warnings("Multiple fills were reduced to the first supported visible fill.");
  }
  for (const paint of value) {
    if (!record(paint) || paint.visible === false || finite(paint.opacity, 1) === 0) continue;
    if (paint.type === "SOLID") {
      const color = colorHex(paint.color, opacity * finite(paint.opacity, 1));
      if (color) return color;
    } else if (paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") {
      warnings("Gradient fills are not represented by the UDS layer model; the first solid fill was used where available.");
    } else if (paint.type === "IMAGE") {
      warnings("Image fills remain in the Figma source; image bytes are not copied into the UDS document.");
    }
  }
  return undefined;
}

function variableId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) { const id = variableId(entry); if (id) return id; }
  }
  return record(value) && value.type === "VARIABLE_ALIAS" && typeof value.id === "string" ? value.id : undefined;
}

function boundColorToken(node: RecordValue, sourceVariableTokens: Map<string, string>): string | undefined {
  if (!record(node.boundVariables)) return undefined;
  const id = variableId(node.boundVariables.fills);
  return id ? sourceVariableTokens.get(id) : undefined;
}

function frameBounds(node: RecordValue, allowZero = false): { x: number; y: number; width: number; height: number } | undefined {
  const bounds = record(node.absoluteBoundingBox) ? node.absoluteBoundingBox : record(node.absoluteRenderBounds) ? node.absoluteRenderBounds : undefined;
  if (!bounds) return undefined;
  const width = finite(bounds.width);
  const height = finite(bounds.height);
  if (width < 0 || height < 0 || (!allowZero && (width === 0 || height === 0))) return undefined;
  return { x: finite(bounds.x), y: finite(bounds.y), width, height };
}

function cloneWithNewIds(node: DesignNode): DesignNode {
  return "children" in node
    ? { ...node, id: randomUUID(), children: node.children.map(cloneWithNewIds) } as DesignNode
    : { ...node, id: randomUUID() } as DesignNode;
}

export function convertFigmaFileResponse(input: unknown, existing: DesignSystem, variablesResponse?: unknown): FigmaConversion {
  if (!record(input) || !record(input.document) || input.document.type !== "DOCUMENT" || !Array.isArray(input.document.children)) {
    throw new Error("Figma did not return a supported file document tree.");
  }
  const warnings: string[] = [];
  const warningSet = new Set<string>();
  const warn = (message: string) => { if (!warningSet.has(message) && warnings.length < 60) { warningSet.add(message); warnings.push(message); } };
  const sourcePages = input.document.children.filter((page): page is RecordValue => record(page) && page.type === "CANVAS");
  if (!sourcePages.length) throw new Error("No Figma pages were found in this file.");
  if (sourcePages.length > MAX_PAGES) throw new Error(`This Figma file exceeds the ${MAX_PAGES}-page import limit.`);

  let sourceNodeCount = 0;
  const componentNodes: RecordValue[] = [];
  const countComponents = (nodes: unknown[]) => {
    const pending = nodes.filter(record).map(node => ({ node, depth: 0 }));
    while (pending.length) {
      const current = pending.pop()!;
      sourceNodeCount += 1;
      if (sourceNodeCount > MAX_NODES) throw new Error(`This Figma file exceeds the ${MAX_NODES}-layer import limit.`);
      if (current.depth > MAX_DEPTH) { warn(`Layers below depth ${MAX_DEPTH} were omitted to keep the import bounded.`); continue; }
      if (current.node.type === "COMPONENT" && typeof current.node.id === "string") componentNodes.push(current.node);
      if (Array.isArray(current.node.children)) {
        for (const child of current.node.children) if (record(child)) pending.push({ node: child, depth: current.depth + 1 });
      }
    }
  };
  for (const page of sourcePages) countComponents(Array.isArray(page.children) ? page.children : []);

  let importedTokenSystem: DesignSystem = EMPTY_SYSTEM;
  if (variablesResponse !== undefined) {
    try {
      importedTokenSystem = importFigmaVariables(variablesResponse, EMPTY_SYSTEM).designSystem;
    } catch {
      warn("Figma variables could not be converted; page and layer import continued without token data.");
    }
  } else {
    warn("Figma variables were unavailable; editable layers were imported without token bindings.");
  }
  const merged = mergeDesignSystem(existing, importedTokenSystem);
  const sourceVariableTokens = new Map<string, string>();
  for (const token of importedTokenSystem.tokens) {
    if (token.id.startsWith("figma-token-")) {
      const sourceId = token.id.slice("figma-token-".length);
      const mapped = merged.tokenIds.get(token.id);
      if (mapped) sourceVariableTokens.set(sourceId, mapped);
    }
  }

  const componentIds = new Map<string, string>();
  const componentNames = new Set(merged.designSystem.components.map(item => item.name.toLocaleLowerCase()));
  for (const component of componentNodes) {
    const sourceId = typeof component.id === "string" ? component.id : "";
    if (sourceId) componentIds.set(sourceId, randomUUID());
  }

  let layersImported = 0;
  const convertNode = (
    source: RecordValue,
    parentBounds: { x: number; y: number } | undefined,
    allowInstances: boolean,
    depth = 0,
  ): DesignNode | undefined => {
    const type = typeof source.type === "string" ? source.type : "";
    const sourceId = typeof source.id === "string" ? source.id : "";
    const name = typeof source.name === "string" ? source.name.slice(0, 120) : type || "Layer";
    if (depth > MAX_DEPTH) { warn(`Layers below depth ${MAX_DEPTH} were omitted to keep the import bounded.`); return undefined; }
    const bounds = frameBounds(source, type === "LINE");
    if (!sourceId || !bounds) { warn(`Layer “${name}” was skipped because its identifier or bounds were unavailable.`); return undefined; }
    const childrenRaw = Array.isArray(source.children) ? source.children.filter(record) : [];
    const x = bounds.x - (parentBounds?.x ?? 0);
    const y = bounds.y - (parentBounds?.y ?? 0);
    const base = { id: randomUUID(), name, visible: source.visible !== false, locked: source.locked === true, x, y };
    const opacity = Math.max(0, Math.min(1, finite(source.opacity, 1)));
    if (finite(source.rotation) !== 0) warn(`Rotation on layer “${name}” was flattened; the UDS layer model has no rotation field.`);
    if (Array.isArray(source.strokes) && source.strokes.length) warn(`Strokes on layer “${name}” were omitted because UDS does not yet model strokes.`);
    if (type === "FRAME" && source.clipsContent === true) warn(`Frame clipping on “${name}” was not preserved.`);

    if (type === "INSTANCE") {
      const componentId = typeof source.componentId === "string" ? componentIds.get(source.componentId) : undefined;
      if (allowInstances && componentId) {
        if ((Array.isArray(source.overrides) && source.overrides.length) || (record(source.componentProperties) && Object.keys(source.componentProperties).length)) {
          warn(`Component property overrides on “${name}” were not retained.`);
        }
        layersImported += 1;
        return { ...base, type: "component-instance", componentId, overrides: {}, variants: {} };
      }
      warn(`Component instance “${name}” was skipped because its main component was not available in this file.`);
      return undefined;
    }

    let node: DesignNode | undefined;
    const convertChildren = (relativeTo: { x: number; y: number } | undefined, instances: boolean) => childrenRaw
      .map(child => convertNode(child, relativeTo, instances, depth + 1))
      .filter((child): child is DesignNode => Boolean(child));
    if (["FRAME", "COMPONENT", "COMPONENT_SET"].includes(type)) {
      const children = convertChildren(bounds, allowInstances);
      const layoutMode = source.layoutMode;
      if (type === "FRAME" && (layoutMode === "HORIZONTAL" || layoutMode === "VERTICAL")) {
        const justify = source.primaryAxisAlignItems === "SPACE_BETWEEN" ? "space-between" : source.primaryAxisAlignItems === "CENTER" ? "center" : source.primaryAxisAlignItems === "MAX" ? "end" : "start";
        const align = source.counterAxisAlignItems === "CENTER" ? "center" : source.counterAxisAlignItems === "MAX" ? "end" : "start";
        node = { ...base, type: "container", width: bounds.width, height: bounds.height, layout: { display: "flex", direction: layoutMode === "HORIZONTAL" ? "row" : "column", gap: Math.max(0, finite(source.itemSpacing)), align, justify }, children };
        if (source.layoutWrap === "WRAP") warn(`Wrapping auto-layout on “${name}” was reduced to a single flex flow.`);
        if ([source.paddingLeft, source.paddingRight, source.paddingTop, source.paddingBottom].some(value => finite(value) > 0)) warn(`Auto-layout padding on “${name}” was omitted because UDS does not yet model container padding.`);
      } else {
        node = { ...base, type: "frame", width: bounds.width, height: bounds.height, children };
        if (type === "COMPONENT_SET") warn(`Component set “${name}” was imported as a frame; variant relationships were not retained.`);
      }
    } else if (type === "GROUP") {
      node = { ...base, type: "container", width: bounds.width, height: bounds.height, layout: { display: "block" }, children: convertChildren(bounds, allowInstances) };
    } else if (["RECTANGLE", "ELLIPSE", "LINE"].includes(type)) {
      const fill = colorFromFills(source.fills, opacity, warn) ?? "#e5e7eb";
      node = {
        ...base,
        type: "shape",
        shape: type === "ELLIPSE" ? "ellipse" : type === "LINE" ? "line" : "rectangle",
        width: bounds.width,
        height: bounds.height,
        fill,
        ...(boundColorToken(source, sourceVariableTokens) ? { fillTokenId: boundColorToken(source, sourceVariableTokens) } : {}),
      };
    } else if (type === "TEXT") {
      const color = colorFromFills(source.fills, opacity, warn) ?? "#111827";
      const style = record(source.style) ? source.style : {};
      const text = typeof source.characters === "string" ? source.characters : "";
      node = {
        ...base,
        type: "text",
        text,
        color,
        fontSize: Math.max(1, finite(style.fontSize, 16)),
        ...(boundColorToken(source, sourceVariableTokens) ? { colorTokenId: boundColorToken(source, sourceVariableTokens) } : {}),
      };
      if ((Array.isArray(source.characterStyleOverrides) && source.characterStyleOverrides.some(value => value !== 0)) || (record(source.styleOverrideTable) && Object.keys(source.styleOverrideTable).length)) {
        warn(`Rich-text styling on “${name}” was flattened to its first text style.`);
      }
    } else if (["VECTOR", "BOOLEAN_OPERATION", "STAR", "REGULAR_POLYGON", "SLICE"].includes(type)) {
      warn(`Vector layer “${name}” (${type}) was skipped because editable vector paths are not in the UDS layer model.`);
    } else {
      warn(`Unsupported Figma layer “${name}” (${type || "unknown"}) was skipped.`);
    }

    if (!node) {
      if (childrenRaw.length && !["VECTOR", "BOOLEAN_OPERATION", "STAR", "REGULAR_POLYGON", "SLICE"].includes(type)) warn(`Children of unsupported layer “${name}” were skipped.`);
      return undefined;
    }
    const parsed = DesignNodeSchema.safeParse(node);
    if (!parsed.success) { warn(`Layer “${name}” did not pass the UDS layer schema and was skipped.`); return undefined; }
    layersImported += 1;
    return parsed.data;
  };

  const componentDefinitions: DesignSystem["components"] = [];
  for (const source of componentNodes) {
    const sourceId = typeof source.id === "string" ? source.id : "";
    const root = convertNode(source, frameBounds(source), false);
    const componentId = componentIds.get(sourceId);
    if (!root || !componentId || root.type === "component-instance") { componentIds.delete(sourceId); continue; }
    componentDefinitions.push({ id: componentId, name: uniqueName(typeof source.name === "string" ? source.name : root.name, componentNames), root: cloneWithNewIds({ ...root, x: 0, y: 0 } as DesignNode), properties: [], variants: [] });
  }
  layersImported = 0;
  const pages: DesignDocument["pages"] = sourcePages.map((sourcePage, pageIndex) => {
    const children = (Array.isArray(sourcePage.children) ? sourcePage.children : [])
      .filter(record)
      .map(source => convertNode(source, undefined, true))
      .filter((node): node is DesignNode => Boolean(node));
    return { id: randomUUID(), name: (typeof sourcePage.name === "string" ? sourcePage.name : `Page ${pageIndex + 1}`).slice(0, 120), children };
  });
  const designSystem = DesignSystemSchema.parse({ ...merged.designSystem, components: [...merged.designSystem.components, ...componentDefinitions] });
  const validated = DesignDocumentSchema.safeParse({
    schemaVersion: 2,
    documentId: randomUUID(),
    revision: 0,
    metadata: { name: "Figma import", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
    designSystem,
    pages,
  });
  if (!validated.success) throw new Error(`Figma content could not be represented as an editable UDS document: ${validated.error.issues[0]?.message ?? "invalid imported document"}.`);
  const existingComponentIds = new Set(existing.components.map(item => item.id));
  return {
    fileName: typeof input.name === "string" && input.name.trim() ? input.name.slice(0, 120) : "Figma file",
    pages: validated.data.pages,
    designSystem: validated.data.designSystem,
    layersImported,
    componentsImported: validated.data.designSystem.components.filter(component => !existingComponentIds.has(component.id)).length,
    tokensImported: importedTokenSystem.tokens.length,
    warnings: warnings.slice(0, 30),
  };
}
