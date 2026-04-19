/**
 * HTTP client gọi youtube-crawler — dùng cho các request real-time
 * (video live, video chưa có trong DB).
 *
 * Crawler yêu cầu header X-API-Key (cùng key đã cấu hình trong crawler .env).
 */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../base/logger/app-logger.service';

// ── Types phản ánh response thực tế của crawler ──────────────────────────────

export type CrawlerVideoDetail = {
  video_id: string;
  title: string;
  author: string;
  length_seconds: string; // số giây dạng string
  views: string; // view count dạng string
  is_live_content: boolean;
};

export type CrawlerVideoError = {
  error: true;
  reason: string;
  status: string;
};

export type CrawlerVideoResult = CrawlerVideoDetail | CrawlerVideoError;

export type CrawlerLiveVideo = {
  video_id: string;
  title: string;
  thumbnail: object[];
  channel_name: string;
  url: string;
  views: string;
  is_live: boolean;
};

export type CrawlerCommentReply = {
  comment_id: string;
  author: string;
  avatar?: string;
  content: string;
  published_time: string;
  likes: number;
};

export type CrawlerComment = {
  comment_id: string;
  author: string;
  avatar?: string;
  content: string;
  published_time: string;
  likes: number;
  replies_count: number;
  replies: CrawlerCommentReply[];
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CrawlerClientService {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('CRAWLER_URL');
    this.headers = {
      'X-API-Key': this.config.getOrThrow<string>('CRAWLER_API_KEY'),
      'Content-Type': 'application/json',
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
    } catch {
      throw new ServiceUnavailableException('Crawler service unavailable');
    }
  }

  /** Lấy chi tiết một video — bao gồm cả live video */
  async getVideoDetail(videoId: string): Promise<CrawlerVideoResult> {
    const data = await this._fetch<{ detail: CrawlerVideoResult }>(
      `/api/video/${videoId}`,
    );
    return data.detail;
  }

  /** Lấy comment của video */
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

  /** Tìm video đang live theo từ khóa */
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
