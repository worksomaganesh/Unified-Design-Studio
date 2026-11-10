export type FeatureAnnouncement = {
  id: string;
  date: string;
  title: string;
  summary: string;
  details: string;
  tourId?: string;
  featureIds: string[];
};

export const announcements: FeatureAnnouncement[] = [
  {
    id: "product-discovery-launch",
    date: "2026-11-10",
    title: "A guided way to explore Unified Design Studio",
    summary: "Find verified tools in one searchable Feature Explorer and learn them with short tours.",
    details: "The workspace now includes a welcome choice, feature-specific guided tours, contextual tips, persistent tour progress, and this What's New panel. The explorer describes only capabilities verified in the current application and marks incomplete integrations clearly.",
    tourId: "getting-started",
    featureIds: []
  }
];
