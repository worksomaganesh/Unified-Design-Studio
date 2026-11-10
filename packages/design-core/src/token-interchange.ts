import {
  DesignSystemSchema,
  DesignTokenValueSchema,
  type DesignSystem,
  type DesignToken,
  type DesignTokenType,
  type DesignTokenValue,
} from "./index.js";

const MAX_IMPORT_TOKENS = 5_000;
const DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";

type RecordValue = Record<string, unknown>;
type ImportedRecord = { set: string; name: string; type: DesignTokenType; raw: unknown };
type ParsedRaw = { value?: DesignTokenValue; alias?: string };
type ImportMode = { id: string; name: string; group: string; selectedSets: Set<string> };

function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function tokenType(raw: unknown): DesignTokenType | undefined {
  if (typeof raw !== "string") return undefined;
  const names: Record<string, DesignTokenType> = {
    color: "color", number: "number", dimension: "dimension", fontFamily: "font-family", fontFamilies: "font-family",
    "font-family": "font-family", fontSize: "font-size", fontSizes: "font-size", "font-size": "font-size",
    lineHeight: "line-height", "line-height": "line-height", borderRadius: "radius", radius: "radius",
    shadow: "shadow", border: "border",
  };
  return names[raw];
}

function colorValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return DesignTokenValueSchema.safeParse({ type: "color", value: raw }).success ? raw : undefined;
  if (!record(raw)) return undefined;
  if (typeof raw.hex === "string" && DesignTokenValueSchema.safeParse({ type: "color", value: raw.hex }).success) return raw.hex;
  if (raw.colorSpace !== "srgb" || !Array.isArray(raw.components) || raw.components.length < 3) return undefined;
  const components = raw.components.slice(0, 3);
  if (!components.every(item => typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 1)) return undefined;
  const alpha = raw.alpha === undefined ? 1 : raw.alpha;
  if (typeof alpha !== "number" || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) return undefined;
  const hex = components.map(item => Math.round((item as number) * 255).toString(16).padStart(2, "0")).join("");
  const value = `#${hex}${alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, "0") : ""}`;
  return DesignTokenValueSchema.safeParse({ type: "color", value }).success ? value : undefined;
}

function dimensionValue(raw: unknown, allowPercent = false): { value: number; unit: "px" | "rem" | "%" } | undefined {
  let value: unknown;
  let unit: unknown;
  if (record(raw)) { value = raw.value; unit = raw.unit; }
  else if (typeof raw === "string") {
    const match = raw.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|rem|%)?$/i);
    if (!match) return undefined;
    value = Number(match[1]); unit = match[2] ?? "px";
  } else { return undefined; }
  if (typeof value !== "number" || !Number.isFinite(value) || !["px", "rem", ...(allowPercent ? ["%"] : [])].includes(String(unit))) return undefined;
  return { value, unit: String(unit) as "px" | "rem" | "%" };
}

