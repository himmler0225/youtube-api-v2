import { AiLabelService } from "./ai-label.service";
import { AppException } from "@/base/errors/app.exception";

// Helper to create a mock fetch Response
const mockFetchResponse = (body: object, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const groqSuccess = (category: string, quality: number) => ({
  choices: [{ message: { content: JSON.stringify({ category, quality }) } }],
});

describe("AiLabelService", () => {
  let service: AiLabelService;
  let mockConfig: any;
  let mockLogger: any;
  let mockPrisma: any;
  let mockLabelQueue: any;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn().mockReturnValue("test-api-key"),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    mockPrisma = {
      video: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      videoLabel: {
        upsert: jest.fn(),
      },
    };

    mockLabelQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    service = new AiLabelService(mockConfig, mockLogger, mockPrisma, mockLabelQueue);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // classify
  // ---------------------------------------------------------------------------

  it("classify → no API key → returns null", async () => {
    mockConfig.get.mockReturnValue("");
    // Re-instantiate so constructor reads empty key
    service = new AiLabelService(mockConfig, mockLogger, mockPrisma, mockLabelQueue);

    const result = await service.classify("vid1", "Some Title");

    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("classify → API returns valid JSON → returns { category, quality }", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(groqSuccess("Music", 3)),
    );

    const result = await service.classify("vid1", "Great Song");

    expect(result).toEqual({ category: "Music", quality: 3 });
  });

  it("classify → API returns invalid category → defaults to 'Other'", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(groqSuccess("InvalidCategory" as any, 2)),
    );

    const result = await service.classify("vid1", "Mystery Video");

    expect(result).toEqual({ category: "Other", quality: 2 });
  });

  it("classify → quality out of range → defaults to 2", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse(groqSuccess("Gaming", 99)),
    );

    const result = await service.classify("vid1", "Game Stream");

    expect(result).toEqual({ category: "Gaming", quality: 2 });
  });

  it("classify → rate limited (429) → retries and returns result on second attempt", async () => {
    jest.useFakeTimers();

    const fetchSpy = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(mockFetchResponse({}, 429))
      .mockResolvedValueOnce(mockFetchResponse(groqSuccess("Tech", 3)));

    const classifyPromise = service.classify("vid1", "Tech Video");
    // Advance timers to skip the 30_000ms delay on attempt 1
    await jest.runAllTimersAsync();

    const result = await classifyPromise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ category: "Tech", quality: 3 });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[AiLabel] Rate limited, retrying",
      expect.objectContaining({ attempt: 1 }),
    );

    jest.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // backfill
  // ---------------------------------------------------------------------------

  it("backfill → finds unlabeled videos → adds to queue, returns { queued, total }", async () => {
    const unlabeled = [{ id: "vid1" }, { id: "vid2" }, { id: "vid3" }];
    mockPrisma.video.findMany.mockResolvedValue(unlabeled);
    mockPrisma.video.count.mockResolvedValue(10);

    const result = await service.backfill(500);

    expect(mockLabelQueue.add).toHaveBeenCalledTimes(3);
    expect(mockLabelQueue.add).toHaveBeenCalledWith(
      "label",
      { videoId: "vid1" },
      expect.objectContaining({ jobId: "vid1" }),
    );
    expect(result).toEqual({ queued: 3, total: 10 });
  });

  // ---------------------------------------------------------------------------
  // backfillDirect
  // ---------------------------------------------------------------------------

  it("backfillDirect → no unlabeled videos → returns { labeled: 0, total: 0, skipped: 0 }", async () => {
    mockPrisma.video.findMany.mockResolvedValue([]);
    mockPrisma.video.count.mockResolvedValue(0);

    const fetchSpy = jest.spyOn(global, "fetch");

    const result = await service.backfillDirect(20);

    expect(result).toEqual({ labeled: 0, total: 0, skipped: 0 });
    // fetch should never be called when there are no videos
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("backfillDirect → batch classify success → upserts labels and returns counts", async () => {
    const videos = [
      { id: "vid1", title: "Music Video", descriptionSnippet: "A great song" },
      { id: "vid2", title: "Game Stream", descriptionSnippet: "Live gaming" },
    ];
    const batchResponse = [
      { id: "vid1", category: "Music", quality: 3 },
      { id: "vid2", category: "Gaming", quality: 2 },
    ];

    mockPrisma.video.findMany.mockResolvedValue(videos);
    mockPrisma.video.count.mockResolvedValue(2);
    mockPrisma.videoLabel.upsert.mockResolvedValue({});

    jest.spyOn(global, "fetch").mockResolvedValue(
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify(batchResponse) } }],
      }),
    );

    const result = await service.backfillDirect(20);

    expect(mockPrisma.videoLabel.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.videoLabel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { videoId: "vid1" },
        create: expect.objectContaining({ category: "Music", quality: 3 }),
      }),
    );
    expect(result).toEqual({ labeled: 2, total: 2, skipped: 0 });
  });
});
