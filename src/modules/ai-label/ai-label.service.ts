import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppLogger } from "@/base/logger/app-logger.service";
import { AI_CATEGORIES, VideoCategory } from "./ai-label.constants";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `You are a video content classifier. Given a video title and description, return ONLY valid JSON with:
- "category": one of [${AI_CATEGORIES.join(", ")}]
- "quality": integer 0–3 (0=spam/garbage, 1=low quality, 2=normal, 3=high quality)

Respond ONLY with the JSON object, no markdown, no explanation.`;

export interface ClassifyResult {
  category: VideoCategory;
  quality: number;
}

interface GroqChoice {
  message: { content: string };
}
interface GroqResponse {
  choices: GroqChoice[];
}

@Injectable()
export class AiLabelService {
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.apiKey = this.config.get<string>("GROQ_API_KEY") ?? "";
  }

  async classify(
    videoId: string,
    title: string,
    description?: string,
  ): Promise<ClassifyResult | null> {
    if (!this.apiKey) {
      this.logger.warn("[AiLabel] GROQ_API_KEY not set, skipping", { videoId });
      return null;
    }

    const userMsg = `Title: ${title}\nDescription: ${description?.slice(0, 500) ?? ""}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMsg },
            ],
            temperature: 0.1,
            max_tokens: 60,
          }),
        });

        if (res.status === 429) {
          const delay = 30_000 * attempt;
          this.logger.warn("[AiLabel] Rate limited, retrying", { videoId, attempt, delayMs: delay });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!res.ok) {
          this.logger.warn("[AiLabel] API error", { videoId, status: res.status });
          return null;
        }

        const body = (await res.json()) as GroqResponse;
        const text = body.choices[0]?.message.content.trim() ?? "";
        const parsed = JSON.parse(text) as Partial<ClassifyResult>;

        const category = AI_CATEGORIES.includes(parsed.category as VideoCategory)
          ? (parsed.category as VideoCategory)
          : "Other";

        const quality =
          typeof parsed.quality === "number" && parsed.quality >= 0 && parsed.quality <= 3
            ? Math.round(parsed.quality)
            : 2;

        return { category, quality };
      } catch (err) {
        this.logger.warn("[AiLabel] classify failed", { videoId, error: String(err) });
        return null;
      }
    }

    return null;
  }
}
