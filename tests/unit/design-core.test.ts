import test from "node:test";
import assert from "node:assert/strict";
import {
  DesignDocumentSchema,
  migrateDocument,
  resolveDesignToken,
  resolveComponentInstance,
  createDefaultDesignSystem,
  type DesignDocument,
  type ComponentDefinition,
  type ComponentInstanceNode,
  type DesignToken,
} from "../../packages/design-core/src/index.ts";
import {
  exportDtcgTokens,
  importInterchangeTokens,
} from "../../packages/design-core/src/token-interchange.ts";

test("DesignDocumentSchema validates a minimal valid document", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-1",
    revision: 0,
    metadata: {
      name: "Test Doc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        children: [
          {
            id: "frame-1",
            type: "frame",
            name: "Artboard",
            visible: true,
            locked: false,
            x: 0,
            y: 0,
            width: 1280,
            height: 800,
            children: [
              {
                id: "text-1",
                type: "text",
                name: "Header",
                visible: true,
                locked: false,
                x: 40,
                y: 40,
                text: "Hello World",
                fontSize: 24,
                color: "#111827",
              },
            ],
          },
        ],
      },
    ],
    prototype: {
      variables: [],
      connections: [],
    },
  };

  const parsed = DesignDocumentSchema.safeParse(doc);
  assert.ok(parsed.success, "Valid document should parse successfully");
});

test("DesignDocumentSchema rejects invalid node hierarchies and bad types", () => {
  const invalidDoc = {
    schemaVersion: 2,
    documentId: "doc-bad",
    revision: 0,
    metadata: { name: "Bad", createdAt: "", updatedAt: "" },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        children: [
          {
            id: "node-unknown",
            type: "invalid-type",
            x: 0,
            y: 0,
          },
        ],
      },
    ],
    prototype: { variables: [], connections: [] },
  };

  const parsed = DesignDocumentSchema.safeParse(invalidDoc);
  assert.strictEqual(parsed.success, false, "Invalid node type must be rejected");
});

test("migrateDocument migrates schemaVersion 1 snapshots to schemaVersion 2", () => {
  const v1Doc = {
    schemaVersion: 1,
    documentId: "doc-v1",
    revision: 3,
    metadata: { name: "V1 Document", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        children: [
          {
            id: "container-1",
            type: "container",
            name: "Box",
            visible: true,
            locked: false,
            x: 0,
            y: 0,
            layout: { display: "block" },
            children: [],
          },
        ],
      },
    ],
  };

  const migrated = migrateDocument(v1Doc);
  assert.strictEqual(migrated.schemaVersion, 2);
  assert.ok(migrated.designSystem, "Migrated doc should have designSystem");
  assert.ok(migrated.designSystem.themes.length > 0, "Migrated doc should have at least one theme");
  assert.ok(migrated.designSystem.modes.length > 0, "Migrated doc should have at least one mode");
  assert.ok(migrated.prototype, "Migrated doc should have prototype structure");
  // Container without width/height in v1 gets default 320x220
  const container = migrated.pages[0].children[0];
  if (container.type === "container") {
    assert.strictEqual(container.width, 320);
    assert.strictEqual(container.height, 220);
  } else {
    assert.fail("First child should be container");
  }
});

test("resolveDesignToken resolves direct values, aliases, and mode overrides", () => {
  const baseSystem = createDefaultDesignSystem();
  const themeId = baseSystem.themes[0].id;
  const lightModeId = baseSystem.modes[0].id;
  const darkModeId = "mode-dark";

  const systemWithDark = {
    ...baseSystem,
    modes: [
      ...baseSystem.modes,
      { id: darkModeId, name: "Dark", themeId },
    ],
    tokens: [
      {
        id: "color-brand",
        name: "color.brand",
        type: "color" as const,
        value: { type: "color" as const, value: "#3b82f6" },
        modeValues: {
          [darkModeId]: { type: "color" as const, value: "#60a5fa" },
        },
      },
      {
        id: "color-alias-primary",
        name: "color.primary",
        type: "color" as const,
        value: { type: "color" as const, value: "#000000" },
        aliasOf: "color-brand",
      },
    ],
  };

  // Direct in light mode
  const resolvedBrandLight = resolveDesignToken(systemWithDark, "color-brand", lightModeId);
  assert.ok(resolvedBrandLight);
  assert.strictEqual(resolvedBrandLight.value, "#3b82f6");

  // Mode override in dark mode
  const resolvedBrandDark = resolveDesignToken(systemWithDark, "color-brand", darkModeId);
  assert.ok(resolvedBrandDark);
  assert.strictEqual(resolvedBrandDark.value, "#60a5fa");

  // Alias resolves to target's value for the active mode
  const resolvedAliasLight = resolveDesignToken(systemWithDark, "color-alias-primary", lightModeId);
  assert.ok(resolvedAliasLight);
  assert.strictEqual(resolvedAliasLight.value, "#3b82f6");

  const resolvedAliasDark = resolveDesignToken(systemWithDark, "color-alias-primary", darkModeId);
  assert.ok(resolvedAliasDark);
  assert.strictEqual(resolvedAliasDark.value, "#60a5fa");
});

