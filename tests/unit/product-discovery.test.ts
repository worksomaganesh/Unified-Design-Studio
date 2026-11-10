import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { announcements } from "../../apps/studio/src/discovery/announcement-registry";
import { contextualGuides } from "../../apps/studio/src/discovery/contextual-guides";
import { emptyDiscoveryProgress, normalizeDiscoveryProgress, readDiscoveryProgress, reduceDiscoveryProgress, writeDiscoveryProgress, type StorageLike } from "../../apps/studio/src/discovery/discovery-state";
import { filterProductFeatures } from "../../apps/studio/src/discovery/feature-search";
import { tours } from "../../apps/studio/src/discovery/tour-registry";

const repoRoot = resolve(import.meta.dirname, "../..");
const registry = JSON.parse(readFileSync(resolve(repoRoot, "apps/studio/src/discovery/feature-registry.json"), "utf8")) as {
  categories: { id: string; title: string }[];
  features: { id: string; categoryId: string; title: string; status: string; dependencies: string[]; targetId: string | null; tourId: string | null; evidence: string[] }[];
  externalDependencies: { id: string }[];
  unavailableUi: { title: string }[];
};

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

test("feature registry has a stable, balanced, explicitly counted audit", () => {
  assert.equal(registry.features.length, 58);
  assert.equal(registry.categories.length, 9);
  assert.equal(new Set(registry.features.map(feature => feature.id)).size, registry.features.length);
  const statusCounts = Object.fromEntries(["fully_implemented", "partially_implemented", "experimental", "unavailable"].map(status => [status, registry.features.filter(feature => feature.status === status).length]));
  assert.deepEqual(statusCounts, { fully_implemented: 48, partially_implemented: 5, experimental: 5, unavailable: 0 });
  for (const category of registry.categories) assert.ok(registry.features.some(feature => feature.categoryId === category.id), `empty feature category: ${category.id}`);
  assert.equal(registry.unavailableUi.length, 2);
});

test("feature dependencies resolve to a capability or a documented external prerequisite", () => {
  const featureIds = new Set(registry.features.map(feature => feature.id));
  const externalIds = new Set(registry.externalDependencies.map(item => item.id));
  for (const feature of registry.features) {
    for (const dependency of feature.dependencies) assert.ok(featureIds.has(dependency) || externalIds.has(dependency), `${feature.id} references unknown dependency ${dependency}`);
  }
});

test("tours are short, unique, and reference only verified feature records", () => {
  assert.equal(tours.length, 8);
  assert.ok(tours.every(tour => tour.featureIds.length >= 4 && tour.featureIds.length <= 6));
  assert.equal(new Set(tours.map(tour => tour.id)).size, tours.length);
  const featureIds = new Set(registry.features.map(feature => feature.id));
  for (const tour of tours) {
    assert.equal(new Set(tour.featureIds).size, tour.featureIds.length, `${tour.id} has duplicate steps`);
    for (const id of tour.featureIds) assert.ok(featureIds.has(id), `${tour.id} references unknown ${id}`);
  }
  for (const feature of registry.features.filter(item => item.tourId)) {
    const tour = tours.find(item => item.id === feature.tourId);
    assert.ok(tour, `${feature.id} references missing tour ${feature.tourId}`);
    assert.ok(tour!.featureIds.includes(feature.id), `${feature.id} is offered a tour that does not cover it`);
  }
});

test("all in-app tour and contextual guide targets exist in application source", () => {
  const sourcePaths = [
    "apps/studio/src/studio-app.tsx",
    "apps/studio/src/canvas-editor.tsx",
    "apps/studio/src/ai-studio-panel.tsx",
    "apps/studio/src/design-system-panel.tsx",
    "apps/studio/src/prototype-panel.tsx",
    "apps/studio/src/review-panel.tsx",
    "apps/studio/src/code-handoff-panel.tsx"
  ];
  const source = sourcePaths.map(path => readFileSync(resolve(repoRoot, path), "utf8")).join("\n");
  for (const feature of registry.features.filter(item => item.targetId)) {
    const selector = `data-discovery-id="${feature.targetId}"`;
    assert.ok(source.includes(selector), `${feature.id} has no actual selector ${feature.targetId}`);
    assert.equal(source.split(selector).length - 1, 1, `${feature.id} selector ${feature.targetId} is ambiguous`);
  }
  for (const guide of contextualGuides) {
    assert.ok(source.includes(`data-discovery-id="${guide.targetId}"`), `${guide.id} has no actual selector ${guide.targetId}`);
    assert.ok(registry.features.some(feature => feature.id === guide.featureId), `${guide.id} has no feature record`);
  }
});

test("tour surface and panel actions have a live registration owner", () => {
  const workspace = readFileSync(resolve(repoRoot, "apps/studio/src/studio-app.tsx"), "utf8");
  const editor = readFileSync(resolve(repoRoot, "apps/studio/src/canvas-editor.tsx"), "utf8");
  const owners = new Map<string, string>([
    ["surface.workspace", workspace],
    ["surface.project", workspace],
    ["surface.editor", workspace],
    ["editor.canvas", editor],
    ["editor.ai", editor],
    ["editor.design-system", editor],
    ["editor.prototype", editor],
    ["editor.review", editor],
    ["editor.history", editor],
    ["editor.handoff", editor]
  ]);
  for (const tour of tours) assert.ok(owners.has(`surface.${tour.surface}`), `${tour.id} has no surface action`);
  for (const feature of registry.features.filter(item => item.tourId && item.beforeActionId)) {
    assert.ok(owners.get(feature.beforeActionId!)?.includes(`"${feature.beforeActionId}":`), `${feature.id} has no safe navigation action`);
  }
  assert.equal((editor.match(/"surface\.editor"\s*:/g) ?? []).length, 0, "the child editor must not replace its persistent workspace transition action");
});

