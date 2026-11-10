export type TourDefinition = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  surface: "workspace" | "project" | "editor";
  featureIds: string[];
};

export const tours: TourDefinition[] = [
  {
    id: "getting-started",
    title: "Get oriented",
    description: "Find your projects, create a workspace, and learn the main navigation.",
    categoryId: "workspace",
    surface: "workspace",
    featureIds: ["workspace-create", "workspace-recent", "workspace-rename", "workspace-settings", "workspace-commands"]
  },
  {
    id: "canvas-basics",
    title: "Build a canvas",
    description: "Create pages and layers, arrange them, then save a desktop design.",
    categoryId: "canvas",
    surface: "editor",
    featureIds: ["canvas-pages", "canvas-selection", "canvas-frame", "canvas-text", "canvas-shape", "canvas-save"]
  },
  {
    id: "asset-management",
    title: "Bring in assets",
    description: "Learn which project files are editable, which stay as references, and where to import them.",
    categoryId: "assets",
    surface: "project",
    featureIds: ["assets-raster", "assets-reference", "assets-penpot", "assets-fig-reference"]
  },
  {
    id: "design-systems",
    title: "Create a design system",
    description: "Add reusable tokens, work with modes, create components, and export supported formats.",
    categoryId: "design-system",
    surface: "editor",
    featureIds: ["design-tokens", "design-themes", "design-aliases", "design-components", "design-token-formats"]
  },
  {
    id: "ai-workflow",
    title: "Explore AI workflows",
    description: "See how a provider-backed brief becomes a reviewed design proposal.",
    categoryId: "ai",
    surface: "editor",
    featureIds: ["ai-provider", "ai-plan", "ai-generate", "ai-revise", "ai-quality"]
  },
  {
    id: "prototyping",
    title: "Make a clickable prototype",
    description: "Add state, connect a layer to an interaction, and run the isolated preview.",
    categoryId: "prototype",
    surface: "editor",
    featureIds: ["prototype-variables", "prototype-bindings", "prototype-interactions", "prototype-preview", "prototype-preflight"]
  },
  {
    id: "review-history",
    title: "Review and compare work",
    description: "Leave local feedback, compare saved revisions, and restore without erasing history.",
    categoryId: "review",
    surface: "editor",
    featureIds: ["review-comments", "review-threads", "review-compare", "review-restore"]
  },
  {
    id: "developer-handoff",
    title: "Prepare a developer handoff",
    description: "Review export notes, inspect the restricted preview, and download a code bundle.",
    categoryId: "handoff",
    surface: "editor",
    featureIds: ["handoff-diagnostics", "handoff-preview", "handoff-git-ready", "handoff-bundle"]
  }
];
