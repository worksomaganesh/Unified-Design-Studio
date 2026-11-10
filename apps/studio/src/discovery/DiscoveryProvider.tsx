import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import rawRegistry from "./feature-registry.json";
import { announcements } from "./announcement-registry";
import { contextualGuides, type ContextualGuideDefinition } from "./contextual-guides";
import { DISCOVERY_STORAGE_KEY, emptyDiscoveryProgress, readDiscoveryProgress, reduceDiscoveryProgress, writeDiscoveryProgress, type DiscoveryProgress, type ProgressAction } from "./discovery-state";
import { filterProductFeatures } from "./feature-search";
import { tours } from "./tour-registry";
import "./discovery.css";

export type FeatureStatus = "fully_implemented" | "partially_implemented" | "experimental" | "unavailable";
export type ProductFeature = {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  purpose: string;
  location: string;
  howTo: string;
  status: FeatureStatus;
  dependencies: string[];
  tourId: string | null;
  targetId: string | null;
  beforeActionId?: string;
  guideId?: string;
  evidence: string[];
};
export type FeatureCategory = { id: string; title: string; description: string };
type ExternalDependency = { id: string; title: string; reason: string };
type Registry = {
  version: number;
  categories: FeatureCategory[];
  features: ProductFeature[];
  externalDependencies: ExternalDependency[];
  unavailableUi: { title: string; location: string; reason: string }[];
  importantDependencies: string[];
};
const registry = rawRegistry as Registry;
export const featureCategories = registry.categories;
export const productFeatures = registry.features;

type DiscoveryAction = () => void | boolean | Promise<void | boolean>;
type DialogName = "none" | "explorer" | "whats-new" | "tour" | "complete";
type TargetState = "loading" | "ready" | "missing";

type DiscoveryContextValue = {
  progress: DiscoveryProgress;
  ready: boolean;
  activeTourId: string | null;
  activeGuideId: string | null;
  dialog: DialogName;
  registerAction: (id: string, action: DiscoveryAction) => () => void;
  openExplorer: () => void;
  openWhatsNew: () => void;
  startTour: (id: string) => void;
  closeTour: () => void;
  nextTourStep: () => void;
  previousTourStep: () => void;
  retryTourStep: () => void;
  showContextualGuide: (id: string) => void;
  replayOnboarding: () => void;
  resetProgress: () => void;
  setTipsEnabled: (enabled: boolean) => void;
  dismissGuide: (id: string) => void;
  replayGuide: (id: string) => void;
  acknowledgeAnnouncement: (id: string) => void;
  closeDialog: () => void;
};

const DiscoveryContext = createContext<DiscoveryContextValue | null>(null);

export function useDiscovery(): DiscoveryContextValue {
  const value = useContext(DiscoveryContext);
  if (!value) throw new Error("useDiscovery must be used inside DiscoveryProvider");
  return value;
}

export function useRegisterDiscoveryActions(actions: Record<string, DiscoveryAction>): void {
  const { registerAction } = useDiscovery();
  const current = useRef(actions);
  current.current = actions;
  const actionIds = Object.keys(actions).sort().join("|");
  useEffect(() => {
    const cleanup = actionIds.split("|").filter(Boolean).map(id => registerAction(id, () => current.current[id]?.()));
    return () => cleanup.forEach(dispose => dispose());
  }, [actionIds, registerAction]);
}

function safeStorage(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

function elementByDiscoveryId(id: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-discovery-id]")).find(element => element.dataset.discoveryId === id) ?? null;
}

function visible(element: HTMLElement): boolean {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  if (element.matches(":disabled") || element.closest("[inert]")) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  }
  return true;
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function waitForTarget(id: string, cancelled: () => boolean): Promise<HTMLElement | null> {
  return new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      if (cancelled()) return resolve(null);
      const element = elementByDiscoveryId(id);
      if (element && visible(element)) return resolve(element);
      if (performance.now() - started > 3200) return resolve(null);
      window.setTimeout(poll, 80);
    };
    poll();
  });
}

