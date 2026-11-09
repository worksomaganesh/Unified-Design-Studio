import { z } from "zod";

const id = z.string().min(1);
const cssUnit = z.enum(["px", "rem", "%"]);
const cssColor = z.string().regex(/^(#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d.,% /+-]+\)|[a-z]{1,30})$/i, "Use a CSS color value such as #6750a4 or rgb(20, 30, 40).");
const tokenValue = z.discriminatedUnion("type", [
  z.object({ type: z.literal("color"), value: cssColor }),
  z.object({ type: z.literal("number"), value: z.number() }),
  z.object({ type: z.literal("dimension"), value: z.number(), unit: cssUnit }),
  z.object({ type: z.literal("font-family"), value: z.string().min(1) }),
  z.object({ type: z.literal("font-size"), value: z.number().positive(), unit: z.enum(["px", "rem"]) }),
  z.object({ type: z.literal("line-height"), value: z.number().positive() }),
  z.object({ type: z.literal("radius"), value: z.number().nonnegative(), unit: cssUnit }),
  z.object({ type: z.literal("shadow"), value: z.string() }),
  z.object({ type: z.literal("border"), value: z.string() }),
]);

export type DesignTokenValue = z.infer<typeof tokenValue>;
export const DesignTokenValueSchema = tokenValue;

const tokenType = tokenValue.options.map(option => option.shape.type.value) as [
  "color", "number", "dimension", "font-family", "font-size", "line-height", "radius", "shadow", "border",
];
export const DESIGN_TOKEN_TYPES = tokenType;
export type DesignTokenType = typeof tokenType[number];

const designToken = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  type: z.enum(tokenType),
  value: tokenValue,
  modeValues: z.record(z.string(), tokenValue).default({}),
  aliasOf: id.optional(),
}).superRefine((token, context) => {
  if (token.value.type !== token.type) context.addIssue({ code: "custom", path: ["value"], message: "Token value type must match its declared type." });
  for (const [modeId, value] of Object.entries(token.modeValues)) {
    if (!modeId) context.addIssue({ code: "custom", path: ["modeValues"], message: "Mode IDs cannot be empty." });
    if (value.type !== token.type) context.addIssue({ code: "custom", path: ["modeValues", modeId], message: "Mode value type must match the token type." });
  }
});

const componentProperty = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  type: z.enum(["text", "color", "number", "boolean"]),
  targetNodeId: id,
  field: z.enum(["text", "color", "fill", "fontSize", "visible", "width", "height"]),
  defaultValue: z.union([z.string(), z.number().finite(), z.boolean()]),
});
const componentVariant = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  values: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])).default({}),
});
const componentDefinition = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  root: z.unknown(),
  properties: z.array(componentProperty).default([]),
  variants: z.array(componentVariant).default([]),
});

