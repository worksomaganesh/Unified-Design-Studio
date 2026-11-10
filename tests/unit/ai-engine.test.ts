import test from "node:test";
import assert from "node:assert/strict";
import {
  FlowPlanSchema,
  GeneratedDirectionsSchema,
  evaluateDocumentQuality,
  documentSummary,
  type FlowPlan,
} from "../../packages/ai-engine/src/index.ts";
import {
  createDefaultDesignSystem,
  type DesignDocument,
} from "../../packages/design-core/src/index.ts";

test("FlowPlanSchema validates a consistent flow and screen plan", () => {
  const plan: FlowPlan = {
    productName: "Studio Flow",
    summary: "A unified workflow plan for testing",
    audience: "Product designers",
    flow: [
      {
        id: "step-1",
        name: "Welcome",
        userGoal: "Open project",
        action: "Click create",
        nextStepIds: ["step-2"],
      },
      {
        id: "step-2",
        name: "Editor",
        userGoal: "Edit design",
        action: "Place layers",
        nextStepIds: [],
      },
    ],
    screens: [
      {
        id: "scr-1",
        name: "Dashboard",
        goal: "Overview of work",
        primaryAction: "Create New",
      },
      {
        id: "scr-2",
        name: "Canvas View",
        goal: "Active editing",
        primaryAction: "Save Revision",
      },
    ],
    assumptions: ["Desktop only"],
  };

  const parsed = FlowPlanSchema.safeParse(plan);
  assert.ok(parsed.success, "Flow plan should pass validation");
});

test("FlowPlanSchema rejects dangling step references and duplicate screen names", () => {
  const badPlan = {
    productName: "Bad Flow",
    summary: "Plan with broken links",
    audience: "Engineers",
    flow: [
      {
        id: "step-1",
        name: "Step 1",
        userGoal: "Start",
        action: "Go",
        nextStepIds: ["non-existent-step"],
      },
      {
        id: "step-2",
        name: "Step 2",
        userGoal: "End",
        action: "Stop",
        nextStepIds: [],
      },
    ],
    screens: [
      {
        id: "s-1",
        name: "Home",
        goal: "Start",
        primaryAction: "Next",
      },
      {
        id: "s-2",
        name: "Home", // duplicate
        goal: "Duplicate",
        primaryAction: "Next",
      },
    ],
    assumptions: [],
  };

  const parsed = FlowPlanSchema.safeParse(badPlan);
  assert.strictEqual(parsed.success, false);
});

test("GeneratedDirectionsSchema requires distinct layouts across directions", () => {
  const directions = [
    {
      id: "dir-1",
      name: "Direction Alpha",
      rationale: "Clean bento layout for dashboard components",
      visualApproach: "Subtle borders and rounded corners",
      layout: "bento" as const,
      palette: {
        primary: "#2563eb",
        accent: "#38bdf8",
        surface: "#f8fafc",
        text: "#0f172a",
        muted: "#64748b",
      },
      screens: [
        {
          name: "Overview",
          goal: "High-level metrics",
          headline: "Product Metrics",
          supportingText: "Key indicators for current sprint",
          primaryAction: "View Details",
          navigation: ["Dashboard", "Reports"],
          sections: [
            { heading: "Speed", body: "Fast response times", kind: "metric" as const },
            { heading: "Reliability", body: "High uptime", kind: "feature" as const },
          ],
        },
        {
          name: "Settings",
          goal: "Preferences",
          headline: "Studio Settings",
          supportingText: "Configure preferences",
          primaryAction: "Save Changes",
          navigation: ["General", "Account"],
          sections: [
            { heading: "Theme", body: "Select mode", kind: "content" as const },
            { heading: "Integrations", body: "Connect tools", kind: "feature" as const },
          ],
        },
      ],
    },
    {
      id: "dir-2",
      name: "Direction Beta",
      rationale: "Editorial layout with high-contrast typography",
      visualApproach: "Spacious layout with ruled section divides",
      layout: "editorial" as const,
      palette: {
        primary: "#18181b",
        accent: "#d97706",
        surface: "#ffffff",
        text: "#18181b",
        muted: "#71717a",
      },
      screens: [
        {
          name: "Overview",
          goal: "High-level metrics",
          headline: "Product Metrics",
          supportingText: "Key indicators for current sprint",
          primaryAction: "View Details",
          navigation: ["Dashboard", "Reports"],
          sections: [
            { heading: "Speed", body: "Fast response times", kind: "metric" as const },
            { heading: "Reliability", body: "High uptime", kind: "feature" as const },
          ],
        },
        {
          name: "Settings",
          goal: "Preferences",
          headline: "Studio Settings",
          supportingText: "Configure preferences",
          primaryAction: "Save Changes",
          navigation: ["General", "Account"],
          sections: [
            { heading: "Theme", body: "Select mode", kind: "content" as const },
            { heading: "Integrations", body: "Connect tools", kind: "feature" as const },
          ],
        },
      ],
    },
  ];

  const parsed = GeneratedDirectionsSchema.safeParse(directions);
  assert.ok(parsed.success, "Different layouts (bento and editorial) should succeed");
});

test("evaluateDesignQuality scores content structure and contrast", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-qa",
    revision: 1,
    metadata: { name: "QA Doc", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "p1",
        name: "Screen 1",
        children: [
          {
            id: "t1",
            type: "text",
            name: "H1",
            visible: true,
            locked: false,
            x: 0,
            y: 0,
            text: "Main Title",
            fontSize: 28,
            color: "#000000",
          },
          {
            id: "t2",
            type: "text",
            name: "P1",
            visible: true,
            locked: false,
            x: 0,
            y: 40,
            text: "Body paragraph describing product features",
            fontSize: 16,
            color: "#1e293b",
          },
        ],
      },
    ],
    prototype: { variables: [], bindings: [], connections: [] },
  };

  const report = evaluateDocumentQuality(doc);
  assert.ok(report.score > 0);
  assert.strictEqual(report.pages.length, 1);
  assert.ok(report.pages[0].report.checks.length >= 4);
});

test("documentSummary compacts document without leaking large payloads", () => {
  const doc: DesignDocument = {
    schemaVersion: 2,
    documentId: "doc-summary",
    revision: 5,
    metadata: { name: "Summary Test", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    designSystem: createDefaultDesignSystem(),
    pages: [
      {
        id: "p1",
        name: "Page One",
        children: [
          {
            id: "t1",
            type: "text",
            name: "Title",
            visible: true,
            locked: false,
            x: 0,
            y: 0,
            text: "Short text",
            fontSize: 16,
            color: "#000",
          },
        ],
      },
    ],
    prototype: { variables: [], bindings: [], connections: [] },
  };

  const summary = JSON.parse(documentSummary(doc));
  assert.strictEqual(summary.project, "Summary Test");
  assert.strictEqual(summary.revision, 5);
  assert.strictEqual(summary.totalPages, 1);
  assert.ok(Array.isArray(summary.pages));
});
