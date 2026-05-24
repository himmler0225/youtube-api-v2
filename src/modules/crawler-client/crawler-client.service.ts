import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppLogger } from "@/base/logger/app-logger.service";
import type {
  CrawlerVideoResult,
  CrawlerComment,
  CrawlerLiveVideo,
  CrawlerShort,
} from "./types";

export type {
  CrawlerVideoDetail,
  CrawlerVideoError,
  CrawlerVideoResult,
  CrawlerLiveVideo,
  CrawlerShort,
  CrawlerCommentReply,
  CrawlerComment,
} from "./types";

@Injectable()
export class CrawlerClientService {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.baseUrl = this.config.getOrThrow<string>("CRAWLER_URL");
    this.headers = {
      "X-API-Key": this.config.getOrThrow<string>("CRAWLER_API_KEY"),
      "Content-Type": "application/json",
    };
  }

  private async _fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        throw new Error(`Crawler responded ${res.status} for ${path}`);
      }
      return res.json() as Promise<T>;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn("Crawler request failed", { path, error: msg });
      throw new ServiceUnavailableException("Crawler service unavailable");
    }
  }

  async getVideoDetail(videoId: string): Promise<CrawlerVideoResult> {
    const data = await this._fetch<{ detail: CrawlerVideoResult }>(
      `/api/video/${videoId}`,
    );
    return data.detail;
  }

  async getComments(
    videoId: string,
    page = 1,
    limit = 30,
  ): Promise<CrawlerComment[]> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const data = await this._fetch<{ comments: CrawlerComment[] }>(
      `/api/video/${videoId}/comments?${params.toString()}`,
    );
    return data.comments;
  }

  async getShorts(limit = 30): Promise<CrawlerShort[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    const data = await this._fetch<{ videos: CrawlerShort[] }>(
      `/api/videos/shorts?${params.toString()}`,
    );
    return data.videos;
  }

  async getLiveVideos(
    query: string,
    page = 1,
    limit = 30,
  ): Promise<CrawlerLiveVideo[]> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      limit: String(limit),
    });
    const data = await this._fetch<{ videos: CrawlerLiveVideo[] }>(
      `/api/videos/live?${params.toString()}`,
    );
    return data.videos;
  }
}