const designSystem = z.object({
  themes: z.array(z.object({ id, name: z.string().trim().min(1).max(80) })).default([]),
  modes: z.array(z.object({ id, themeId: id, name: z.string().trim().min(1).max(80) })).default([]),
  tokens: z.array(designToken).default([]),
  components: z.array(componentDefinition).default([]),
}).superRefine((system, context) => {
  const checkUniqueIds = (items: { id: string }[], path: string) => {
    const seenIds = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seenIds.has(item.id)) context.addIssue({ code: "custom", path: [path, index, "id"], message: `Duplicate ${path.slice(0, -1)} ID.` });
      seenIds.add(item.id);
    }
  };
  checkUniqueIds(system.themes, "themes");
  checkUniqueIds(system.modes, "modes");
  checkUniqueIds(system.tokens, "tokens");
  checkUniqueIds(system.components, "components");
  const uniqueNames = (items: { name: string; themeId?: string }[], path: string) => {
    const names = new Set<string>();
    for (const [index, item] of items.entries()) {
      const key = `${item.themeId ?? ""}:${item.name.trim().toLocaleLowerCase()}`;
      if (names.has(key)) context.addIssue({ code: "custom", path: [path, index, "name"], message: `Duplicate ${path.slice(0, -1)} name.` });
      names.add(key);
    }
  };
  uniqueNames(system.themes, "themes");
  uniqueNames(system.modes, "modes");
  uniqueNames(system.tokens, "tokens");
  uniqueNames(system.components, "components");

  const themeIds = new Set(system.themes.map(theme => theme.id));
  const modeIds = new Set(system.modes.map(mode => mode.id));
  const tokens = new Map(system.tokens.map(token => [token.id, token]));
  system.modes.forEach((mode, index) => {
    if (!themeIds.has(mode.themeId)) context.addIssue({ code: "custom", path: ["modes", index, "themeId"], message: "Mode must belong to an existing theme." });
  });
  system.tokens.forEach((token, index) => {
    for (const modeId of Object.keys(token.modeValues)) {
      if (!modeIds.has(modeId)) context.addIssue({ code: "custom", path: ["tokens", index, "modeValues", modeId], message: "Token override references an unknown mode." });
    }
    if (token.aliasOf) {
      const target = tokens.get(token.aliasOf);
      if (!target) context.addIssue({ code: "custom", path: ["tokens", index, "aliasOf"], message: "Alias references an unknown token." });
      else if (target.type !== token.type) context.addIssue({ code: "custom", path: ["tokens", index, "aliasOf"], message: "Alias and target token types must match." });
      const visited = new Set([token.id]);
      let cursor = target;
      while (cursor?.aliasOf) {
        if (visited.has(cursor.id)) {
          context.addIssue({ code: "custom", path: ["tokens", index, "aliasOf"], message: "Token aliases cannot contain cycles." });
          break;
        }
        visited.add(cursor.id);
        cursor = tokens.get(cursor.aliasOf);
      }
    }
  });
  system.components.forEach((component, componentIndex) => {
    const parsedRoot = DesignNodeSchema.safeParse(component.root);
    if (!parsedRoot.success) {
      context.addIssue({ code: "custom", path: ["components", componentIndex, "root"], message: "Component root must be a valid design layer." });
      return;
    }
    const rootNodes = flattenDesignNodes([parsedRoot.data]);
    const nodeById = new Map(rootNodes.map(item => [item.id, item]));
    if (rootNodes.some(item => item.type === "component-instance")) context.addIssue({ code: "custom", path: ["components", componentIndex, "root"], message: "Component definitions cannot contain component instances yet." });
    const propertyIds = new Set<string>();
    component.properties.forEach((property, propertyIndex) => {
      if (propertyIds.has(property.id)) context.addIssue({ code: "custom", path: ["components", componentIndex, "properties", propertyIndex, "id"], message: "Duplicate component property ID." });
      propertyIds.add(property.id);
      if (!nodeById.has(property.targetNodeId)) context.addIssue({ code: "custom", path: ["components", componentIndex, "properties", propertyIndex, "targetNodeId"], message: "Property target must exist in the component root." });
      if (!componentPropertyValueValid(property, property.defaultValue)) context.addIssue({ code: "custom", path: ["components", componentIndex, "properties", propertyIndex, "defaultValue"], message: "Default value must match the property type and field constraints." });
      if (!componentFieldMatches(nodeById.get(property.targetNodeId), property.field, property.type)) context.addIssue({ code: "custom", path: ["components", componentIndex, "properties", propertyIndex, "field"], message: "Property field and type must match its target layer." });
    });
    const variantIds = new Set<string>();
    component.variants.forEach((variant, variantIndex) => {
      if (variantIds.has(variant.id)) context.addIssue({ code: "custom", path: ["components", componentIndex, "variants", variantIndex, "id"], message: "Duplicate component variant ID." });
      variantIds.add(variant.id);
      for (const [propertyId, value] of Object.entries(variant.values)) {
        const property = component.properties.find(item => item.id === propertyId);
        if (!property) context.addIssue({ code: "custom", path: ["components", componentIndex, "variants", variantIndex, "values", propertyId], message: "Variant references an unknown property." });
        else if (!componentPropertyValueValid(property, value)) context.addIssue({ code: "custom", path: ["components", componentIndex, "variants", variantIndex, "values", propertyId], message: "Variant value must match the property type and field constraints." });
      }
    });
  });
});

