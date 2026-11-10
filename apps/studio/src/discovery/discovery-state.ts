export const DISCOVERY_STORAGE_KEY = "uds.product-discovery.v1";

export type WelcomeState = "pending" | "completed" | "skipped";

export type DiscoveryProgress = {
  version: 1;
  welcome: WelcomeState;
  completedTours: string[];
  skippedTours: string[];
  dismissedGuides: string[];
  viewedAnnouncements: string[];
  tipsEnabled: boolean;
  replayRequested: boolean;
};

export type ProgressAction =
  | { type: "welcome-completed" }
  | { type: "welcome-skipped" }
  | { type: "tour-completed"; id: string }
  | { type: "tour-skipped"; id: string }
  | { type: "guide-dismissed"; id: string }
  | { type: "announcement-viewed"; id: string }
  | { type: "tips-enabled"; enabled: boolean }
  | { type: "replay-requested" }
  | { type: "reset" };

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const emptyDiscoveryProgress = (): DiscoveryProgress => ({
  version: 1,
  welcome: "pending",
  completedTours: [],
  skippedTours: [],
  dismissedGuides: [],
  viewedAnnouncements: [],
  tipsEnabled: true,
  replayRequested: false
});

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))].slice(0, 500);
}

export function normalizeDiscoveryProgress(value: unknown): DiscoveryProgress {
  const fallback = emptyDiscoveryProgress();
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const welcome = record.welcome === "completed" || record.welcome === "skipped" ? record.welcome : "pending";
  return {
    version: 1,
    welcome,
    completedTours: stringList(record.completedTours),
    skippedTours: stringList(record.skippedTours),
    dismissedGuides: stringList(record.dismissedGuides),
    viewedAnnouncements: stringList(record.viewedAnnouncements),
    tipsEnabled: typeof record.tipsEnabled === "boolean" ? record.tipsEnabled : true,
    replayRequested: record.replayRequested === true
  };
}

export function readDiscoveryProgress(storage: StorageLike | undefined, key = DISCOVERY_STORAGE_KEY): DiscoveryProgress {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return emptyDiscoveryProgress();
    return normalizeDiscoveryProgress(JSON.parse(raw));
  } catch {
    return emptyDiscoveryProgress();
  }
}

export function writeDiscoveryProgress(storage: StorageLike | undefined, progress: DiscoveryProgress, key = DISCOVERY_STORAGE_KEY): boolean {
  try {
    storage?.setItem(key, JSON.stringify(normalizeDiscoveryProgress(progress)));
    return Boolean(storage);
  } catch {
    return false;
  }
}

function addUnique(list: string[], id: string): string[] {
  return id && !list.includes(id) ? [...list, id] : list;
}

export function reduceDiscoveryProgress(progress: DiscoveryProgress, action: ProgressAction): DiscoveryProgress {
  switch (action.type) {
    case "welcome-completed": return { ...progress, welcome: "completed", replayRequested: false };
    case "welcome-skipped": return { ...progress, welcome: "skipped", replayRequested: false };
    case "tour-completed": return { ...progress, completedTours: addUnique(progress.completedTours, action.id), replayRequested: false };
    case "tour-skipped": return { ...progress, skippedTours: addUnique(progress.skippedTours, action.id) };
    case "guide-dismissed": return { ...progress, dismissedGuides: addUnique(progress.dismissedGuides, action.id) };
    case "announcement-viewed": return { ...progress, viewedAnnouncements: addUnique(progress.viewedAnnouncements, action.id) };
    case "tips-enabled": return { ...progress, tipsEnabled: action.enabled };
    case "replay-requested": return { ...progress, welcome: "pending", replayRequested: true };
    case "reset": return emptyDiscoveryProgress();
  }
}
