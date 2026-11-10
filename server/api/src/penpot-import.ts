import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import {
  DesignDocumentSchema,
  DesignNodeSchema,
  createDefaultDesignSystem,
  type DesignDocument,
  type DesignNode,
  type DesignSystem,
  type DesignToken,
} from "@uds/design-core";
import { importInterchangeTokens } from "@uds/design-core/token-interchange";

const MAX_ENTRIES = 10_000;
const MAX_JSON_BYTES = 50 * 1024 * 1024;
const MAX_JSON_ENTRY_BYTES = 10 * 1024 * 1024;
const MAX_SHAPES = 50_000;
const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

type JsonRecord = Record<string, unknown>;
type PenpotConversion = {
  pages: DesignDocument["pages"];
  designSystem: DesignSystem;
  layersImported: number;
  tokensImported: number;
  componentsImported: number;
  warnings: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readZipJson(bytes: Buffer): Map<string, unknown> {
  const min = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (bytes.readUInt32LE(offset) === ZIP_EOCD) { eocd = offset; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("Penpot file is not a complete ZIP archive.");
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  const commentLength = bytes.readUInt16LE(eocd + 20);
  if (disk || centralDisk || diskEntries !== entryCount || entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("Multi-disk and ZIP64 Penpot archives are not supported.");
  }
  if (entryCount > MAX_ENTRIES || eocd + 22 + commentLength !== bytes.length || centralOffset + centralSize > eocd) {
    throw new Error("Penpot archive structure is invalid or exceeds the import limits.");
  }

  const json = new Map<string, unknown>();
  let position = centralOffset;
  let totalJsonBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (position + 46 > centralOffset + centralSize || bytes.readUInt32LE(position) !== ZIP_CENTRAL) throw new Error("Penpot archive has a damaged central directory.");
    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const crc = bytes.readUInt32LE(position + 16);
    const compressedSize = bytes.readUInt32LE(position + 20);
    const uncompressedSize = bytes.readUInt32LE(position + 24);
    const nameLength = bytes.readUInt16LE(position + 28);
    const extraLength = bytes.readUInt16LE(position + 30);
    const commentSize = bytes.readUInt16LE(position + 32);
    const diskStart = bytes.readUInt16LE(position + 34);
    const localOffset = bytes.readUInt32LE(position + 42);
    const recordEnd = position + 46 + nameLength + extraLength + commentSize;
    if (recordEnd > centralOffset + centralSize) throw new Error("Penpot archive has a truncated directory record.");
    const name = bytes.toString("utf8", position + 46, position + 46 + nameLength);
    position = recordEnd;
    if (diskStart || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error("ZIP64 or split Penpot entries are not supported.");
    if (!name.endsWith(".json")) continue;
    if ((flags & 1) !== 0 || !name || name.startsWith("/") || name.includes("\\") || name.split("/").some(part => part === ".." || part === ".")) {
      throw new Error("Penpot archive contains an unsafe or encrypted JSON entry.");
    }
    if (uncompressedSize > MAX_JSON_ENTRY_BYTES || (totalJsonBytes += uncompressedSize) > MAX_JSON_BYTES) throw new Error("Penpot JSON data exceeds the import limit.");
    if (method !== 0 && method !== 8) throw new Error("Penpot archive uses an unsupported ZIP compression method.");
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== ZIP_LOCAL) throw new Error("Penpot archive has a damaged local file header.");
    if (bytes.readUInt16LE(localOffset + 6) !== flags || bytes.readUInt16LE(localOffset + 8) !== method) throw new Error("Penpot archive directory and local file headers disagree.");
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > centralOffset || dataStart > dataEnd) throw new Error("Penpot archive contains a truncated JSON entry.");
    if (bytes.toString("utf8", localOffset + 30, localOffset + 30 + localNameLength) !== name) throw new Error("Penpot archive directory and local entry names disagree.");
    let data: Buffer;
    try {
      const compressed = bytes.subarray(dataStart, dataEnd);
      data = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_JSON_ENTRY_BYTES });
    } catch { throw new Error("Penpot JSON entry could not be decompressed safely."); }
    if (data.length !== uncompressedSize || crc32(data) !== crc) throw new Error("Penpot JSON entry failed its size or integrity check.");
    try { json.set(name, JSON.parse(data.toString("utf8")) as unknown); }
    catch { throw new Error(`Penpot archive contains invalid JSON at ${name}.`); }
  }
  if (position !== centralOffset + centralSize) throw new Error("Penpot archive directory size does not match its entries.");
  return json;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function color(value: unknown): string | undefined {
  if (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)) return value;
  if (!isRecord(value)) return undefined;
  if (typeof value.color === "string") return color(value.color);
  if (typeof value.fillColor === "string") return color(value.fillColor);
  if ([value.r, value.g, value.b].every(channel => typeof channel === "number" && Number.isFinite(channel))) {
    const alpha = finite(value.a, 1);
    const channels = [value.r, value.g, value.b].map(channel => Math.round(Math.max(0, Math.min(1, channel as number)) * 255).toString(16).padStart(2, "0"));
    return `#${channels.join("")}${alpha < 1 ? Math.round(Math.max(0, alpha) * 255).toString(16).padStart(2, "0") : ""}`;
  }
  return undefined;
}