function directValue(type: DesignTokenType, raw: unknown): DesignTokenValue | undefined {
  if (typeof raw === "string") {
    const alias = raw.trim().match(/^\{([^{}]+)\}$/);
    if (alias) return undefined;
  }
  let candidate: unknown;
  switch (type) {
    case "color": {
      const value = colorValue(raw);
      if (value === undefined) return undefined;
      candidate = { type, value }; break;
    }
    case "number":
      candidate = { type, value: raw }; break;
    case "dimension": {
      const dimension = dimensionValue(raw);
      if (!dimension) return undefined;
      candidate = { type, ...dimension }; break;
    }
    case "font-family": {
      const value = typeof raw === "string" ? raw : Array.isArray(raw) && raw.every(item => typeof item === "string") ? raw.join(", ") : undefined;
      if (value === undefined) return undefined;
      candidate = { type, value }; break;
    }
    case "font-size": {
      const dimension = dimensionValue(raw);
      if (!dimension || dimension.unit === "%") return undefined;
      candidate = { type, ...dimension }; break;
    }
    case "line-height": {
      let value = raw;
      if (typeof raw === "string" && /^-?(?:\d+\.?\d*|\.\d+)%$/.test(raw.trim())) value = Number(raw.trim().slice(0, -1)) / 100;
      else if (typeof raw === "string" && raw.trim() !== "") value = Number(raw);
      candidate = { type, value }; break;
    }
    case "radius": {
      const dimension = dimensionValue(raw, true);
      if (!dimension || dimension.value < 0) return undefined;
      candidate = { type, ...dimension }; break;
    }
    case "shadow": {
      if (typeof raw === "string") candidate = { type, value: raw };
      else if (record(raw) && typeof raw.color === "string") {
        const x = dimensionValue(raw.offsetX ?? raw.x, true);
        const y = dimensionValue(raw.offsetY ?? raw.y, true);
        const blur = dimensionValue(raw.blur ?? "0px", true);
        const spread = dimensionValue(raw.spread ?? "0px", true);
        if (!x || !y || !blur || !spread) return undefined;
        candidate = { type, value: `${raw.inset === true || raw.type === "innerShadow" ? "inset " : ""}${x.value}${x.unit} ${y.value}${y.unit} ${blur.value}${blur.unit} ${spread.value}${spread.unit} ${raw.color}` };
      } else return undefined;
      break;
    }
    case "border": {
      if (typeof raw === "string") candidate = { type, value: raw };
      else if (record(raw)) {
        const width = dimensionValue(raw.width);
        const color = colorValue(raw.color);
        if (!width || !color || typeof raw.style !== "string" || !/^(solid|dashed|dotted|double|none)$/i.test(raw.style)) return undefined;
        candidate = { type, value: `${width.value}${width.unit} ${raw.style} ${color}` };
      } else return undefined;
      break;
    }
  }
  const parsed = DesignTokenValueSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function readTokenType(node: RecordValue, inherited?: DesignTokenType): DesignTokenType | undefined {
  const extensions = record(node.$extensions) ? node.$extensions["com.unified-design-studio"] : undefined;
  const internalType = record(extensions) ? tokenType(extensions.type) : undefined;
  return internalType ?? tokenType(node.$type ?? node.type) ?? inherited;
}

function collectTokens(setName: string, source: unknown, warnings: string[]): ImportedRecord[] {
  const output: ImportedRecord[] = [];
  const visit = (value: unknown, path: string[], inheritedType?: DesignTokenType) => {
    if (!record(value)) return;
    const isDtcgToken = Object.hasOwn(value, "$value");
    const isLegacyToken = Object.hasOwn(value, "value") && typeof value.type === "string";
    if (isDtcgToken || isLegacyToken) {
      const name = path.join(".").trim();
      const type = readTokenType(value, inheritedType);
      if (!name || name.length > 80 || !type) { warnings.push(`Skipped unsupported or unnamed token in set “${setName}”.`); return; }
      output.push({ set: setName, name, type, raw: isDtcgToken ? value.$value : value.value });
      return;
    }
    const nextType = readTokenType(value, inheritedType);
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("$")) continue;
      if (key === "type" || key === "value") continue;
      if (key === "$root") visit(child, path, nextType);
      else visit(child, [...path, key], nextType);
    }
  };
  visit(source, []);
  return output;
}

function parseRoot(input: string | unknown): RecordValue {
  let value = input;
  if (typeof input === "string") {
    try { value = JSON.parse(input) as unknown; }
    catch { throw new Error("The selected token file is not valid JSON."); }
  }
  if (!record(value)) throw new Error("The selected token file must contain a JSON object.");
  return value;
}

function importModes(root: RecordValue, setNames: string[]): ImportMode[] {
  const themeRows = Array.isArray(root.$themes) ? root.$themes.filter(record) : [];
  if (themeRows.length) {
    const groups = new Map<string, string>();
    return themeRows.slice(0, 100).map((theme, index) => {
      const group = typeof theme.group === "string" && theme.group.trim() ? theme.group.trim().slice(0, 80) : "Imported";
      if (!groups.has(group)) groups.set(group, `interchange-theme-${groups.size}`);
      const selected = record(theme.selectedTokenSets) ? theme.selectedTokenSets : {};
      const selectedSets = new Set(Object.entries(selected).filter(([, state]) => state !== "disabled").map(([name]) => name));
      return { id: `interchange-mode-${index}`, name: (typeof theme.name === "string" && theme.name.trim() ? theme.name.trim() : `Mode ${index + 1}`).slice(0, 80), group: groups.get(group)!, selectedSets };
    });
  }
  const metadata = record(root.$metadata) ? root.$metadata : {};
  const activeSets = Array.isArray(metadata.activeSets) ? metadata.activeSets.filter((item): item is string => typeof item === "string") : setNames;
  return [{ id: "interchange-mode-0", name: "Default", group: "Imported", selectedSets: new Set(activeSets) }];
}

