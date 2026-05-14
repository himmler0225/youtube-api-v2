export type CrawlerVideoDetail = {
  video_id: string;
  title: string;
  author: string;
  length_seconds: string;
  views: number;
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
  view_count: number;
  is_live: boolean;
};

export type CrawlerShort = {
  video_id: string;
  title: string;
  thumbnails: Array<{ url: string; width?: number; height?: number }>;
  view_count: number;
  channel_name: string;
  url: string;
  is_short: true;
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