function fillColor(shape: JsonRecord): string | undefined {
  if (!Array.isArray(shape.fills)) return undefined;
  for (const fill of shape.fills) {
    if (!isRecord(fill) || fill.hidden === true || fill.fillOpacity === 0 || fill.opacity === 0) continue;
    const parsed = color(fill.color ?? fill.fillColor ?? fill);
    if (parsed) return parsed;
  }
  return undefined;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (!isRecord(value)) return "";
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;
  return textContent(value.children ?? value.blocks ?? value.paragraphs ?? []);
}

function uniqueName(name: string, used: Set<string>): string {
  const base = (name.trim() || "Imported").slice(0, 80);
  if (!used.has(base.toLocaleLowerCase())) { used.add(base.toLocaleLowerCase()); return base; }
  for (let index = 2; index < 10_000; index += 1) {
    const suffix = ` (imported ${index})`;
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!used.has(candidate.toLocaleLowerCase())) { used.add(candidate.toLocaleLowerCase()); return candidate; }
  }
  return `${randomUUID()}`;
}

function mergeDesignSystem(existing: DesignSystem, incoming: DesignSystem): DesignSystem {
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
    const id = randomUUID();
    modeIds.set(mode.id, id);
    const themeId = themeIds.get(mode.themeId);
    if (!themeId) continue;
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
  return { themes, modes, tokens, components: [...existing.components] };
}