export type DesignSystem = z.infer<typeof designSystem>;
export type DesignToken = z.infer<typeof designToken>;
export const DesignSystemSchema = designSystem;

export function createDefaultDesignSystem(): DesignSystem {
  return {
    themes: [{ id: "theme-default", name: "Default" }],
    modes: [{ id: "mode-default", themeId: "theme-default", name: "Default" }],
    tokens: [],
    components: [],
  };
}

const layout = z.discriminatedUnion("display", [
  z.object({ display: z.literal("block") }),
  z.object({ display: z.literal("flex"), direction: z.enum(["row", "column"]).default("row"), gap: z.number().nonnegative().default(0), align: z.enum(["start", "center", "end", "stretch"]).default("stretch"), justify: z.enum(["start", "center", "end", "space-between"]).default("start") }),
  z.object({ display: z.literal("grid"), columns: z.array(z.string()).min(1), gap: z.number().nonnegative().default(0) }),
]);
const base = { id, name: z.string().default(""), visible: z.boolean().default(true), locked: z.boolean().default(false), x: z.number().default(0), y: z.number().default(0) };
const node: z.ZodType<any> = z.lazy(() => z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("frame"), width: z.number().positive(), height: z.number().positive(), children: z.array(node).default([]) }),
  z.object({ ...base, type: z.literal("container"), layout, width: z.number().positive().default(320), height: z.number().positive().default(220), children: z.array(node).default([]) }),
  z.object({ ...base, type: z.literal("text"), text: z.string(), color: cssColor.default("#111827"), colorTokenId: id.optional(), fontSize: z.number().positive().default(16) }),
  z.object({ ...base, type: z.literal("image"), src: z.string().min(1), alt: z.string().default(""), fit: z.enum(["cover", "contain"]).default("cover"), width: z.number().positive().default(320), height: z.number().positive().default(200) }),
  z.object({ ...base, type: z.literal("shape"), shape: z.enum(["rectangle", "ellipse", "line"]), fill: cssColor.default("#e5e7eb"), fillTokenId: id.optional(), width: z.number().nonnegative(), height: z.number().nonnegative() }),
  z.object({ ...base, type: z.literal("component-instance"), componentId: id, overrides: z.record(z.string(), z.unknown()).default({}), variants: z.record(z.string(), z.string()).default({}) }),
]));

export const DesignNodeSchema = node;
export type DesignNode = z.infer<typeof DesignNodeSchema>;

const prototypeValue = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
const prototypeVariable = z.object({ id, name: z.string().trim().min(1).max(80), type: z.enum(["string", "number", "boolean"]), initialValue: prototypeValue });
const prototypeAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), targetPageId: id }),
  z.object({ type: z.literal("openOverlay"), targetPageId: id }),
  z.object({ type: z.literal("closeOverlay") }),
  z.object({ type: z.literal("setVariable"), variableId: id, value: prototypeValue }),
  z.object({ type: z.literal("setComponentVariant"), nodeId: id, variantId: id }),
]);
const prototype = z.object({
  variables: z.array(prototypeVariable).max(100).default([]),
  bindings: z.array(z.object({ nodeId: id, variableId: id })).max(500).default([]),
  connections: z.array(z.object({ id, sourcePageId: id, sourceNodeId: id, trigger: z.enum(["click", "doubleClick", "hover"]), action: prototypeAction })).max(1000).default([]),
});
export type Prototype = z.infer<typeof prototype>;
export type PrototypeAction = z.infer<typeof prototypeAction>;
export type ComponentDefinition = DesignSystem["components"][number];
export type ComponentProperty = ComponentDefinition["properties"][number];
export type ComponentPropertyValue = string | number | boolean;