test("discovery dialogs provide focus semantics and reduced-motion styling", () => {
  const provider = readFileSync(resolve(repoRoot, "apps/studio/src/discovery/DiscoveryProvider.tsx"), "utf8");
  const styles = readFileSync(resolve(repoRoot, "apps/studio/src/discovery/discovery.css"), "utf8");
  assert.ok(provider.includes("aria-modal=\"true\""));
  assert.ok(provider.includes("keepFocusInDialog"));
  assert.ok(provider.includes("event.key === \"Escape\""));
  assert.ok(provider.includes("ArrowRight") && provider.includes("ArrowLeft"));
  assert.ok(styles.includes("prefers-reduced-motion: reduce"));
  assert.ok(styles.includes(":focus-visible"));
});

test("announcement IDs and links are valid and stable", () => {
  assert.ok(announcements.length > 0);
  assert.equal(new Set(announcements.map(item => item.id)).size, announcements.length);
  const featureIds = new Set(registry.features.map(feature => feature.id));
  for (const item of announcements) {
    if (item.tourId) assert.ok(tours.some(tour => tour.id === item.tourId), `${item.id} references a missing tour`);
    for (const featureId of item.featureIds) assert.ok(featureIds.has(featureId), `${item.id} references missing feature ${featureId}`);
  }
});

test("feature explorer search covers descriptions and categories and category filters stay scoped", () => {
  const byLocation = filterProductFeatures(registry.features, registry.categories, "credential store");
  assert.ok(byLocation.some(feature => feature.id === "ai-provider"));
  const byCategory = filterProductFeatures(registry.features, registry.categories, "", "handoff");
  assert.equal(byCategory.length, 4);
  assert.ok(byCategory.every(feature => feature.categoryId === "handoff"));
  const combined = filterProductFeatures(registry.features, registry.categories, "pdf", "assets");
  assert.ok(combined.some(feature => feature.id === "assets-reference"));
  assert.ok(combined.every(feature => feature.categoryId === "assets"));
  assert.deepEqual(filterProductFeatures(registry.features, registry.categories, "no matching feature name"), []);
});

test("progress normalization tolerates corrupt shapes, duplicates, and unknown versions", () => {
  assert.deepEqual(normalizeDiscoveryProgress(null), emptyDiscoveryProgress());
  const normalized = normalizeDiscoveryProgress({ version: 98, welcome: "unknown", completedTours: ["a", "a", 5, ""], tipsEnabled: false, replayRequested: true });
  assert.deepEqual(normalized, { version: 1, welcome: "pending", completedTours: ["a"], skippedTours: [], dismissedGuides: [], viewedAnnouncements: [], tipsEnabled: false, replayRequested: true });
});

test("welcome, tour, tip, announcement, tips preference, replay, and reset update independently", () => {
  let progress = emptyDiscoveryProgress();
  progress = reduceDiscoveryProgress(progress, { type: "welcome-skipped" });
  progress = reduceDiscoveryProgress(progress, { type: "tour-skipped", id: "getting-started" });
  progress = reduceDiscoveryProgress(progress, { type: "tour-completed", id: "getting-started" });
  progress = reduceDiscoveryProgress(progress, { type: "guide-dismissed", id: "guide-ai-brief" });
  progress = reduceDiscoveryProgress(progress, { type: "announcement-viewed", id: "launch" });
  progress = reduceDiscoveryProgress(progress, { type: "tips-enabled", enabled: false });
  assert.equal(progress.welcome, "skipped");
  assert.deepEqual(progress.completedTours, ["getting-started"]);
  assert.deepEqual(progress.skippedTours, ["getting-started"]);
  assert.deepEqual(progress.dismissedGuides, ["guide-ai-brief"]);
  assert.deepEqual(progress.viewedAnnouncements, ["launch"]);
  assert.equal(progress.tipsEnabled, false);
  progress = reduceDiscoveryProgress(progress, { type: "replay-requested" });
  assert.equal(progress.welcome, "pending");
  assert.equal(progress.replayRequested, true);
  assert.deepEqual(reduceDiscoveryProgress(progress, { type: "reset" }), emptyDiscoveryProgress());
});

test("progress survives persistence round trips and handles storage failures", () => {
  const storage = new MemoryStorage();
  let progress = reduceDiscoveryProgress(emptyDiscoveryProgress(), { type: "announcement-viewed", id: "launch" });
  assert.equal(writeDiscoveryProgress(storage, progress, "uds-test"), true);
  assert.deepEqual(readDiscoveryProgress(storage, "uds-test"), progress);
  assert.deepEqual(readDiscoveryProgress({ getItem: () => "{bad", setItem: () => undefined }), emptyDiscoveryProgress());
  assert.equal(writeDiscoveryProgress(undefined, progress), false);
});