function waitForAction(id: string, actionMap: Map<string, DiscoveryAction>, cancelled: () => boolean): Promise<DiscoveryAction | null> {
  return new Promise(resolve => {
    const started = performance.now();
    const poll = () => {
      if (cancelled()) return resolve(null);
      const action = actionMap.get(id);
      if (action) return resolve(action);
      if (performance.now() - started > 1800) return resolve(null);
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

function focusFirst(node: HTMLElement | null): void {
  const focusable = node?.querySelector<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
  focusable?.focus();
}

function keepFocusInDialog(event: ReactKeyboardEvent<HTMLElement>, dialog: HTMLElement | null): void {
  if (event.key !== "Tab" || !dialog) return;
  const elements = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")).filter(item => item.offsetParent !== null);
  if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<DiscoveryProgress>(emptyDiscoveryProgress);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<DialogName>("none");
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetState, setTargetState] = useState<TargetState>("loading");
  const [targetError, setTargetError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [guideReplayError, setGuideReplayError] = useState("");
  const actions = useRef(new Map<string, DiscoveryAction>());
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setProgress(readDiscoveryProgress(safeStorage(), DISCOVERY_STORAGE_KEY));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeDiscoveryProgress(safeStorage(), progress, DISCOVERY_STORAGE_KEY);
  }, [progress, ready]);

  const updateProgress = useCallback((action: ProgressAction) => setProgress(current => reduceDiscoveryProgress(current, action)), []);
  const registerAction = useCallback((id: string, action: DiscoveryAction) => {
    actions.current.set(id, action);
    return () => { if (actions.current.get(id) === action) actions.current.delete(id); };
  }, []);
  const closeDialog = useCallback(() => {
    if (activeTourId) {
      if (!progress.completedTours.includes(activeTourId)) updateProgress({ type: "tour-skipped", id: activeTourId });
      setActiveTourId(null);
    }
    setGuideReplayError("");
    setDialog("none");
  }, [activeTourId, progress.completedTours, updateProgress]);
  const openExplorer = useCallback(() => { setGuideReplayError(""); setDialog("explorer"); }, []);
  const openWhatsNew = useCallback(() => setDialog("whats-new"), []);

  const startTour = useCallback((id: string) => {
    if (!tours.some(tour => tour.id === id)) return;
    if (activeTourId && activeTourId !== id && !progress.completedTours.includes(activeTourId)) {
      updateProgress({ type: "tour-skipped", id: activeTourId });
    }
    setActiveGuideId(null);
    setActiveTourId(id);
    setStepIndex(0);
    setTargetState("loading");
    setTargetError("");
    setGuideReplayError("");
    setDialog("tour");
    updateProgress({ type: "welcome-completed" });
  }, [activeTourId, progress.completedTours, updateProgress]);

  const closeTour = useCallback(() => {
    if (activeTourId) updateProgress({ type: "tour-skipped", id: activeTourId });
    setDialog("none");
    setActiveTourId(null);
    setTargetError("");
  }, [activeTourId, updateProgress]);

  const currentTour = tours.find(tour => tour.id === activeTourId);
  const currentFeatureId = currentTour?.featureIds[stepIndex];
  const currentFeature = productFeatures.find(feature => feature.id === currentFeatureId);

  useEffect(() => {
    if (dialog !== "tour" || !currentFeature?.targetId) return;
    let cancelled = false;
    setTargetState("loading");
    setTargetError("");
    const navigateAndLocate = async () => {
      const surfaceActionId = currentTour ? `surface.${currentTour.surface}` : undefined;
      const actionIds = [...new Set([surfaceActionId, currentFeature.beforeActionId].filter((id): id is string => Boolean(id)))];
      for (const actionId of actionIds) {
        const action = await waitForAction(actionId, actions.current, () => cancelled);
        if (!action) {
          setTargetState("missing");
          setTargetError("The required view has not opened. Return to the correct project view and retry this same step.");
          return;
        }
        try {
          const result = await action();
          if (result === false) {
            setTargetState("missing");
            setTargetError(currentTour?.surface === "editor"
              ? "Open or create a project before starting this editor tour. The tour will not change your project content."
              : "Save and return to the project workspace before starting this tour. The tour will not close the editor or discard its unsaved changes.");
            return;
          }
        } catch {
          if (!cancelled) {
            setTargetState("missing");
            setTargetError("The app could not open this part of the workspace. Retry after it is available.");
          }
          return;
        }
      }
      const target = await waitForTarget(currentFeature.targetId!, () => cancelled);
      if (cancelled) return;
      if (!target) {
        setTargetState("missing");
        const blocked = elementByDiscoveryId(currentFeature.targetId!);
        setTargetError(blocked?.matches(":disabled")
          ? "This control is disabled until its setup requirements are met. Complete the requirements shown in the Explorer, then retry this same step."
          : "The highlighted control is not available in the current view. This tour step has not been skipped.");
        return;
      }
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
      await nextPaint();
      if (cancelled) return;
      if (!target.isConnected || !visible(target)) {
        setTargetState("missing");
        setTargetError("The highlighted control changed while the page was moving. Retry this step to locate it again.");
        return;
      }
      setTargetState("ready");
    };
    void navigateAndLocate();
    return () => { cancelled = true; };
  }, [currentFeature, dialog, retryCount]);

  const nextTourStep = useCallback(() => {
    if (!currentTour || targetState !== "ready") return;
    if (stepIndex >= currentTour.featureIds.length - 1) {
      updateProgress({ type: "tour-completed", id: currentTour.id });
      setDialog("complete");
      return;
    }
    setStepIndex(value => value + 1);
  }, [currentTour, stepIndex, targetState, updateProgress]);
  const previousTourStep = useCallback(() => {
    if (stepIndex > 0) { setStepIndex(value => value - 1); setTargetError(""); }
  }, [stepIndex]);
  const retryTourStep = useCallback(() => { setTargetError(""); setTargetState("loading"); setRetryCount(value => value + 1); }, []);

  const dismissGuide = useCallback((id: string) => {
    updateProgress({ type: "guide-dismissed", id });
    setActiveGuideId(current => current === id ? null : current);
  }, [updateProgress]);
  const showContextualGuide = useCallback((id: string) => {
    setActiveGuideId(current => current ?? id);
  }, []);
  const replayGuide = useCallback(async (id: string) => {
    const guide = contextualGuides.find(item => item.id === id);
    if (!guide) return;
    setDialog("none");
    setActiveGuideId(null);
    setGuideReplayError("");
    const actionIds = [...new Set(["surface.editor", guide.actionId])];
    for (const actionId of actionIds) {
      const action = await waitForAction(actionId, actions.current, () => false);
      if (!action) {
        setGuideReplayError("Open or create a project first. The Explorer is still here, and no project content was changed.");
        setDialog("explorer");
        return;
      }
      try {
        if (await action() === false) {
          setGuideReplayError("Open or create a project first. The Explorer is still here, and no project content was changed.");
          setDialog("explorer");
          return;
        }
      } catch {
        setGuideReplayError("That guide is unavailable in the current view. Choose a project and try again.");
        setDialog("explorer");
        return;
      }
    }
    const target = await waitForTarget(guide.targetId, () => false);
    if (!target) {
      setGuideReplayError("The guide target did not appear in the editor. Its tip was not opened; try again after opening the related tool.");
      setDialog("explorer");
      return;
    }
    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    await nextPaint();
    setActiveGuideId(id);
  }, []);
  const replayOnboarding = useCallback(() => {
    setDialog("none"); setActiveTourId(null); setActiveGuideId(null);
    updateProgress({ type: "replay-requested" });
  }, [updateProgress]);
  const resetProgress = useCallback(() => {
    setDialog("none"); setActiveTourId(null); setActiveGuideId(null);
    updateProgress({ type: "reset" });
  }, [updateProgress]);
  const setTipsEnabled = useCallback((enabled: boolean) => updateProgress({ type: "tips-enabled", enabled }), [updateProgress]);
  const acknowledgeAnnouncement = useCallback((id: string) => updateProgress({ type: "announcement-viewed", id }), [updateProgress]);

  const contextValue = useMemo<DiscoveryContextValue>(() => ({
    progress, ready, activeTourId, activeGuideId, dialog, registerAction, openExplorer, openWhatsNew,
    startTour, closeTour, nextTourStep, previousTourStep, retryTourStep, showContextualGuide, replayOnboarding,
    resetProgress, setTipsEnabled, dismissGuide, replayGuide, acknowledgeAnnouncement, closeDialog
  }), [progress, ready, activeTourId, activeGuideId, dialog, registerAction, openExplorer, openWhatsNew, startTour, closeTour, nextTourStep, previousTourStep, retryTourStep, showContextualGuide, replayOnboarding, resetProgress, setTipsEnabled, dismissGuide, replayGuide, acknowledgeAnnouncement, closeDialog]);

  const showWelcome = ready && progress.welcome === "pending" && dialog === "none";
  const tourForDisplay = dialog === "tour" ? currentTour : null;
  const unseenAnnouncements = announcements.filter(item => !progress.viewedAnnouncements.includes(item.id));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialog === "tour") {
        const target = event.target as HTMLElement | null;
        const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
        if (event.key === "Escape") { event.preventDefault(); closeTour(); }
        else if (!typing && event.key === "ArrowRight") { event.preventDefault(); nextTourStep(); }
        else if (!typing && event.key === "ArrowLeft") { event.preventDefault(); previousTourStep(); }
      } else if ((dialog !== "none" || showWelcome) && event.key === "Escape") {
        event.preventDefault();
        if (showWelcome) updateProgress({ type: "welcome-skipped" });
        closeDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, showWelcome, closeTour, nextTourStep, previousTourStep, updateProgress, closeDialog]);

  useEffect(() => {
    if (!showWelcome && dialog === "none") return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => focusFirst(modalRef.current), 0);
    return () => { window.clearTimeout(timer); if (previouslyFocused?.isConnected) previouslyFocused.focus(); };
  }, [showWelcome, dialog]);

  return <DiscoveryContext.Provider value={contextValue}>
    {children}
    {typeof document !== "undefined" && createPortal(<>
      {showWelcome && <WelcomeDialog refNode={modalRef} onStart={() => startTour("getting-started")} onExplore={() => { updateProgress({ type: "welcome-completed" }); closeDialog(); }} onSkip={() => { updateProgress({ type: "welcome-skipped" }); closeDialog(); }}/ >}
      {dialog === "explorer" && <FeatureExplorer refNode={modalRef} progress={progress} replayError={guideReplayError} onClose={closeDialog} onStartTour={startTour} onReplayWelcome={replayOnboarding} onReset={resetProgress} onToggleTips={setTipsEnabled} onReplayGuide={replayGuide}/>}
      {dialog === "whats-new" && <WhatsNewDialog refNode={modalRef} items={announcements} unseen={unseenAnnouncements.map(item => item.id)} onClose={closeDialog} onAcknowledge={acknowledgeAnnouncement} onStartTour={startTour}/>}
      {tourForDisplay && currentFeature && <TourOverlay refNode={modalRef} tour={tourForDisplay} feature={currentFeature} step={stepIndex + 1} total={tourForDisplay.featureIds.length} state={targetState} error={targetError} onNext={nextTourStep} onPrevious={previousTourStep} onRetry={retryTourStep} onSkip={closeTour}/>}
      {dialog === "complete" && <TourCompletion refNode={modalRef} tour={currentTour} onExplore={() => setDialog("explorer")} onClose={() => { setDialog("none"); setActiveTourId(null); }}/ >}
      {contextualGuides.map(guide => <ContextualGuide key={guide.id} id={guide.id}/>)}
    </>, document.body)}
  </DiscoveryContext.Provider>;
}

