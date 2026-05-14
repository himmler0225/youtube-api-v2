export type VideoRow = {
  id: string;
  title: string;
  channelId: string | null;
  channelName: string | null;
  viewsText: string | null;
  durationText: string | null;
  publishedTimeText: string | null;
  viewCount: bigint | null;
  durationSeconds: number | null;
  isLiveContent: boolean;
  descriptionSnippet: string | null;
  thumbnails: unknown;
  isAvailable: boolean;
  unavailableReason: string | null;
  detailCrawledAt: Date | null;
  crawledAt: Date;
  updatedAt: Date;
};

export type CountRow = { count: bigint };