function aliasReference(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  return raw.trim().match(/^\{([^{}]+)\}$/)?.[1]?.trim();
}

function createImportedSystem(root: RecordValue, current: DesignSystem): { designSystem: DesignSystem; warnings: string[] } {
  const warnings: string[] = [];
  const metadata = record(root.$metadata) ? root.$metadata : {};
  const metadataOrder = Array.isArray(metadata.tokenSetOrder) ? metadata.tokenSetOrder.filter((item): item is string => typeof item === "string") : [];
  const reserved = new Set(["$schema", "$themes", "$metadata"]);
  const keyedSets = Object.keys(root).filter(key => !reserved.has(key));
  const hasSetWrapper = metadataOrder.length > 0 || Array.isArray(root.$themes);
  const setNames = hasSetWrapper ? [...metadataOrder.filter(name => keyedSets.includes(name)), ...keyedSets.filter(name => !metadataOrder.includes(name))] : ["base"];
  const allRecords = setNames.flatMap(set => collectTokens(set, hasSetWrapper ? root[set] : root, warnings));
  if (allRecords.length > MAX_IMPORT_TOKENS) throw new Error(`This token file contains more than ${MAX_IMPORT_TOKENS} tokens.`);
  if (!allRecords.length) throw new Error("No supported design tokens were found in the selected JSON file.");

  const byName = new Map<string, ImportedRecord[]>();
  for (const item of allRecords) {
    const key = item.name.toLocaleLowerCase();
    const existing = byName.get(key);
    if (existing && existing[0].type !== item.type) { warnings.push(`Skipped “${item.name}” because the same token name has different types in its sets.`); continue; }
    if (!existing) byName.set(key, []);
    byName.get(key)!.push(item);
  }
  const modes = importModes(root, setNames);
  const groupNames = [...new Set(modes.map(mode => mode.group))];
  const themes = groupNames.map((name, index) => ({ id: `interchange-theme-${index}`, name }));
  for (const mode of modes) {
    mode.group = themes.find(theme => theme.name === mode.group)?.id ?? themes[0]?.id ?? "interchange-theme-0";
  }
  const modeNames = new Map<string, Set<string>>();
  for (const mode of modes) {
    const names = modeNames.get(mode.group) ?? new Set<string>();
    const base = mode.name;
    let suffix = 2;
    while (names.has(mode.name.toLocaleLowerCase())) mode.name = `${base.slice(0, Math.max(1, 76 - String(suffix).length))} ${suffix++}`;
    names.add(mode.name.toLocaleLowerCase()); modeNames.set(mode.group, names);
  }

  const modeTokens = modes.map(mode => {
    const byToken = new Map<string, ImportedRecord>();
    for (const set of setNames) {
      if (!mode.selectedSets.has(set)) continue;
      for (const item of allRecords) if (item.set === set && byName.get(item.name.toLocaleLowerCase())?.includes(item)) byToken.set(item.name.toLocaleLowerCase(), item);
    }
    return byToken;
  });

  const names = [...byName.entries()];
  const idByName = new Map<string, string>();
  for (const [key, rows] of names) {
    const previous = current.tokens.find(token => token.name.toLocaleLowerCase() === key && token.type === rows[0].type);
    idByName.set(key, previous?.id ?? `interchange-token-${idByName.size}`);
  }
  const aliasTarget = (reference: string, source: ImportedRecord): string | undefined => {
    const normalized = reference.replace(/^\{?|\}?$/g, "").toLocaleLowerCase();
    const direct = idByName.get(normalized);
    if (direct) return direct;
    const candidates = names.filter(([key]) => key.endsWith(`.${normalized}`));
    const sameSet = candidates.filter(([, rows]) => rows.some(row => row.set === source.set));
    const choices = sameSet.length ? sameSet : candidates;
    return choices.length === 1 ? idByName.get(choices[0][0]) : undefined;
  };
  const valuesByMode: Map<string, DesignTokenValue>[] = modeTokens.map(() => new Map());
  const resolving = new Set<string>();
  const resolveValue = (nameKey: string, modeIndex: number): DesignTokenValue | undefined => {
    const cache = valuesByMode[modeIndex];
    if (cache.has(nameKey)) return cache.get(nameKey);
    const row = modeTokens[modeIndex].get(nameKey) ?? byName.get(nameKey)?.[0];
    if (!row) return undefined;
    const resolveKey = `${modeIndex}:${nameKey}`;
    if (resolving.has(resolveKey)) return undefined;
    resolving.add(resolveKey);
    const reference = aliasReference(row.raw);
    let value: DesignTokenValue | undefined;
    if (reference) {
      const targetId = aliasTarget(reference, row);
      const targetName = targetId ? [...idByName].find(([, id]) => id === targetId)?.[0] : undefined;
      const target = targetName ? byName.get(targetName)?.[0] : undefined;
      if (target && target.type === row.type) value = resolveValue(targetName!, modeIndex);
      if (!value) warnings.push(`Could not resolve token reference {${reference}} used by “${row.name}”.`);
      else warnings.push(`Resolved token reference in “${row.name}” to its current value for interchange.`);
    } else value = directValue(row.type, row.raw);
    resolving.delete(resolveKey);
    if (!value) { warnings.push(`Skipped unsupported value for “${row.name}” (${row.type}).`); return undefined; }
    cache.set(nameKey, value);
    return value;
  };

  const tokens: DesignToken[] = [];
  for (const [key, rows] of names) {
    const firstMode = modeTokens.findIndex(mode => mode.has(key));
    const defaultIndex = firstMode < 0 ? 0 : firstMode;
    const baseValue = resolveValue(key, defaultIndex);
    if (!baseValue) continue;
    const modeValues: Record<string, DesignTokenValue> = {};
    modes.forEach((mode, index) => {
      if (index === defaultIndex) return;
      const modeValue = resolveValue(key, index);
      if (modeValue && JSON.stringify(modeValue) !== JSON.stringify(baseValue)) modeValues[mode.id] = modeValue;
    });
    tokens.push({ id: idByName.get(key)!, name: rows[0].name, type: rows[0].type, value: baseValue, modeValues });
  }
  if (!tokens.length) throw new Error("No token values in this file could be converted to the supported design-system types.");
  const designSystem = DesignSystemSchema.parse({ themes, modes: modes.map(({ id, name, group }) => ({ id, name, themeId: group })), tokens, components: current.components });
  return { designSystem, warnings: [...new Set(warnings)].slice(0, 20) };
}

