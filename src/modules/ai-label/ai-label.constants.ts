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

export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_MODEL = "llama-3.1-8b-instant";

export const GROQ_SYSTEM_PROMPT = `You are a video content classifier. Given a video title and description, return ONLY valid JSON with:
- "category": one of [${AI_CATEGORIES.join(", ")}]
- "quality": integer 0–3 (0=spam/garbage, 1=low quality, 2=normal, 3=high quality)

Respond ONLY with the JSON object, no markdown, no explanation.`;

export const GROQ_BATCH_SYSTEM_PROMPT = `You are a video content classifier. Given a list of videos (id, title, description), classify each one.
Return ONLY a valid JSON array, one object per video, in the same order:
[{"id":"...","category":"...","quality":N}, ...]
Categories: [${AI_CATEGORIES.join(", ")}]
Quality: 0=spam, 1=low, 2=normal, 3=high
No markdown, no explanation.`;