function flattenDesignNodes(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap(item => [item, ...( "children" in item ? flattenDesignNodes(item.children) : [])]);
}

function componentValueMatches(type: ComponentProperty["type"], value: unknown): boolean {
  if (type === "text") return typeof value === "string";
  if (type === "color") return typeof value === "string" && cssColor.safeParse(value).success;
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === "boolean";
}

function componentPropertyValueValid(property: ComponentProperty, value: unknown): boolean {
  if (!componentValueMatches(property.type, value)) return false;
  if (property.field === "fontSize") return typeof value === "number" && value > 0;
  if (property.field === "width" || property.field === "height") return typeof value === "number" && value >= 0;
  return true;
}

function componentFieldMatches(target: DesignNode | undefined, field: ComponentProperty["field"], type: ComponentProperty["type"]): boolean {
  if (!target) return false;
  if (field === "visible") return type === "boolean";
  if (field === "text") return target.type === "text" && type === "text";
  if (field === "color") return target.type === "text" && type === "color";
  if (field === "fill") return target.type === "shape" && type === "color";
  if (field === "fontSize") return target.type === "text" && type === "number";
  if (field === "width" || field === "height") return "width" in target && "height" in target && target.type !== "component-instance" && type === "number";
  return false;
}

function setComponentProperty(nodes: DesignNode[], property: ComponentProperty, value: ComponentPropertyValue): DesignNode[] {
  return nodes.map(item => {
    let next = item;
    if (item.id === property.targetNodeId) {
      const patch: Record<string, unknown> = { [property.field]: value };
      if (property.field === "color" && item.type === "text") patch.colorTokenId = undefined;
      if (property.field === "fill" && item.type === "shape") patch.fillTokenId = undefined;
      next = { ...item, ...patch } as DesignNode;
    }
    if ("children" in next) next = { ...next, children: setComponentProperty(next.children, property, value) } as DesignNode;
    return next;
  });
}

export function resolveComponentInstance(system: DesignSystem, instance: Extract<DesignNode, { type: "component-instance" }>): DesignNode | undefined {
  const component = system.components.find(item => item.id === instance.componentId);
  if (!component) return undefined;
  const root = DesignNodeSchema.safeParse(component.root);
  if (!root.success) return undefined;
  const variantId = instance.variants.variant;
  const variant = component.variants.find(item => item.id === variantId);
  let nodes = [root.data];
  for (const property of component.properties) {
    const value = instance.overrides[property.id] ?? variant?.values[property.id] ?? property.defaultValue;
    if (componentValueMatches(property.type, value)) nodes = setComponentProperty(nodes, property, value);
  }
  return nodes[0];
}

export const UDS_DESIGN_SYSTEM_FORMAT = "unified-design-studio/design-system" as const;
const designSystemImport = z.object({ format: z.literal(UDS_DESIGN_SYSTEM_FORMAT), version: z.literal(1), designSystem: DesignSystemSchema });

export function serializeDesignSystem(system: DesignSystem): string {
  return JSON.stringify({ format: UDS_DESIGN_SYSTEM_FORMAT, version: 1, designSystem: DesignSystemSchema.parse(system) }, null, 2);
}

