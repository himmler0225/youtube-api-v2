import { VideoService } from './video.service';
import { AppException } from '@/base/errors/app.exception';

describe('VideoService', () => {
  let service: VideoService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockCrawler: any;
  let mockLogger: any;
  let mockAlgolia: any;

  beforeEach(() => {
    mockPrisma = {
      video: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      comment: {
        count: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      short: {
        count: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      channel: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };

    mockCrawler = {
      getVideoDetail: jest.fn(),
      getComments: jest.fn(),
      getLiveVideos: jest.fn(),
      getShorts: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockAlgolia = {
      search: jest.fn(),
      saveObjects: jest.fn(),
      indexData: jest.fn(),
    };

    service = new VideoService(
      mockPrisma,
      mockRedis,
      mockCrawler,
      mockLogger,
      mockAlgolia,
    );
  });

  describe('findOne', () => {
    it('returns cached value from Redis without hitting DB', async () => {
      const cached = { id: 'vid1', title: 'Cached Video' };
      mockRedis.get.mockResolvedValue(cached);

      const result = await service.findOne('vid1');

      expect(result).toBe(cached);
      expect(mockPrisma.video.findUnique).not.toHaveBeenCalled();
      expect(mockCrawler.getVideoDetail).not.toHaveBeenCalled();
    });

    it('returns DB record when not in cache and video is not live', async () => {
      const dbVideo = { id: 'vid2', title: 'DB Video', isLiveContent: false };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.video.findUnique.mockResolvedValue(dbVideo);

      const result = await service.findOne('vid2');

      expect(result).toBe(dbVideo);
      expect(mockCrawler.getVideoDetail).not.toHaveBeenCalled();
    });

    it('calls crawler when not in cache and not in DB', async () => {
      const crawlerDetail = {
        title: 'Crawled Video',
        author: 'Author',
        views: '1000',
        length_seconds: '120',
        is_live_content: false,
      };
      const upsertedVideo = { id: 'vid3', title: 'Crawled Video', isLiveContent: false };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.video.findUnique.mockResolvedValue(null);
      mockCrawler.getVideoDetail.mockResolvedValue(crawlerDetail);
      mockPrisma.video.upsert.mockResolvedValue(upsertedVideo);

      const result = await service.findOne('vid3');

      expect(mockCrawler.getVideoDetail).toHaveBeenCalledWith('vid3');
      expect(mockPrisma.video.upsert).toHaveBeenCalled();
      expect(result).toEqual(upsertedVideo);
    });
  });

  describe('getComments', () => {
    it('returns empty comments for a live video', async () => {
      mockPrisma.video.findUnique.mockResolvedValue({ isLiveContent: true });

      const result = await service.getComments('live-vid');

      expect(result).toEqual({
        videoId: 'live-vid',
        total: 0,
        page: 1,
        limit: 30,
        comments: [],
      });
      expect(mockPrisma.comment.count).not.toHaveBeenCalled();
    });

    it('returns DB comments with pagination when they exist', async () => {
      const dbComments = [
        { id: 'c1', author: 'Alice', content: 'Hello', replies: [] },
        { id: 'c2', author: 'Bob', content: 'World', replies: [] },
      ];
      mockPrisma.video.findUnique.mockResolvedValue({ isLiveContent: false });
      mockPrisma.comment.count.mockResolvedValue(2);
      mockPrisma.comment.findMany.mockResolvedValue(dbComments);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getComments('vid1', 1, 30);

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { videoId: 'vid1', parentId: null } }),
      );
      expect(result.total).toBe(2);
      expect(result.comments).toHaveLength(2);
      expect(result.comments[0]).toHaveProperty('authorUsername', null);
      expect(mockCrawler.getComments).not.toHaveBeenCalled();
    });

    it('calls crawler to fetch comments when DB has none', async () => {
      const crawledComments = [
        {
          comment_id: 'c10',
          author: 'Charlie',
          content: 'Nice!',
          likes: 5,
          replies_count: 0,
          replies: [],
        },
      ];
      const savedComments = [
        { id: 'c10', author: 'Charlie', content: 'Nice!', replies: [] },
      ];

      mockPrisma.video.findUnique.mockResolvedValue({ isLiveContent: false });
      mockPrisma.comment.count.mockResolvedValue(0);
      mockRedis.get.mockResolvedValue(null); // crawlKey not set
      mockCrawler.getComments.mockResolvedValue(crawledComments);
      mockPrisma.comment.upsert.mockResolvedValue({});
      mockPrisma.comment.findMany.mockResolvedValue(savedComments);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getComments('vid2', 1, 30);

      expect(mockCrawler.getComments).toHaveBeenCalledWith('vid2', 1, 100);
      expect(mockPrisma.comment.upsert).toHaveBeenCalled();
      expect(result.comments).toHaveLength(1);
    });
  });

  describe('listVideos', () => {
    it('calls prisma.video.findMany when no query is provided', async () => {
      const videos = [{ id: 'v1', title: 'Video 1' }];
      mockPrisma.video.findMany.mockResolvedValue(videos);
      mockPrisma.video.count.mockResolvedValue(1);

      const result = await service.listVideos(undefined, 1, 20);

      expect(mockPrisma.video.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isAvailable: true },
          skip: 0,
          take: 20,
          orderBy: { crawledAt: 'desc' },
        }),
      );
      expect(result.videos).toEqual(videos);
      expect(result.total).toBe(1);
      expect(mockAlgolia.search).not.toHaveBeenCalled();
    });

    it('calls algolia.search when query string is present and returns hits', async () => {
      const hits = [{ id: 'v2', title: 'NestJS tutorial', objectID: 'v2' }];
      mockAlgolia.search.mockResolvedValue({ hits, total: 1 });

      const result = await service.listVideos('NestJS', 1, 20);

      expect(mockAlgolia.search).toHaveBeenCalledWith(
        'videos',
        'NestJS',
        expect.objectContaining({ hitsPerPage: 20, page: 0 }),
      );
      expect(result.videos).toEqual(hits);
      expect(result.total).toBe(1);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('falls back to Postgres FTS when algolia returns empty hits', async () => {
      mockAlgolia.search.mockResolvedValue({ hits: [], total: 0 });
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'v3' }]);
      mockPrisma.video.findMany.mockResolvedValue([{ id: 'v3', title: 'FTS result' }]);

      const result = await service.listVideos('nestjs', 1, 20);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.video.findMany).toHaveBeenCalled();
      expect(result.videos).toHaveLength(1);
    });

    it('falls back to Postgres FTS when algolia throws', async () => {
      mockAlgolia.search.mockRejectedValue(new Error('Algolia unreachable'));
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'v4' }]);
      mockPrisma.video.findMany.mockResolvedValue([{ id: 'v4', title: 'FTS fallback' }]);

      const result = await service.listVideos('query', 1, 20);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Algolia'),
        expect.any(Object),
      );
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.videos).toHaveLength(1);
    });
  });
});