export function importInterchangeTokens(input: string | unknown, current: DesignSystem): { designSystem: DesignSystem; warnings: string[] } {
  return createImportedSystem(parseRoot(input), current);
}

function toDtcgValue(token: DesignToken, value: DesignTokenValue): { type: string; value: unknown } | undefined {
  switch (value.type) {
    case "color": {
      const match = value.value.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i);
      if (!match) return undefined;
      let hex = match[1];
      if (hex.length === 3 || hex.length === 4) hex = [...hex].map(char => char + char).join("");
      const hasAlpha = hex.length === 8;
      const components = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
      const alpha = hasAlpha ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { type: "color", value: { colorSpace: "srgb", components, ...(hasAlpha ? { alpha } : {}), hex: `#${hex.slice(0, 6)}` } };
    }
    case "number": return { type: "number", value: value.value };
    case "dimension": return value.unit === "%" ? undefined : { type: "dimension", value: { value: value.value, unit: value.unit } };
    case "font-family": return { type: "fontFamily", value: value.value };
    case "font-size": return { type: "dimension", value: { value: value.value, unit: value.unit } };
    case "line-height": return { type: "number", value: value.value };
    case "radius": return value.unit === "%" ? undefined : { type: "dimension", value: { value: value.value, unit: value.unit } };
    default: return undefined;
  }
}

