export const LABEL_QUEUE = "label";

export const AI_CATEGORIES = [
  "Music",
  "Gaming",
  "News",
  "Sports",
  "Education",
  "Entertainment",
  "Tech",
  "Food",
  "Travel",
  "Lifestyle",
  "Other",
] as const;

export type VideoCategory = (typeof AI_CATEGORIES)[number];