function WelcomeDialog({ refNode, onStart, onExplore, onSkip }: { refNode: RefObject<HTMLElement | null>; onStart: () => void; onExplore: () => void; onSkip: () => void }) {
  return <div className="discovery-scrim"><section ref={refNode as RefObject<HTMLElement>} className="discovery-dialog discovery-welcome" role="dialog" aria-modal="true" aria-labelledby="discovery-welcome-title" tabIndex={-1} onKeyDown={event => keepFocusInDialog(event, refNode.current)}>
    <div className="discovery-mark" aria-hidden="true">✳</div><p className="discovery-eyebrow">WELCOME TO UNIFIED DESIGN STUDIO</p><h1 id="discovery-welcome-title">Your idea, from brief to handoff.</h1><p className="discovery-lead">A local-first workspace for product thinking, desktop design, interactive prototypes, and developer handoff.</p>
    <div className="discovery-capabilities"><span>Design canvas</span><span>Design systems</span><span>AI workflows</span><span>Prototypes</span><span>Code handoff</span></div>
    <div className="discovery-actions"><button className="discovery-primary" onClick={onStart}>Take a quick tour <span aria-hidden="true">→</span></button><button className="discovery-secondary" onClick={onExplore}>Explore independently</button></div>
    <button className="discovery-link" onClick={onSkip}>Skip onboarding</button>
  </section></div>;
}

