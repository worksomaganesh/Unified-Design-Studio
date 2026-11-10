import {
  DesignSystemSchema,
  DesignTokenValueSchema,
  type DesignSystem,
  type DesignToken,
  type DesignTokenValue,
} from "./index.js";

type RecordValue = Record<string, unknown>;
type FigmaCollection = {
  id: string;
  name: string;
  defaultModeId: string;
  modes: { modeId: string; name: string }[];
  remote: boolean;
  isExtension: boolean;
};
type FigmaVariable = {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, unknown>;
  remote: boolean;
};

const MAX_FIGMA_VARIABLES = 5_000;
const MAX_FIGMA_COLLECTIONS = 100;
const MAX_FIGMA_MODES_PER_COLLECTION = 40;

function record(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeColor(value: unknown): DesignTokenValue | undefined {
  if (!record(value)) return undefined;
  const red = value.r;
  const green = value.g;
  const blue = value.b;
  const alpha = value.a ?? 1;
  if (![red, green, blue, alpha].every(component => typeof component === "number" && Number.isFinite(component) && component >= 0 && component <= 1)) return undefined;
  const hex = [red, green, blue].map(component => Math.round((component as number) * 255).toString(16).padStart(2, "0")).join("");
  const opacity = Math.round((alpha as number) * 255);
  const parsed = DesignTokenValueSchema.safeParse({ type: "color", value: `#${hex}${opacity < 255 ? opacity.toString(16).padStart(2, "0") : ""}` });
  return parsed.success ? parsed.data : undefined;
}

function convertValue(type: FigmaVariable["resolvedType"], raw: unknown): DesignTokenValue | undefined {
  if (type === "COLOR") return normalizeColor(raw);
  if (type === "FLOAT" && typeof raw === "number") {
    const parsed = DesignTokenValueSchema.safeParse({ type: "number", value: raw });
    return parsed.success ? parsed.data : undefined;
  }
  if (type === "STRING" && typeof raw === "string") {
    const parsed = DesignTokenValueSchema.safeParse({ type: "font-family", value: raw });
    return parsed.success ? parsed.data : undefined;
  }
  return undefined;
}

function asCollection(value: unknown, fallbackId: string): FigmaCollection | undefined {
  if (!record(value)) return undefined;
  const id = text(value.id) ?? fallbackId;
  const name = text(value.name);
  if (!name) return undefined;
  const modes = Array.isArray(value.modes) ? value.modes.flatMap((item, index) => {
    if (!record(item)) return [];
    const modeId = text(item.modeId);
    const modeName = text(item.name);
    return modeId && modeName ? [{ modeId, name: modeName.slice(0, 80) }] : [];
  }) : [];
  if (!modes.length) return undefined;
  const defaultModeId = text(value.defaultModeId) ?? modes[0].modeId;
  return { id, name: name.slice(0, 80), defaultModeId, modes, remote: value.remote === true, isExtension: value.isExtension === true };
}

function asVariable(value: unknown, fallbackId: string): FigmaVariable | undefined {
  if (!record(value)) return undefined;
  const id = text(value.id) ?? fallbackId;
  const name = text(value.name);
  const variableCollectionId = text(value.variableCollectionId);
  const resolvedType = value.resolvedType;
  if (!name || !variableCollectionId || !["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(String(resolvedType)) || !record(value.valuesByMode)) return undefined;
  return { id, name, variableCollectionId, resolvedType: resolvedType as FigmaVariable["resolvedType"], valuesByMode: value.valuesByMode, remote: value.remote === true };
}

function unwrapResponse(input: string | unknown): { variableCollections: RecordValue; variables: RecordValue } {
  let value = input;
  if (typeof input === "string") {
    try { value = JSON.parse(input) as unknown; }
    catch { throw new Error("The selected Figma Variables file is not valid JSON."); }
  }
  if (!record(value) || !record(value.meta) || !record(value.meta.variableCollections) || !record(value.meta.variables)) {
    throw new Error("This is not a Figma Variables API response. Import JSON from the file's local Variables endpoint.");
  }
  const meta = value.meta as RecordValue;
  return { variableCollections: meta.variableCollections as RecordValue, variables: meta.variables as RecordValue };
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function uniqueNewId(base: string, used: Set<string>, reserved: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id) || reserved.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function variableIdFor(current: DesignSystem, name: string, type: DesignToken["type"], sourceId: string, used: Set<string>, reserved: Set<string>): string {
  const previous = current.tokens.find(token => token.name.toLocaleLowerCase() === name.toLocaleLowerCase() && token.type === type && !used.has(token.id));
  return previous ? uniqueId(previous.id, used) : uniqueNewId(`figma-token-${sourceId}`, used, reserved);
}

export function importFigmaVariables(input: string | unknown, current: DesignSystem): { designSystem: DesignSystem; warnings: string[] } {
  const meta = unwrapResponse(input);
  const warnings: string[] = [];
  const collections = Object.entries(meta.variableCollections).flatMap(([id, value]) => {
    const collection = asCollection(value, id);
    if (!collection) { warnings.push(`Skipped an invalid Figma variable collection (${id}).`); return []; }
    if (collection.remote) { warnings.push(`Skipped remote collection “${collection.name}”; this file only imports variables created locally.`); return []; }
    if (collection.isExtension) { warnings.push(`Skipped extended collection “${collection.name}”; extension inheritance is not represented in the UDS document model.`); return []; }
    if (collection.modes.length > MAX_FIGMA_MODES_PER_COLLECTION) warnings.push(`Collection “${collection.name}” exceeds Figma's ${MAX_FIGMA_MODES_PER_COLLECTION}-mode limit; extra modes were skipped.`);
    return [{ ...collection, modes: collection.modes.slice(0, MAX_FIGMA_MODES_PER_COLLECTION) }];
  }).slice(0, MAX_FIGMA_COLLECTIONS);
  if (Object.keys(meta.variableCollections).length > MAX_FIGMA_COLLECTIONS) warnings.push(`Only the first ${MAX_FIGMA_COLLECTIONS} Figma collections were considered.`);
  if (!collections.length) throw new Error("No supported local Figma variable collections were found.");

  const sourceVariables = Object.entries(meta.variables).flatMap(([id, value]) => {
    const variable = asVariable(value, id);
    if (!variable) { warnings.push(`Skipped invalid Figma variable (${id}).`); return []; }
    if (variable.remote) { warnings.push(`Skipped remote variable “${variable.name}”; remote library values are not copied into the local design system.`); return []; }
    if (!collections.some(collection => collection.id === variable.variableCollectionId)) return [];
    return [variable];
  });
  if (sourceVariables.length > MAX_FIGMA_VARIABLES) throw new Error(`This Figma file contains more than ${MAX_FIGMA_VARIABLES} local variables.`);
  const variables = new Map(sourceVariables.map(variable => [variable.id, variable]));
  const collectionById = new Map(collections.map(collection => [collection.id, collection]));

  const uniqueThemeName = (base: string, used: Set<string>) => {
    let name = base.slice(0, 80);
    let suffix = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${base.slice(0, 75)} ${suffix++}`;
    used.add(name.toLocaleLowerCase());
    return name;
  };
  const usedThemeNames = new Set<string>();
  const usedThemeIds = new Set<string>();
  const reservedThemeIds = new Set(current.themes.map(theme => theme.id));
  const usedModeNames = new Map<string, Set<string>>();
  const themes = collections.map((collection, index) => {
    const name = uniqueThemeName(collection.name, usedThemeNames);
    const previous = current.themes.find(theme => theme.name.toLocaleLowerCase() === name.toLocaleLowerCase() && !usedThemeIds.has(theme.id));
    const id = previous
      ? uniqueId(previous.id, usedThemeIds)
      : uniqueNewId(`figma-import-theme-${index}`, usedThemeIds, reservedThemeIds);
    return { id, name };
  });
  const themeIdByCollection = new Map(collections.map((collection, index) => [collection.id, themes[index].id]));
  const modes = collections.flatMap((collection, collectionIndex) => {
    const themeId = themeIdByCollection.get(collection.id)!;
    const names = usedModeNames.get(themeId) ?? new Set<string>();
    const mapped = collection.modes.map((mode, modeIndex) => {
      let name = mode.name;
      let suffix = 2;
      while (names.has(name.toLocaleLowerCase())) name = `${mode.name.slice(0, 75)} ${suffix++}`;
      names.add(name.toLocaleLowerCase());
      const previous = current.modes.find(item => item.themeId === themeId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      return { id: previous?.id ?? `figma-import-mode-${collectionIndex}-${modeIndex}`, reuseId: Boolean(previous), themeId, name, sourceId: mode.modeId };
    });
    usedModeNames.set(themeId, names);
    return mapped;
  });
  const modeByCollectionAndSource = new Map<string, typeof modes[number]>();
  const usedModeIds = new Set<string>();
  const reservedModeIds = new Set(current.modes.map(mode => mode.id));
  for (const mode of modes) mode.id = mode.reuseId
    ? uniqueId(mode.id, usedModeIds)
    : uniqueNewId(mode.id, usedModeIds, reservedModeIds);
  for (const collection of collections) for (const mode of collection.modes) {
    const mapped = modes.find(item => item.themeId === themeIdByCollection.get(collection.id) && item.sourceId === mode.modeId);
    if (mapped) modeByCollectionAndSource.set(`${collection.id}:${mode.modeId}`, mapped);
  }

  const resolving = new Set<string>();
  const resolveVariable = (variable: FigmaVariable, modeId: string): DesignTokenValue | undefined => {
    const collection = collectionById.get(variable.variableCollectionId);
    if (!collection) return undefined;
    const cacheKey = `${variable.id}:${modeId}`;
    if (resolving.has(cacheKey)) { warnings.push(`Skipped cyclic Figma variable alias used by “${variable.name}”.`); return undefined; }
    resolving.add(cacheKey);
    const raw = variable.valuesByMode[modeId] ?? variable.valuesByMode[collection.defaultModeId];
    let result: DesignTokenValue | undefined;
    if (record(raw) && raw.type === "VARIABLE_ALIAS" && typeof raw.id === "string") {
      const target = variables.get(raw.id);
      if (target && target.resolvedType === variable.resolvedType) {
        const targetCollection = collectionById.get(target.variableCollectionId);
        const sourceMode = collection.modes.find(item => item.modeId === modeId);
        const correspondingMode = targetCollection?.modes.find(item => item.name.toLocaleLowerCase() === sourceMode?.name.toLocaleLowerCase());
        const targetMode = correspondingMode?.modeId ?? targetCollection?.defaultModeId;
        if (targetMode) result = resolveVariable(target, targetMode);
      }
      if (result) warnings.push(`Resolved Figma alias in “${variable.name}” to its current value; the variable link is not retained.`);
      else warnings.push(`Could not resolve Figma alias in “${variable.name}”.`);
    } else {
      result = convertValue(variable.resolvedType, raw);
      if (variable.resolvedType === "STRING" && result) warnings.push(`Mapped Figma string variable “${variable.name}” to a UDS font-family token.`);
    }
    resolving.delete(cacheKey);
    return result;
  };

  const tokens: DesignToken[] = [];
  const usedTokenNames = new Set<string>();
  const usedTokenIds = new Set<string>();
  const reservedTokenIds = new Set(current.tokens.map(token => token.id));
  for (const variable of sourceVariables) {
    const collection = collectionById.get(variable.variableCollectionId)!;
    const configuredDefault = collection.modes.find(mode => mode.modeId === collection.defaultModeId) ?? collection.modes[0];
    const typedDefault = convertValue(variable.resolvedType, variable.valuesByMode[configuredDefault.modeId]);
    const resolvedDefault = typedDefault ?? resolveVariable(variable, configuredDefault.modeId);
    const fallbackMode = collection.modes.find(mode => Boolean(resolveVariable(variable, mode.modeId)));
    const defaultMode = resolvedDefault ? configuredDefault : fallbackMode ?? configuredDefault;
    const baseValue = resolvedDefault ?? (fallbackMode ? resolveVariable(variable, fallbackMode.modeId) : undefined);
    if (!baseValue) {
      warnings.push(`Skipped “${variable.name}” (${variable.resolvedType}); its value cannot be represented by a UDS token.`);
      continue;
    }
    const type = baseValue.type;
    const collectionName = themes[collections.findIndex(item => item.id === collection.id)].name;
    const localName = variable.name.replaceAll("/", ".");
    const qualifiedName = `${collectionName}.${localName}`;
    const previous = current.tokens.find(token => !usedTokenIds.has(token.id) && token.type === type && [qualifiedName, localName].some(name => token.name.toLocaleLowerCase() === name.toLocaleLowerCase()));
    const tokenName = previous?.name ?? qualifiedName;
    if (tokenName.length > 80) { warnings.push(`Skipped “${variable.name}” because its collection-qualified name exceeds 80 characters.`); continue; }
    if (usedTokenNames.has(tokenName.toLocaleLowerCase())) { warnings.push(`Skipped duplicate Figma variable name “${tokenName}”.`); continue; }
    usedTokenNames.add(tokenName.toLocaleLowerCase());
    const modeValues: Record<string, DesignTokenValue> = {};
    for (const mode of collection.modes) {
      const mappedMode = modeByCollectionAndSource.get(`${collection.id}:${mode.modeId}`);
      if (!mappedMode || mappedMode.sourceId === defaultMode.modeId) continue;
      const value = resolveVariable(variable, mode.modeId);
      if (value?.type === type && JSON.stringify(value) !== JSON.stringify(baseValue)) modeValues[mappedMode.id] = value;
    }
    const id = previous ? uniqueId(previous.id, usedTokenIds) : variableIdFor(current, tokenName, type, variable.id, usedTokenIds, reservedTokenIds);
    tokens.push({ id, name: tokenName, type, value: baseValue, modeValues });
  }
  if (!tokens.length) throw new Error("No Figma variable values could be converted to supported UDS token types.");
  const designSystem = DesignSystemSchema.parse({ themes, modes: modes.map(({ id, themeId, name }) => ({ id, themeId, name })), tokens, components: current.components });
  return { designSystem, warnings: [...new Set(warnings)].slice(0, 30) };
}

function figmaColor(value: string): RecordValue | undefined {
  const match = value.match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (!match) return undefined;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(character => character + character).join("");
  const component = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255;
  return { r: component(0), g: component(2), b: component(4), a: hex.length === 8 ? component(6) : 1 };
}

function apiType(token: DesignToken): FigmaVariable["resolvedType"] | undefined {
  if (token.type === "color") return "COLOR";
  if (token.type === "font-family") return "STRING";
  if (["number", "dimension", "font-size", "line-height", "radius"].includes(token.type)) return "FLOAT";
  return undefined;
}

function apiValue(token: DesignToken, value: DesignTokenValue): unknown {
  if (value.type === "color") return figmaColor(value.value);
  if (value.type === "font-family") return value.value;
  if (["number", "dimension", "font-size", "line-height", "radius"].includes(value.type)) return value.value;
  return undefined;
}

export function exportFigmaVariables(system: DesignSystem): { json: string; warnings: string[] } {
  const warnings: string[] = [];
  const variableCollections: RecordValue[] = [];
  const variableModes: RecordValue[] = [];
  const variables: RecordValue[] = [];
  const variableModeValues: RecordValue[] = [];
  const tokenById = new Map(system.tokens.map(token => [token.id, token]));
  const exportedId = new Map<string, string>();
  const collections = system.themes.length ? system.themes : [{ id: "theme-default", name: "Default" }];
  let exportedTokens = 0;

  collections.forEach((theme, collectionIndex) => {
    const modes = system.modes.filter(mode => mode.themeId === theme.id).slice(0, MAX_FIGMA_MODES_PER_COLLECTION);
    if (system.modes.filter(mode => mode.themeId === theme.id).length > MAX_FIGMA_MODES_PER_COLLECTION) warnings.push(`Only ${MAX_FIGMA_MODES_PER_COLLECTION} modes from “${theme.name}” were exported (Figma limit).`);
    if (!modes.length) { warnings.push(`Skipped “${theme.name}” because it has no modes.`); return; }
    const collectionId = `uds_collection_${collectionIndex}`;
    const figmaModeId = new Map(modes.map((mode, modeIndex) => [mode.id, `uds_mode_${collectionIndex}_${modeIndex}`]));
    variableCollections.push({ action: "CREATE", id: collectionId, name: theme.name.slice(0, 80), initialModeId: figmaModeId.get(modes[0].id) });
    const figmaModeNames = new Set<string>();
    modes.forEach((mode, modeIndex) => {
      const baseName = mode.name.slice(0, 40);
      let name = baseName;
      let suffix = 2;
      while (figmaModeNames.has(name.toLocaleLowerCase())) name = `${baseName.slice(0, 36)} ${suffix++}`;
      figmaModeNames.add(name.toLocaleLowerCase());
      if (name !== mode.name) warnings.push(`Adjusted mode “${mode.name}” to “${name}” for Figma's 40-character mode limit.`);
      variableModes.push({ action: modeIndex === 0 ? "UPDATE" : "CREATE", id: figmaModeId.get(mode.id), name, variableCollectionId: collectionId });
    });

    const tokenNames = new Set<string>();
    const collectionTokens = system.tokens.slice(0, MAX_FIGMA_VARIABLES);
    if (system.tokens.length > MAX_FIGMA_VARIABLES) warnings.push(`Only the first ${MAX_FIGMA_VARIABLES} tokens were considered for “${theme.name}” (Figma collection limit).`);
    for (const token of collectionTokens) {
      const resolvedType = apiType(token);
      if (!resolvedType) { warnings.push(`Omitted “${token.name}” (${token.type}); Figma Variables has no matching variable type.`); continue; }
      const name = token.name.replaceAll(".", "/");
      if (!name || name.length > 80 || /[{}]/.test(name) || tokenNames.has(name.toLocaleLowerCase())) {
        warnings.push(`Omitted “${token.name}” because its normalized Figma variable name is invalid or collides in “${theme.name}”.`);
        continue;
      }
      tokenNames.add(name.toLocaleLowerCase());
      const variableId = `uds_variable_${collectionIndex}_${exportedTokens++}`;
      exportedId.set(`${theme.id}:${token.id}`, variableId);
      variables.push({ action: "CREATE", id: variableId, name, variableCollectionId: collectionId, resolvedType });
      if (["dimension", "font-size", "radius"].includes(token.type)) warnings.push(`Figma FLOAT does not preserve the unit of “${token.name}”.`);
      if (token.type === "line-height") warnings.push(`Figma FLOAT does not preserve whether “${token.name}” was a unitless line-height.`);
    }

    for (const token of system.tokens) {
      const variableId = exportedId.get(`${theme.id}:${token.id}`);
      if (!variableId) continue;
      for (const mode of modes) {
        const modeId = figmaModeId.get(mode.id)!;
        const target = token.aliasOf ? tokenById.get(token.aliasOf) : undefined;
        const targetId = target && apiType(target) === apiType(token) ? exportedId.get(`${theme.id}:${target.id}`) : undefined;
        const value = targetId
          ? { type: "VARIABLE_ALIAS", id: targetId }
          : apiValue(token, token.modeValues[mode.id] ?? token.value);
        if (target && !targetId) warnings.push(`Exported “${token.name}” by its current value because its Figma alias target was omitted from “${theme.name}”.`);
        if (value === undefined) { warnings.push(`Omitted “${token.name}” in mode “${mode.name}” because its value cannot be represented in Figma Variables.`); continue; }
        variableModeValues.push({ variableId, modeId, value });
      }
    }
  });

  if (!variables.length) throw new Error("No design tokens can be represented by Figma Variables.");
  const json = JSON.stringify({ variableCollections, variableModes, variables, variableModeValues }, null, 2);
  if (new TextEncoder().encode(json).byteLength > 3_900_000) throw new Error("The Figma Variables API payload is too large for the API's 4 MB request limit. Export fewer tokens or modes.");
  return { json, warnings: [...new Set(warnings)].slice(0, 30) };
}
