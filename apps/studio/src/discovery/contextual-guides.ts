export type ContextualGuideDefinition = {
  id: string;
  featureId: string;
  targetId: string;
  actionId: string;
  title: string;
  message: string;
};

export const contextualGuides: ContextualGuideDefinition[] = [
  {
    id: "guide-ai-brief",
    featureId: "ai-plan",
    targetId: "uds-ai-brief",
    actionId: "editor.ai",
    title: "Start with the outcome",
    message: "Describe the users, the problem, and what they should be able to achieve. A provider connection is required before the brief can be sent."
  },
  {
    id: "guide-design-tokens",
    featureId: "design-tokens",
    targetId: "uds-design-token-name",
    actionId: "editor.design-system",
    title: "Name tokens for their role",
    message: "Use a name such as color.brand.primary, then choose a type and value. Tokens can be linked to text and shape colors."
  },
  {
    id: "guide-prototype-interactions",
    featureId: "prototype-interactions",
    targetId: "uds-prototype-interaction",
    actionId: "editor.prototype",
    title: "Choose the source layer first",
    message: "Select a layer on the canvas, then set its trigger and action here. The preview runs in an isolated frame and does not change the document."
  },
  {
    id: "guide-review-comments",
    featureId: "review-comments",
    targetId: "uds-review-comment",
    actionId: "editor.review",
    title: "Anchor feedback to a saved state",
    message: "Save the document before commenting. Select a layer first to attach the thread to it; otherwise the comment is attached to the page."
  }
];