export function parseDesignSystemImport(input: string | unknown): DesignSystem {
  let value: unknown = input;
  if (typeof input === "string") {
    try { value = JSON.parse(input); }
    catch { throw new Error("The selected file is not valid JSON."); }
  }
  const parsed = designSystemImport.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid UDS design-system file: ${parsed.error.issues[0]?.message ?? "check the file format and version."}`);
  return parsed.data.designSystem;
}

export const DesignDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  documentId: id,
  revision: z.number().int().nonnegative(),
  metadata: z.object({ name: z.string(), createdAt: z.string(), updatedAt: z.string() }),
  designSystem: designSystem.default(createDefaultDesignSystem),
  pages: z.array(z.object({ id, name: z.string(), children: z.array(DesignNodeSchema) })).min(1),
  prototype: prototype.default(() => ({ variables: [], bindings: [], connections: [] })),
}).superRefine((document, context) => {
  const tokenById = new Map(document.designSystem.tokens.map(token => [token.id, token]));
  const componentById = new Map(document.designSystem.components.map(component => [component.id, component]));
  const pageById = new Map(document.pages.map(page => [page.id, page]));
  const variableById = new Map(document.prototype.variables.map(variable => [variable.id, variable]));
  const nodesByPage = new Map(document.pages.map(page => [page.id, new Map(flattenDesignNodes(page.children).map(item => [item.id, item]))]));
  const variableIds = new Set<string>();
  const variableNames = new Set<string>();
  document.prototype.variables.forEach((variable, index) => {
    if (variableIds.has(variable.id)) context.addIssue({ code: "custom", path: ["prototype", "variables", index, "id"], message: "Prototype variable IDs must be unique." });
    variableIds.add(variable.id);
    const normalizedName = variable.name.toLocaleLowerCase();
    if (variableNames.has(normalizedName)) context.addIssue({ code: "custom", path: ["prototype", "variables", index, "name"], message: "Prototype variable names must be unique." });
    variableNames.add(normalizedName);
    if ((variable.type === "string" && typeof variable.initialValue !== "string") || (variable.type === "number" && typeof variable.initialValue !== "number") || (variable.type === "boolean" && typeof variable.initialValue !== "boolean")) context.addIssue({ code: "custom", path: ["prototype", "variables", index, "initialValue"], message: "Variable value must match its declared type." });
  });
  const bindingKeys = new Set<string>();
  const boundNodeIds = new Set<string>();
  document.prototype.bindings.forEach((binding, index) => {
    const target = document.pages.flatMap(page => flattenDesignNodes(page.children)).find(item => item.id === binding.nodeId);
    if (target?.type !== "text") context.addIssue({ code: "custom", path: ["prototype", "bindings", index, "nodeId"], message: "Variable bindings must target a text layer." });
    if (!variableById.has(binding.variableId)) context.addIssue({ code: "custom", path: ["prototype", "bindings", index, "variableId"], message: "Variable binding must reference an existing variable." });
    const key = `${binding.nodeId}:${binding.variableId}`;
    if (bindingKeys.has(key)) context.addIssue({ code: "custom", path: ["prototype", "bindings", index], message: "Variable bindings must be unique." });
    if (boundNodeIds.has(binding.nodeId)) context.addIssue({ code: "custom", path: ["prototype", "bindings", index, "nodeId"], message: "A text layer can bind to only one prototype variable." });
    bindingKeys.add(key);
    boundNodeIds.add(binding.nodeId);
  });
  const connectionKeys = new Set<string>();
  const connectionIds = new Set<string>();
  document.prototype.connections.forEach((connection, index) => {
    const path = ["prototype", "connections", index] as (string | number)[];
    const source = nodesByPage.get(connection.sourcePageId)?.get(connection.sourceNodeId);
    if (!pageById.has(connection.sourcePageId) || !source) context.addIssue({ code: "custom", path: [...path, "sourceNodeId"], message: "Interaction source must be on its source page." });
    const key = `${connection.sourcePageId}:${connection.sourceNodeId}:${connection.trigger}`;
    if (connectionKeys.has(key)) context.addIssue({ code: "custom", path, message: "Only one interaction per source layer and trigger is allowed." });
    connectionKeys.add(key);
    if (connectionIds.has(connection.id)) context.addIssue({ code: "custom", path: [...path, "id"], message: "Interaction IDs must be unique." });
    connectionIds.add(connection.id);
    const action = connection.action;
    if ((action.type === "navigate" || action.type === "openOverlay") && !pageById.has(action.targetPageId)) context.addIssue({ code: "custom", path: [...path, "action", "targetPageId"], message: "Interaction target page must exist." });
    if (action.type === "setVariable") {
      const variable = variableById.get(action.variableId);
      if (!variable) context.addIssue({ code: "custom", path: [...path, "action", "variableId"], message: "Action must reference an existing variable." });
      else if ((variable.type === "string" && typeof action.value !== "string") || (variable.type === "number" && typeof action.value !== "number") || (variable.type === "boolean" && typeof action.value !== "boolean")) context.addIssue({ code: "custom", path: [...path, "action", "value"], message: "Action value must match the variable type." });
    }
    if (action.type === "setComponentVariant") {
      let target: DesignNode | undefined;
      for (const page of document.pages) target ??= nodesByPage.get(page.id)?.get(action.nodeId);
      const component = target?.type === "component-instance" ? componentById.get(target.componentId) : undefined;
      if (!component || !component.variants.some(variant => variant.id === action.variantId)) context.addIssue({ code: "custom", path: [...path, "action"], message: "Variant action must target an instance with that defined component variant." });
    }
  });
  const visit = (nodes: DesignNode[], path: (string | number)[]) => nodes.forEach((item, index) => {
    if (item.type === "text" && item.colorTokenId) {
      const token = tokenById.get(item.colorTokenId);
      if (!token || token.type !== "color") context.addIssue({ code: "custom", path: [...path, index, "colorTokenId"], message: "Text color must reference an existing color token." });
    }
    if (item.type === "shape" && item.fillTokenId) {
      const token = tokenById.get(item.fillTokenId);
      if (!token || token.type !== "color") context.addIssue({ code: "custom", path: [...path, index, "fillTokenId"], message: "Shape fill must reference an existing color token." });
    }
    if (item.type === "component-instance") {
      const component = componentById.get(item.componentId);
      if (!component) context.addIssue({ code: "custom", path: [...path, index, "componentId"], message: "Component instance must reference an existing definition." });
      else {
        const variantId = item.variants.variant;
        if (variantId && !component.variants.some(variant => variant.id === variantId)) context.addIssue({ code: "custom", path: [...path, index, "variants", "variant"], message: "Component instance references an unknown variant." });
        for (const [propertyId, value] of Object.entries(item.overrides)) {
          const property = component.properties.find(candidate => candidate.id === propertyId);
          if (!property) context.addIssue({ code: "custom", path: [...path, index, "overrides", propertyId], message: "Component instance override references an unknown property." });
          else if (!componentPropertyValueValid(property, value)) context.addIssue({ code: "custom", path: [...path, index, "overrides", propertyId], message: "Component instance override must match the property type and field constraints." });
        }
      }
    }
    if ("children" in item) visit(item.children, [...path, index, "children"]);
  });
  document.designSystem.components.forEach((component, index) => {
    const root = DesignNodeSchema.safeParse(component.root);
    if (root.success) visit([root.data], ["designSystem", "components", index, "root"]);
  });
  document.pages.forEach((page, index) => visit(page.children, ["pages", index, "children"]));
});

export type DesignDocument = z.infer<typeof DesignDocumentSchema>;

export type PrototypeUXCheck = { label: string; result: "good" | "review" | "needs-work"; detail: string };

/** Deterministic prototype flow and accessibility preflight; it does not modify the document. */
export function evaluatePrototypeUX(document: DesignDocument): PrototypeUXCheck[] {
  const connections = document.prototype.connections;
  const outgoing = new Map<string, string[]>();
  const incoming = new Set<string>();
  for (const connection of connections) {
    if (connection.action.type === "navigate" || connection.action.type === "openOverlay") {
      const targets = outgoing.get(connection.sourcePageId) ?? [];
      targets.push(connection.action.targetPageId);
      outgoing.set(connection.sourcePageId, targets);
      incoming.add(connection.action.targetPageId);
    }
  }
  const reachable = new Set<string>();
  const queue = [document.pages[0]?.id].filter((value): value is string => Boolean(value));
  while (queue.length) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const target of outgoing.get(current) ?? []) if (!reachable.has(target)) queue.push(target);
  }
  const unreachable = document.pages.filter(page => !reachable.has(page.id));
  const noIncoming = document.pages.slice(1).filter(page => !incoming.has(page.id));
  const nodes = document.pages.flatMap(page => flattenDesignNodes(page.children));
  const unlabeledImages = nodes.filter((item): item is Extract<DesignNode, { type: "image" }> => item.type === "image" && !item.alt.trim()).length;
  const hiddenSources = connections.filter(connection => {
    const source = nodes.find(item => item.id === connection.sourceNodeId);
    return !source?.visible || source?.locked;
  }).length;
  const nonKeyboardTriggers = connections.filter(connection => connection.trigger !== "click" && !connections.some(other => other.sourcePageId === connection.sourcePageId && other.sourceNodeId === connection.sourceNodeId && other.trigger === "click")).length;
  const boundVariables = new Set(document.prototype.bindings.map(binding => binding.variableId));
  const unusedVariables = document.prototype.variables.filter(variable => !boundVariables.has(variable.id));
  const checks: PrototypeUXCheck[] = [
    { label: "Screen reachability", result: unreachable.length === 0 ? "good" : "needs-work", detail: unreachable.length ? `Not reachable from the first page: ${unreachable.map(page => page.name).join(", ")}.` : `All ${document.pages.length} page(s) are reachable through navigation or overlays.` },
    { label: "Screen entry points", result: noIncoming.length === 0 ? "good" : "review", detail: noIncoming.length ? `No incoming navigation: ${noIncoming.map(page => page.name).join(", ")}.` : "Every non-start page has an incoming navigation or overlay interaction." },
    { label: "Interactive triggers", result: connections.length ? "good" : document.pages.length > 1 ? "needs-work" : "review", detail: connections.length ? `${connections.length} interaction(s) are configured.` : "No interactions are configured yet." },
    { label: "Keyboard access", result: nonKeyboardTriggers === 0 ? "good" : "review", detail: nonKeyboardTriggers ? `${nonKeyboardTriggers} hover/double-click interaction(s) need a click trigger for keyboard access.` : "Interactions have keyboard-operable triggers." },
    { label: "Visible interaction sources", result: hiddenSources === 0 ? "good" : "needs-work", detail: hiddenSources ? `${hiddenSources} interaction source(s) are hidden or locked.` : "All interaction sources are visible and unlocked." },
    { label: "Image descriptions", result: unlabeledImages === 0 ? "good" : "needs-work", detail: unlabeledImages ? `${unlabeledImages} image layer(s) need alternative text.` : "All image layers have alternative text." },
    { label: "Prototype variables", result: unusedVariables.length === 0 ? "good" : "review", detail: unusedVariables.length ? `Not bound to text: ${unusedVariables.map(variable => variable.name).join(", ")}.` : "All defined variables are bound to text." },
  ];
  return checks;
}

export function validateDocument(input: unknown): DesignDocument {
  return DesignDocumentSchema.parse(input);
}

export function migrateDocument(input: unknown): DesignDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Document must be an object");
  const value = input as Record<string, unknown>;
  if (value.schemaVersion === 2) return validateDocument(value);
  if (value.schemaVersion === 1) {
    return validateDocument({ ...value, schemaVersion: 2, designSystem: createDefaultDesignSystem() });
  }
  throw new Error(`No migration path from schema version ${String(value.schemaVersion)}`);
}

export function resolveDesignToken(system: DesignSystem, tokenId: string, modeId?: string): DesignTokenValue | undefined {
  const tokens = new Map(system.tokens.map(token => [token.id, token]));
  const visited = new Set<string>();
  let token = tokens.get(tokenId);
  while (token) {
    if (visited.has(token.id)) return undefined;
    visited.add(token.id);
    const modeValue = modeId ? token.modeValues[modeId] : undefined;
    if (modeValue) return modeValue;
    if (token.aliasOf) { token = tokens.get(token.aliasOf); continue; }
    return token.value;
  }
  return undefined;
}

export function designTokenCssValue(value: DesignTokenValue): string {
  if ("unit" in value) return `${value.value}${value.unit}`;
  return String(value.value);
}
