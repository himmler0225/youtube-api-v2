import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "@elastic/elasticsearch";

const INDEX = "videos";

export interface VideoDoc {
  id: string;
  title: string;
  channelId: string | null;
  channelName: string | null;
  description: string | null;
  viewCount: number | null;
  isAvailable: boolean;
  crawledAt: Date;
}

const RETRY_INTERVAL_MS = 60_000;

@Injectable()
export class ElasticService implements OnModuleInit {
  private readonly logger = new Logger(ElasticService.name);
  private client!: Client;
  private _available = false;

  async onModuleInit() {
    this.client = new Client({
      node: process.env.ELASTIC_URL ?? "http://localhost:9200",
    });
    await this._tryConnect();
  }

  get available() {
    return this._available;
  }

  getClient(): Client {
    return this.client;
  }

  async indexVideo(video: VideoDoc): Promise<void> {
    if (!this._available) return;
    try {
      await this.client.index({
        index: INDEX,
        id: video.id,
        document: { ...video, crawledAt: video.crawledAt.toISOString() },
      });
    } catch (err) {
      this._trip(`indexVideo [${video.id}]`, err);
    }
  }

  async bulkIndex(videos: VideoDoc[]): Promise<void> {
    if (!this._available || !videos.length) return;
    try {
      const operations = videos.flatMap((v) => [
        { index: { _index: INDEX, _id: v.id } },
        { ...v, crawledAt: v.crawledAt.toISOString() },
      ]);
      await this.client.bulk({ operations });
    } catch (err) {
      this._trip(`bulkIndex (${videos.length} docs)`, err);
    }
  }

  private _trip(ctx: string, err: unknown) {
    this._available = false;
    this.logger.warn(
      `ES ${ctx} failed — circuit open, retrying in ${RETRY_INTERVAL_MS / 1000}s: ${String(err)}`,
    );
    setTimeout(() => void this._tryConnect(), RETRY_INTERVAL_MS);
  }

  private async _tryConnect(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: INDEX });
      if (!exists) {
        await this.client.indices.create({
          index: INDEX,
          mappings: {
            properties: {
              id: { type: "keyword" },
              title: { type: "text", analyzer: "standard" },
              channelId: { type: "keyword" },
              channelName: { type: "text" },
              description: { type: "text" },
              viewCount: { type: "long" },
              isAvailable: { type: "boolean" },
              crawledAt: { type: "date" },
            },
          },
        });
        this.logger.log(`ES index '${INDEX}' created`);
      }
      if (!this._available) this.logger.log("ES connection established");
      this._available = true;
    } catch (err) {
      this._available = false;
      this.logger.warn(
        `ES unavailable — search falls back to DB. Retry in ${RETRY_INTERVAL_MS / 1000}s: ${String(err)}`,
      );
      setTimeout(() => void this._tryConnect(), RETRY_INTERVAL_MS);
    }
  }
}