function safePath(name: string): string[] | undefined {
  const parts = name.split(".");
  if (!parts.length || parts.some(part => !part || part.startsWith("$") || /[{}]/.test(part))) return undefined;
  return parts;
}

function setNestedToken(root: RecordValue, token: DesignToken, rawValue: unknown, dtcgType: string, warnings: string[]): boolean {
  const path = safePath(token.name);
  if (!path) { warnings.push(`Skipped “${token.name}” because its name cannot be represented safely in DTCG JSON.`); return false; }
  let cursor = root;
  for (const segment of path.slice(0, -1)) {
    const child = cursor[segment];
    if (child !== undefined && !record(child)) { warnings.push(`Skipped “${token.name}” because its name conflicts with another token path.`); return false; }
    if (child === undefined) cursor[segment] = Object.create(null) as RecordValue;
    cursor = cursor[segment] as RecordValue;
  }
  const leaf = path[path.length - 1];
  if (cursor[leaf] !== undefined) { warnings.push(`Skipped “${token.name}” because its name conflicts with another token path.`); return false; }
  cursor[leaf] = { $type: dtcgType, $value: rawValue, $extensions: { "com.unified-design-studio": { type: token.type } } };
  return true;
}

export function exportDtcgTokens(system: DesignSystem): { json: string; warnings: string[] } {
  const warnings: string[] = [];
  const base = Object.create(null) as RecordValue;
  const overrides = new Map<string, RecordValue>();
  const overrideSetNames = new Map<string, string>();
  const themes: RecordValue[] = [];
  const tokenById = new Map(system.tokens.map(token => [token.id, token]));
  const supportedType = (type: DesignTokenType) => ({ color: "color", number: "number", dimension: "dimension", "font-family": "fontFamily", "font-size": "dimension", "line-height": "number", radius: "dimension" } as Partial<Record<DesignTokenType, string>>)[type];
  const insert = (token: DesignToken, modeId?: string) => {
    const value = modeId ? token.modeValues[modeId] : token.value;
    if (!supportedType(token.type)) { warnings.push(`Omitted “${token.name}” (${token.type}); this token type is not in the supported DTCG subset.`); return; }
    if (!modeId && token.aliasOf) {
      const target = tokenById.get(token.aliasOf);
      if (target) setNestedToken(base, token, `{${target.name}}`, supportedType(token.type)!, warnings);
      else warnings.push(`Omitted “${token.name}” because its alias target is missing.`);
      return;
    }
    if (value) {
      const converted = toDtcgValue(token, value);
      if (!converted) { warnings.push(`Omitted “${token.name}” in one set because its value cannot be represented in DTCG.`); return; }
      setNestedToken(modeId ? overrides.get(modeId)! : base, token, converted.value, converted.type, warnings);
    }
  };
  for (const token of system.tokens) insert(token);
  for (const mode of system.modes) {
    const setName = `mode-${mode.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const set = Object.create(null) as RecordValue;
    overrides.set(mode.id, set);
    overrideSetNames.set(mode.id, setName);
    for (const token of system.tokens) if (token.modeValues?.[mode.id]) insert(token, mode.id);
    const hasOverrides = Object.keys(set).length > 0;
    const selectedTokenSets: Record<string, string> = { base: "source" };
    if (hasOverrides) selectedTokenSets[setName] = "enabled";
    themes.push({ name: mode.name, group: system.themes.find(theme => theme.id === mode.themeId)?.name ?? "Default", selectedTokenSets });
  }
  const tokenSetOrder = ["base", ...system.modes.map(mode => overrideSetNames.get(mode.id)!)];
  const output: RecordValue = {
    $schema: DTCG_SCHEMA,
    $metadata: { tokenSetOrder },
    $themes: themes,
    base,
  };
  for (const mode of system.modes) {
    const name = overrideSetNames.get(mode.id)!;
    output[name] = overrides.get(mode.id);
  }
  return { json: JSON.stringify(output, null, 2), warnings: [...new Set(warnings)].slice(0, 20) };
}