function FeatureExplorer({ refNode, progress, replayError, onClose, onStartTour, onReplayWelcome, onReset, onToggleTips, onReplayGuide }: {
  refNode: RefObject<HTMLElement | null>;
  progress: DiscoveryProgress;
  replayError: string;
  onClose: () => void;
  onStartTour: (id: string) => void;
  onReplayWelcome: () => void;
  onReset: () => void;
  onToggleTips: (enabled: boolean) => void;
  onReplayGuide: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const counts = useMemo(() => Object.fromEntries(featureCategories.map(category => [category.id, productFeatures.filter(feature => feature.categoryId === category.id).length])), []);
  const visibleFeatures = filterProductFeatures(productFeatures, featureCategories, query, selectedCategory);
  return <div className="discovery-scrim"><section ref={refNode as RefObject<HTMLElement>} className="discovery-dialog discovery-explorer" role="dialog" aria-modal="true" aria-labelledby="discovery-explorer-title" tabIndex={-1} onKeyDown={event => keepFocusInDialog(event, refNode.current)}>
    <header className="discovery-modal-header"><div><p className="discovery-eyebrow">PRODUCT GUIDE</p><h2 id="discovery-explorer-title">Explore Unified Design Studio</h2><p>Search {productFeatures.length} verified capabilities and see where each one lives.</p></div><button className="discovery-close" aria-label="Close feature explorer" onClick={onClose}>×</button></header>
    <div className="discovery-search-row"><label className="discovery-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search features, workflows, or locations" aria-label="Search features"/><kbd>Ctrl K</kbd></label><span className="discovery-result-count" aria-live="polite">{visibleFeatures.length} of {productFeatures.length} features</span></div>
    {replayError && <p className="discovery-inline-error" role="alert">{replayError}</p>}
    <div className="discovery-explorer-layout"><nav className="discovery-category-list" aria-label="Feature categories"><button className={selectedCategory === "all" ? "selected" : ""} onClick={() => setSelectedCategory("all")}>All features <span>{productFeatures.length}</span></button>{featureCategories.map(category => <button key={category.id} className={selectedCategory === category.id ? "selected" : ""} onClick={() => setSelectedCategory(category.id)}>{category.title}<span>{counts[category.id]}</span></button>)}</nav>
      <div className="discovery-feature-list" aria-label="Available features">{visibleFeatures.map(feature => <FeatureCard key={feature.id} feature={feature} onStartTour={onStartTour} onReplayGuide={onReplayGuide}/>)}{visibleFeatures.length === 0 && <div className="discovery-empty"><b>No matching features</b><span>Try a different term or choose another category.</span></div>}</div>
    </div>
    <footer className="discovery-management"><label className="discovery-toggle"><input type="checkbox" checked={progress.tipsEnabled} onChange={event => onToggleTips(event.target.checked)}/><span>Show contextual tips</span></label><div><button className="discovery-secondary" onClick={onReplayWelcome}>Replay onboarding</button><button className="discovery-link" onClick={onReset}>Reset progress</button></div></footer>
  </section></div>;
}

function FeatureCard({ feature, onStartTour, onReplayGuide }: { feature: ProductFeature; onStartTour: (id: string) => void; onReplayGuide: (id: string) => void }) {
  const tour = feature.tourId ? tours.find(item => item.id === feature.tourId) : undefined;
  const guide = feature.guideId ? contextualGuides.find(item => item.id === feature.guideId) : undefined;
  const category = featureCategories.find(item => item.id === feature.categoryId);
  const statusText = feature.status.replaceAll("_", " ");
  const isNew = announcements.some(item => item.featureIds.includes(feature.id));
  return <article className="discovery-feature-card">
    <div className="discovery-feature-heading"><div><span className="discovery-category-name">{category?.title}</span><h3>{feature.title}{isNew && <span className="discovery-new-pill">New</span>}</h3></div><span className={`discovery-status status-${feature.status}`}>{statusText}</span></div>
    <p className="discovery-feature-summary">{feature.summary}</p>
    <div className="discovery-feature-meta"><span><b>Why:</b> {feature.purpose}</span><span><b>Where:</b> {feature.location}</span><span><b>How:</b> {feature.howTo}</span>{feature.dependencies.length > 0 && <span><b>Requires:</b> {feature.dependencies.map(id => productFeatures.find(item => item.id === id)?.title ?? registry.externalDependencies.find(item => item.id === id)?.title ?? id).join(" · ")}</span>}</div>
    <div className="discovery-feature-actions">{tour ? <button className="discovery-card-action" onClick={() => onStartTour(tour.id)}>Start {tour.title} tour <span aria-hidden="true">→</span></button> : <span className="discovery-no-tour">No in-app tour available</span>}{guide && <button className="discovery-link" onClick={() => onReplayGuide(guide.id)}>Replay tip</button>}</div>
  </article>;
}

function WhatsNewDialog({ refNode, items, unseen, onClose, onAcknowledge, onStartTour }: { refNode: RefObject<HTMLElement | null>; items: typeof announcements; unseen: string[]; onClose: () => void; onAcknowledge: (id: string) => void; onStartTour: (id: string) => void }) {
  return <div className="discovery-scrim"><section ref={refNode as RefObject<HTMLElement>} className="discovery-dialog discovery-whats-new" role="dialog" aria-modal="true" aria-labelledby="discovery-news-title" tabIndex={-1} onKeyDown={event => keepFocusInDialog(event, refNode.current)}>
    <header className="discovery-modal-header"><div><p className="discovery-eyebrow">PRODUCT UPDATES</p><h2 id="discovery-news-title">What’s new</h2><p>Revisit product announcements and launch their walkthroughs.</p></div><button className="discovery-close" aria-label="Close What's New" onClick={onClose}>×</button></header>
    <div className="discovery-news-list">{items.map(item => {
      const isUnseen = unseen.includes(item.id);
      const tour = item.tourId ? tours.find(entry => entry.id === item.tourId) : undefined;
      return <article className={`discovery-news-card ${isUnseen ? "unseen" : ""}`} key={item.id}><div className="discovery-news-date">{new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}{isUnseen && <span className="discovery-new-pill">NEW</span>}</div><h3>{item.title}</h3><p className="discovery-news-summary">{item.summary}</p><p>{item.details}</p><div className="discovery-feature-actions">{tour && <button className="discovery-card-action" onClick={() => { onAcknowledge(item.id); onStartTour(tour.id); }}>Take the {tour.title} tour <span aria-hidden="true">→</span></button>}{isUnseen ? <button className="discovery-link" onClick={() => onAcknowledge(item.id)}>Mark as read</button> : <span className="discovery-read-state">Read</span>}</div></article>;
    })}</div>
  </section></div>;
}

function TourOverlay({ refNode, tour, feature, step, total, state, error, onNext, onPrevious, onRetry, onSkip }: { refNode: RefObject<HTMLElement | null>; tour: (typeof tours)[number]; feature: ProductFeature; step: number; total: number; state: TargetState; error: string; onNext: () => void; onPrevious: () => void; onRetry: () => void; onSkip: () => void }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const [targetLost, setTargetLost] = useState(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => { if (state !== "loading") focusFirst(refNode.current); }, [feature.id, state, refNode]);
  useEffect(() => {
    if (state !== "ready" || !feature.targetId) { setRect(null); setTargetLost(false); return; }
    let lostNotified = false;
    let target: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | undefined;
    const update = () => {
      target = elementByDiscoveryId(feature.targetId!);
      if (!target || !visible(target)) {
        setRect(null);
        setTargetLost(true);
        if (!lostNotified) { lostNotified = true; window.dispatchEvent(new CustomEvent("uds-discovery-target-lost")); }
        return;
      }
      resizeObserver?.disconnect();
      resizeObserver?.observe(target);
      setTargetLost(false);
      lostNotified = false;
      setRect(target.getBoundingClientRect());
    };
    resizeObserver = new ResizeObserver(update);
    update();
    const mutationObserver = new MutationObserver(update);
    let ancestor: HTMLElement | null = target as HTMLElement | null;
    while (ancestor) {
      mutationObserver.observe(ancestor, { childList: true, subtree: false, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] });
      ancestor = ancestor.parentElement;
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { resizeObserver?.disconnect(); mutationObserver.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [feature.targetId, state]);
  useEffect(() => {
    if (!rect) { setPosition({}); return; }
    const width = 360;
    const gap = 18;
    const fitsRight = rect.right + gap + width < window.innerWidth - 16;
    const left = fitsRight ? rect.right + gap : Math.max(16, Math.min(window.innerWidth - width - 16, rect.left));
    const estimatedHeight = 310;
    const top = rect.bottom + estimatedHeight < window.innerHeight - 16 ? rect.bottom + gap : Math.max(16, rect.top - estimatedHeight - gap);
    setPosition({ left, top });
  }, [rect]);
  const guideError = targetLost && state === "ready" ? "The highlighted control changed or disappeared. Retry to locate this same step; it will not be skipped." : error;
  return <div className={`discovery-tour-scrim ${reducedMotion ? "reduced-motion" : ""}`} aria-hidden="false">
    {rect && state === "ready" && <>
      <svg className="discovery-spotlight-dimmer" width="100%" height="100%" aria-hidden="true">
        <path d={`M0 0 H${window.innerWidth} V${window.innerHeight} H0 Z M${rect.left - 5} ${rect.top - 5} H${rect.right + 5} V${rect.bottom + 5} H${rect.left - 5} Z`} fill="rgba(12, 14, 20, 0.68)" fillRule="evenodd"/>
      </svg>
      <div className="discovery-spotlight-ring" style={{ left: rect.left - 5, top: rect.top - 5, width: rect.width + 10, height: rect.height + 10 }} aria-hidden="true"><span className="discovery-pointer" aria-hidden="true">↙</span></div>
    </>}
    <section ref={refNode as RefObject<HTMLElement>} className={`discovery-tour-card ${rect && state === "ready" && !guideError ? "anchored" : "centered"}`} style={position} role="dialog" aria-modal="true" aria-labelledby="discovery-tour-title" aria-describedby="discovery-tour-copy" tabIndex={-1} onKeyDown={event => keepFocusInDialog(event, refNode.current)}>
      <div className="discovery-tour-topline"><span>{tour.title}</span><button aria-label="Skip tour" onClick={onSkip}>Skip tour</button></div>
      {state === "loading" ? <div className="discovery-tour-loading" role="status"><span className="discovery-loader" aria-hidden="true"/>Locating the next feature…</div> : <>
        <div className="discovery-tour-count">STEP {step} OF {total}</div><h2 id="discovery-tour-title">{feature.title}</h2><p id="discovery-tour-copy">{feature.summary}</p>
        <div className="discovery-tour-detail"><b>Why it’s useful</b><span>{feature.purpose}</span><b>How to use it</b><span>{feature.howTo}</span></div>
        {guideError && <div className="discovery-tour-error" role="alert"><b>This step is unavailable</b><span>{guideError}</span></div>}
        <div className="discovery-tour-footer"><span className="discovery-progress-dots" aria-label={`Step ${step} of ${total}`}>{Array.from({ length: total }, (_, index) => <i key={index} className={index < step ? "done" : ""}/>)}</span><div>{step > 1 && <button className="discovery-secondary" onClick={onPrevious}>Previous</button>}{guideError ? <button className="discovery-primary" onClick={onRetry}>Retry step</button> : <button className="discovery-primary" onClick={onNext} disabled={state !== "ready"}>Next <span aria-hidden="true">→</span></button>}</div></div>
      </>}
    </section>
  </div>;
}

function TourCompletion({ refNode, tour, onExplore, onClose }: { refNode: RefObject<HTMLElement | null>; tour?: (typeof tours)[number]; onExplore: () => void; onClose: () => void }) {
  return <div className="discovery-scrim"><section ref={refNode as RefObject<HTMLElement>} className="discovery-dialog discovery-completion" role="dialog" aria-modal="true" aria-labelledby="discovery-complete-title" tabIndex={-1} onKeyDown={event => keepFocusInDialog(event, refNode.current)}><div className="discovery-complete-mark" aria-hidden="true">✓</div><p className="discovery-eyebrow">TOUR COMPLETE</p><h2 id="discovery-complete-title">You’re ready to explore.</h2><p>You finished “{tour?.title ?? "the product"}.” The feature guide is here whenever you need it.</p><div className="discovery-actions"><button className="discovery-primary" onClick={onExplore}>Explore all features <span aria-hidden="true">→</span></button><button className="discovery-secondary" onClick={onClose}>Start exploring</button></div></section></div>;
}

export function DiscoveryLauncher({ className = "" }: { className?: string }) {
  const { openExplorer, openWhatsNew, progress } = useDiscovery();
  const unread = announcements.some(item => !progress.viewedAnnouncements.includes(item.id));
  return <div className={`discovery-launcher ${className}`}>
    <button type="button" onClick={openExplorer} aria-label="Discover product features">✳ <span>Discover</span></button>
    <button type="button" onClick={openWhatsNew} aria-label={unread ? "What's new; unread announcement" : "What's new"}>What’s new{unread && <i className="discovery-news-dot" aria-hidden="true"/>}</button>
  </div>;
}

export function ContextualGuide({ id }: { id: string }) {
  const { progress, ready, activeTourId, activeGuideId, dismissGuide, startTour, showContextualGuide } = useDiscovery();
  const guide: ContextualGuideDefinition | undefined = contextualGuides.find(item => item.id === id);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  useEffect(() => {
    if (!guide || !ready || !progress.tipsEnabled || progress.dismissedGuides.includes(id) || activeTourId || activeGuideId) return;
    const target = elementByDiscoveryId(guide.targetId);
    if (target && visible(target)) {
      // A contextual guide appears only when the user first opens the related workflow.
      showContextualGuide(id);
    }
  }, [guide, id, ready, progress.tipsEnabled, progress.dismissedGuides, activeTourId, activeGuideId, showContextualGuide]);
  useEffect(() => {
    if (!guide || activeGuideId !== id) return;
    const update = () => {
      const target = elementByDiscoveryId(guide.targetId);
      setRect(target && visible(target) ? target.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new MutationObserver(update);
    let ancestor: HTMLElement | null = elementByDiscoveryId(guide.targetId);
    while (ancestor) {
      observer.observe(ancestor, { childList: true, subtree: false, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] });
      ancestor = ancestor.parentElement;
    }
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); observer.disconnect(); };
  }, [guide, activeGuideId, id]);
  useEffect(() => {
    if (!rect || activeGuideId !== id) return;
    const width = 320;
    setStyle({ left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left)), top: Math.min(window.innerHeight - 210, rect.bottom + 12) });
  }, [rect, activeGuideId, id]);
  if (!guide || activeGuideId !== id || !rect) return null;
  const feature = productFeatures.find(item => item.id === guide.featureId);
  return <aside className="discovery-context-tip" style={style} role="note" aria-labelledby={`${id}-title`}><div className="discovery-context-kicker">QUICK TIP</div><h3 id={`${id}-title`}>{guide.title}</h3><p>{guide.message}</p><div className="discovery-context-actions"><button onClick={() => { const tourId = feature?.tourId; dismissGuide(id); if (tourId) startTour(tourId); }}>Replay tour</button><button onClick={() => dismissGuide(id)}>Got it</button><button className="discovery-context-close" aria-label="Dismiss tip" onClick={() => dismissGuide(id)}>×</button></div></aside>;
}

export function ProductDiscoveryHelp({ children }: { children: ReactNode }) {
  const { openExplorer } = useDiscovery();
  return <button type="button" className="product-discovery-help" onClick={openExplorer}>{children}</button>;
}