function makePages(
  json: Map<string, unknown>, fileId: string, warnings: string[],
  components: JsonRecord[],
): { pages: DesignDocument["pages"]; nodesBySourceId: Map<string, DesignNode>; layers: number; componentDefinitions: DesignSystem["components"] } {
  const pagePrefix = `files/${fileId}/pages/`;
  const pageRows = [...json.entries()].filter(([path, value]) => path.startsWith(pagePrefix) && path.endsWith(".json") && !path.slice(pagePrefix.length).includes("/") && isRecord(value))
    .map(([, value]) => value as JsonRecord)
    .sort((a, b) => finite(a.index) - finite(b.index) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
  if (!pageRows.length) throw new Error("No Penpot pages were found in the archive.");

  const pages: DesignDocument["pages"] = [];
  const nodesBySourceId = new Map<string, DesignNode>();
  const sourceShapesById = new Map<string, JsonRecord>();
  let layers = 0;
  const convertPage = (page: JsonRecord): DesignDocument["pages"][number] => {
    const sourcePageId = typeof page.id === "string" ? page.id : "";
    const shapeDir = `${pagePrefix}${sourcePageId}/`;
    const shapes = [...json.entries()].filter(([path, value]) => path.startsWith(shapeDir) && path.endsWith(".json") && !path.slice(shapeDir.length).includes("/") && isRecord(value))
      .map(([, value]) => value as JsonRecord);
    if (shapes.length > MAX_SHAPES) throw new Error("Penpot page exceeds the supported layer count.");
    for (const shape of shapes) if (typeof shape.id === "string") sourceShapesById.set(shape.id, shape);
    const childIds = new Set(shapes.flatMap(shape => Array.isArray(shape.shapes) ? shape.shapes.filter((id): id is string => typeof id === "string") : []));
    const pageRootIds = Array.isArray(page.shapes) ? page.shapes.filter((id): id is string => typeof id === "string") : [];
    const roots = pageRootIds.length ? pageRootIds.map(id => sourceShapesById.get(id)).filter((shape): shape is JsonRecord => Boolean(shape)) : shapes.filter(shape => typeof shape.id === "string" && !childIds.has(shape.id));
    const pageId = randomUUID();
    const pageName = typeof page.name === "string" ? page.name : "Imported Penpot page";
    const convertShape = (shape: JsonRecord, ancestors: Set<string>): DesignNode | undefined => {
      const sourceId = typeof shape.id === "string" ? shape.id : "";
      if (!sourceId || ancestors.has(sourceId)) { warnings.push("Skipped a cyclic or unidentified Penpot layer."); return undefined; }
      const nextAncestors = new Set(ancestors).add(sourceId);
      const childRows = Array.isArray(shape.shapes) ? shape.shapes.map(id => typeof id === "string" ? sourceShapesById.get(id) : undefined).filter((item): item is JsonRecord => Boolean(item)) : [];
      const children = childRows.map(child => convertShape(child, nextAncestors)).filter((item): item is DesignNode => Boolean(item));
      const bounds = isRecord(shape.selrect) ? shape.selrect : {};
      const x = finite(shape.x, finite(bounds.x));
      const y = finite(shape.y, finite(bounds.y));
      const width = Math.max(1, finite(shape.width, finite(bounds.width, 1)));
      const height = Math.max(1, finite(shape.height, finite(bounds.height, 1)));
      const base = { id: randomUUID(), name: typeof shape.name === "string" ? shape.name.slice(0, 120) : String(shape.type ?? "Layer"), visible: shape.hidden !== true, locked: shape.blocked === true, x, y };
      const type = typeof shape.type === "string" ? shape.type : "";
      let node: DesignNode | undefined;
      if (type === "frame") node = { ...base, type: "frame", width, height, children };
      else if (type === "group") node = { ...base, type: "container", width, height, layout: { display: "block" }, children };
      else if (type === "text") {
        const fill = fillColor(shape) ?? "#111827";
        const text = textContent(shape.content ?? shape.text);
        node = { ...base, type: "text", text, color: fill, fontSize: Math.max(1, finite(shape.fontSize, 16)) };
      } else if (type === "rect" || type === "circle") {
        const fill = fillColor(shape) ?? "#e5e7eb";
        node = { ...base, type: "shape", shape: type === "circle" ? "ellipse" : "rectangle", width, height, fill };
      } else if (type === "image") {
        warnings.push(`Image layer “${base.name}” was skipped; embedded media is retained in the source reference.`);
      } else if (["path", "bool", "svg-raw"].includes(type)) {
        warnings.push(`Vector layer “${base.name}” (${type}) was skipped because editable vector paths are not in the UDS layer model.`);
      } else {
        warnings.push(`Unsupported Penpot layer “${base.name}” (${type || "unknown"}) was skipped.`);
      }
      if (!node) { if (children.length) warnings.push(`Children of unsupported layer “${base.name}” were also skipped.`); return undefined; }
      const parsed = DesignNodeSchema.safeParse(node);
      if (!parsed.success) { warnings.push(`Layer “${base.name}” did not pass the UDS layer schema and was skipped.`); return undefined; }
      layers += 1;
      nodesBySourceId.set(sourceId, parsed.data);
      return parsed.data;
    };
    const children = roots.map(shape => convertShape(shape, new Set())).filter((item): item is DesignNode => Boolean(item));
    return { id: pageId, name: pageName.slice(0, 120), children };
  };
  for (const page of pageRows) pages.push(convertPage(page));

  const componentDefinitions: DesignSystem["components"] = [];
  const usedNames = new Set<string>();
  for (const component of components) {
    const mainId = typeof component.mainInstanceId === "string" ? component.mainInstanceId : "";
    const root = nodesBySourceId.get(mainId);
    if (!root || root.type === "component-instance") continue;
    const name = typeof component.name === "string" ? component.name : root.name;
    const clone = (node: DesignNode): DesignNode => "children" in node
      ? { ...node, id: randomUUID(), children: node.children.map(clone) } as DesignNode
      : { ...node, id: randomUUID() } as DesignNode;
    componentDefinitions.push({ id: randomUUID(), name: uniqueName(name, usedNames), root: clone(root), properties: [], variants: [] });
  }
  return { pages, nodesBySourceId, layers, componentDefinitions };
}

export function convertPenpotV3Archive(bytes: Buffer, existing: DesignSystem): PenpotConversion {
  const json = readZipJson(bytes);
  const manifest = json.get("manifest.json");
  if (!isRecord(manifest) || manifest.type !== "penpot/export-files" || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error("This is not a supported Penpot v3 export archive.");
  }
  const warnings: string[] = [];
  const importedSystems: DesignSystem[] = [];
  const filePages: DesignDocument["pages"] = [];
  const componentDefinitions: DesignSystem["components"] = [];
  let layersImported = 0;
  const fileRows = manifest.files.filter(isRecord).slice(0, 20);
  if (manifest.files.length > 20) warnings.push("Only the first 20 Penpot files in this archive were imported.");
  for (const file of fileRows) {
    if (typeof file.id !== "string" || !/^[0-9a-f-]{36}$/i.test(file.id)) { warnings.push("Skipped a Penpot file with an invalid identifier."); continue; }
    const fileMetadata = json.get(`files/${file.id}.json`);
    if (!isRecord(fileMetadata)) { warnings.push(`Skipped “${String(file.name ?? "Penpot file") }” because its metadata was missing.`); continue; }
    const components = [...json.entries()].filter(([path, value]) => path.startsWith(`files/${file.id}/components/`) && path.endsWith(".json") && isRecord(value)).map(([, value]) => value as JsonRecord);
    let importedTokens: DesignSystem | undefined;
    const tokenJson = json.get(`files/${file.id}/tokens.json`);
    if (tokenJson !== undefined) {
      try {
        importedTokens = importInterchangeTokens(tokenJson, createDefaultDesignSystem()).designSystem;
        if (!importedTokens.tokens.length) warnings.push(`No supported tokens were found in “${String(file.name ?? "Penpot file") }”.`);
        else importedSystems.push(importedTokens);
      } catch { warnings.push(`Design tokens in “${String(file.name ?? "Penpot file") }” could not be converted.`); }
    }
    const conversion = makePages(json, file.id, warnings, components);
    filePages.push(...conversion.pages.map(page => ({ ...page, name: fileRows.length > 1 ? `${String(file.name ?? "Imported")}: ${page.name}`.slice(0, 120) : page.name })));
    layersImported += conversion.layers;
    componentDefinitions.push(...conversion.componentDefinitions);
  }
  if (!filePages.length) throw new Error("The Penpot archive contains no pages that UDS can import.");
  let designSystem = existing;
  let tokensImported = 0;
  for (const imported of importedSystems) {
    const merged = mergeDesignSystem(designSystem, imported);
    tokensImported += imported.tokens.length;
    designSystem = merged;
  }
  if (componentDefinitions.length) {
    const used = new Set(designSystem.components.map(item => item.name.toLocaleLowerCase()));
    const renamed = componentDefinitions.map(item => ({ ...item, name: uniqueName(item.name, used) }));
    designSystem = { ...designSystem, components: [...designSystem.components, ...renamed] };
  }
  const colorValues = new Map<string, string[]>();
  for (const token of designSystem.tokens) {
    if (token.type !== "color" || token.value.type !== "color") continue;
    const key = token.value.value.toLocaleLowerCase();
    colorValues.set(key, [...(colorValues.get(key) ?? []), token.id]);
  }
  const bindMatchingTokens = (node: DesignNode): DesignNode => {
    let next = node;
    if (node.type === "text" && !node.colorTokenId) {
      const matches = colorValues.get(node.color.toLocaleLowerCase()) ?? [];
      if (matches.length === 1) next = { ...node, colorTokenId: matches[0] };
    } else if (node.type === "shape" && !node.fillTokenId) {
      const matches = colorValues.get(node.fill.toLocaleLowerCase()) ?? [];
      if (matches.length === 1) next = { ...node, fillTokenId: matches[0] };
    }
    return "children" in next ? { ...next, children: next.children.map(bindMatchingTokens) } as DesignNode : next;
  };
  const boundPages = filePages.map(page => ({ ...page, children: page.children.map(bindMatchingTokens) }));
  designSystem = {
    ...designSystem,
    components: designSystem.components.map(component => {
      const root = DesignNodeSchema.safeParse(component.root);
      return root.success ? { ...component, root: bindMatchingTokens(root.data) } : component;
    }),
  };
  const validated = DesignDocumentSchema.safeParse({
    schemaVersion: 2,
    documentId: randomUUID(),
    revision: 0,
    metadata: { name: "Penpot import", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
    designSystem,
    pages: boundPages,
  });
  if (!validated.success) throw new Error(`Penpot content could not be represented as an editable UDS document: ${validated.error.issues[0]?.message ?? "invalid imported document"}.`);
  const validatedSystem = validated.data.designSystem;
  const names = new Set(existing.components.map(item => item.name.toLocaleLowerCase()));
  const componentsImported = validatedSystem.components.filter(item => !names.has(item.name.toLocaleLowerCase())).length;
  return {
    pages: validated.data.pages,
    designSystem: validatedSystem,
    layersImported,
    tokensImported,
    componentsImported,
    warnings: [...new Set(warnings)].slice(0, 20),
  };
}
