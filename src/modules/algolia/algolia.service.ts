import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { algoliasearch } from "algoliasearch";
import type { Algoliasearch } from "algoliasearch";

export const ALGOLIA_VIDEO_INDEX = "videos";

@Injectable()
export class AlgoliaService implements OnModuleInit {
  private readonly logger = new Logger(AlgoliaService.name);
  private writeClient!: Algoliasearch;
  private searchClient!: Algoliasearch;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const appId = this.config.getOrThrow<string>("ALGOLIA_APP_ID");
    const writeKey = this.config.getOrThrow<string>("ALGOLIA_WRITE_KEY");
    const searchKey = this.config.getOrThrow<string>("ALGOLIA_SEARCH_KEY");

    this.writeClient = algoliasearch(appId, writeKey);
    this.searchClient = algoliasearch(appId, searchKey);

    this.logger.log("Algolia clients initialized");
  }

  async indexData(
    indexName: string,
    data: Record<string, unknown> & { id: string },
  ): Promise<void> {
    try {
      const { id, ...rest } = data;
      const body: Record<string, unknown> = { objectID: id };
      for (const [k, v] of Object.entries(rest)) {
        body[k] = v instanceof Date ? v.toISOString() : v;
      }
      await this.writeClient.saveObject({ indexName, body });
    } catch (err) {
      this.logger.warn(`Algolia indexData [${indexName}] failed: ${String(err)}`);
    }
  }

  async search<T = Record<string, unknown>>(
    indexName: string,
    query: string,
    options: { hitsPerPage?: number; page?: number } = {},
  ): Promise<{ hits: T[]; total: number }> {
    const res = await this.searchClient.search<T>({
      requests: [
        {
          indexName,
          query,
          hitsPerPage: options.hitsPerPage ?? 20,
          page: options.page ?? 0,
        },
      ],
    });

    const result = res.results[0] as {
      hits: T[];
      nbHits: number;
    };

    return { hits: result.hits, total: result.nbHits };
  }

  async deleteObject(indexName: string, objectID: string): Promise<void> {
    try {
      await this.writeClient.deleteObject({ indexName, objectID });
    } catch (err) {
      this.logger.warn(
        `Algolia deleteObject [${indexName}/${objectID}] failed: ${String(err)}`,
      );
    }
  }
}
