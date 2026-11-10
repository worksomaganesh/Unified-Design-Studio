import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultDesignSystem,
  type DesignDocument,
} from "../../packages/design-core/src/index.ts";
import {
  buildCodeExportFiles,
  inspectExportSupport,
  renderDocument,
} from "../../packages/renderer/src/index.ts";

test("renderDocument produces valid deterministic HTML from design document", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-render",
    revision: 1,
    metadata: { name: "Render Test", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "page-1",
        name: "Home",
        children: [
          {
            id: "frame-1",
            type: "frame",
            name: "Main Artboard",
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
                name: "Heading",
                visible: true,
                locked: false,
                x: 32,
                y: 32,
                text: "Welcome",
                fontSize: 32,
                color: "#1e293b",
              },
            ],
          },
        ],
      },
    ],
    prototype: { variables: [], connections: [] },
  };

  const html = renderDocument(doc);
  assert.ok(html.includes('data-page-id="page-1"'));
  assert.ok(html.includes("Welcome"));
  assert.ok(html.includes("32px"));
});

test("buildCodeExportFiles generates complete React and HTML bundle files", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-export",
    revision: 2,
    metadata: { name: "Export Test", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        children: [
          {
            id: "shape-1",
            type: "shape",
            name: "Rect",
            visible: true,
            locked: false,
            x: 10,
            y: 10,
            width: 100,
            height: 50,
            shape: "rectangle",
            fill: "#4f46e5",
          },
        ],
      },
    ],
    prototype: { variables: [], connections: [] },
  };

  const files = buildCodeExportFiles(doc, { includeGitHandoff: true });

  assert.ok(files["index.html"]);
  assert.ok(files["styles.css"]);
  assert.ok(files["react/package.json"]);
  assert.ok(files["react/src/App.jsx"]);
  assert.ok(files["design-system/tokens.json"]);
  assert.ok(files["export-report.json"]);
  assert.ok(files[".gitignore"]);
  assert.ok(files["GIT_HANDOFF.md"]);

  const report = JSON.parse(files["export-report.json"]);
  assert.strictEqual(report.localGitHandoffIncluded, true);
  assert.ok(Array.isArray(report.findings));
});

test("inspectExportSupport reports prototype and token limitations", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-findings",
    revision: 1,
    metadata: { name: "Findings Test", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    designSystem: {
      ...createDefaultDesignSystem(),
      tokens: [
        {
          id: "tok-dim",
          name: "spacing.md",
          type: "dimension",
          value: { type: "dimension", value: 16, unit: "px" },
          modeValues: {},
        },
      ],
    },
    pages: [{ id: "p1", name: "P1", children: [] }],
    prototype: {
      variables: [{ id: "v1", name: "count", type: "number", initialValue: 0 }],
      connections: [],
    },
  };

  const findings = inspectExportSupport(doc);
  assert.ok(findings.some(f => f.code === "prototype-state"));
  assert.ok(findings.some(f => f.code === "tokens-json"));
});