test("resolveComponentInstance resolves definitions, properties, and variant overrides", () => {
  const system = createDefaultDesignSystem();
  const compId = "comp-btn";
  const propTextId = "prop-text";
  const propColorId = "prop-color";
  const variantPrimaryId = "var-primary";

  const component: ComponentDefinition = {
    id: compId,
    name: "Button",
    root: {
      id: "btn-root",
      type: "container",
      name: "Root",
      visible: true,
      locked: false,
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      layout: { display: "block" },
      children: [
        {
          id: "btn-label",
          type: "text",
          name: "Label",
          visible: true,
          locked: false,
          x: 10,
          y: 10,
          text: "Click me",
          fontSize: 16,
          color: "#ffffff",
        },
      ],
    },
    properties: [
      {
        id: propTextId,
        name: "Button text",
        type: "text",
        targetNodeId: "btn-label",
        field: "text",
        defaultValue: "Click me",
      },
      {
        id: propColorId,
        name: "Text color",
        type: "color",
        targetNodeId: "btn-label",
        field: "color",
        defaultValue: "#ffffff",
      },
    ],
    variants: [
      {
        id: variantPrimaryId,
        name: "Primary",
        values: {
          [propTextId]: "Submit Now",
          [propColorId]: "#fef08a",
        },
      },
    ],
  };

  const systemWithComp = {
    ...system,
    components: [component],
  };

  // Instance with variant
  const instanceWithVariant: ComponentInstanceNode = {
    id: "inst-1",
    type: "component-instance",
    name: "Instance 1",
    visible: true,
    locked: false,
    x: 100,
    y: 100,
    componentId: compId,
    variants: { variant: variantPrimaryId },
    overrides: {},
  };

  const resolvedVariantRoot = resolveComponentInstance(systemWithComp, instanceWithVariant);
  assert.ok(resolvedVariantRoot && "children" in resolvedVariantRoot);
  const labelNode = resolvedVariantRoot.children[0];
  if (labelNode.type === "text") {
    assert.strictEqual(labelNode.text, "Submit Now", "Variant value should apply");
    assert.strictEqual(labelNode.color, "#fef08a", "Variant color should apply");
  } else {
    assert.fail("Child should be text");
  }

  // Instance with explicit property override overriding the variant
  const instanceWithOverride: ComponentInstanceNode = {
    ...instanceWithVariant,
    overrides: {
      [propTextId]: "Custom Text",
    },
  };

  const resolvedOverrideRoot = resolveComponentInstance(systemWithComp, instanceWithOverride);
  assert.ok(resolvedOverrideRoot && "children" in resolvedOverrideRoot);
  const overriddenLabel = resolvedOverrideRoot.children[0];
  if (overriddenLabel.type === "text") {
    assert.strictEqual(overriddenLabel.text, "Custom Text", "Direct override should take precedence");
    assert.strictEqual(overriddenLabel.color, "#fef08a", "Non-overridden variant property remains");
  } else {
    assert.fail("Child should be text");
  }
});

test("DTCG token export and import roundtrips supported design tokens", () => {
  const baseSystem = createDefaultDesignSystem();
  const themeId = baseSystem.themes[0].id;
  const modeId = baseSystem.modes[0].id;

  const testSystem = {
    ...baseSystem,
    tokens: [
      {
        id: "tok-color-primary",
        name: "color.primary",
        type: "color" as const,
        value: { type: "color" as const, value: "#2563eb" },
      },
      {
        id: "tok-spacing-sm",
        name: "spacing.small",
        type: "dimension" as const,
        value: { type: "dimension" as const, value: 8, unit: "px" as const },
      },
      {
        id: "tok-radius-md",
        name: "radius.medium",
        type: "radius" as const,
        value: { type: "radius" as const, value: 6, unit: "px" as const },
      },
      {
        id: "tok-font-body",
        name: "font.body",
        type: "font-family" as const,
        value: { type: "font-family" as const, value: "Inter, sans-serif" },
      },
    ],
  };

  // Export to DTCG
  const exported = exportDtcgTokens(testSystem);
  assert.ok(exported.json, "Exported JSON should exist");
  assert.strictEqual(exported.warnings.length, 0, "Standard tokens should export without warnings");

  const parsedJson = JSON.parse(exported.json);
  assert.ok(parsedJson.$schema, "DTCG schema header should be present");

  // Import into base system
  const importResult = importInterchangeTokens(parsedJson, baseSystem);
  assert.ok(importResult.designSystem);

  const importedTokens = importResult.designSystem.tokens;
  const importedColor = importedTokens.find(t => t.name === "color.primary");
  assert.ok(importedColor, "Imported tokens should contain color.primary");
  assert.strictEqual(importedColor.type, "color");
  if (importedColor.value.type === "color") {
    assert.strictEqual(importedColor.value.value.toLowerCase(), "#2563eb");
  }
});
