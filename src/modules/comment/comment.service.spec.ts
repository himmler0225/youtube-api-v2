import { CommentService } from "./comment.service";
import { AppException } from "@/base/errors/app.exception";

describe("CommentService", () => {
  let service: CommentService;
  let mockPrisma: any;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      video: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      comment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      commentLike: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((arg: any) => {
        if (Array.isArray(arg)) return Promise.resolve(arg.map(() => ({})));
        return arg(mockPrisma);
      }),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    service = new CommentService(mockPrisma, mockLogger);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  it("create → video + user found → creates comment and returns with authorUsername", async () => {
    const video = { id: "vid1" };
    const user = {
      id: "user1",
      username: "johndoe",
      displayName: null,
      avatar: "https://avatar.example.com/1.png",
    };
    const created = {
      id: "cmt1",
      videoId: "vid1",
      userId: "user1",
      author: "johndoe",
      avatar: user.avatar,
      content: "Hello world",
    };

    mockPrisma.video.findUnique.mockResolvedValue(video);
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.comment.create.mockResolvedValue(created);

    const result = await service.create("vid1", "user1", "Hello world");

    expect(mockPrisma.comment.create).toHaveBeenCalledTimes(1);
    expect(result.authorUsername).toBe("johndoe");
    expect(result.liked).toBe(false);
    expect(result.content).toBe("Hello world");
  });

  it("create → video not found → throws AppException notFound", async () => {
    mockPrisma.video.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user1", username: "johndoe", displayName: null, avatar: null });

    await expect(service.create("vid-missing", "user1", "Hello")).rejects.toBeInstanceOf(AppException);
    await expect(service.create("vid-missing", "user1", "Hello")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  // ---------------------------------------------------------------------------
  // reply
  // ---------------------------------------------------------------------------

  it("reply → parent comment + user found → creates reply and increments repliesCount", async () => {
    const parent = { id: "cmt1", videoId: "vid1" };
    const user = { id: "user1", username: "johndoe", displayName: "John Doe", avatar: null };
    const reply = {
      id: "cmt2",
      videoId: "vid1",
      parentId: "cmt1",
      userId: "user1",
      author: "John Doe",
      avatar: null,
      content: "Nice reply",
    };

    mockPrisma.comment.findUnique.mockResolvedValue(parent);
    mockPrisma.user.findUnique.mockResolvedValue(user);

    // $transaction receives an array; first element is the reply
    mockPrisma.$transaction = jest.fn().mockResolvedValue([reply, {}]);

    const result = await service.reply("cmt1", "user1", "Nice reply");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const txArgs = mockPrisma.$transaction.mock.calls[0][0] as any[];
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs).toHaveLength(2);
    expect(result.authorUsername).toBe("johndoe");
    expect(result.liked).toBe(false);
  });

  it("reply → comment not found → throws AppException", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user1", username: "u", displayName: null, avatar: null });

    await expect(service.reply("cmt-missing", "user1", "text")).rejects.toBeInstanceOf(AppException);
  });

  // ---------------------------------------------------------------------------
  // toggleLike
  // ---------------------------------------------------------------------------

  it("toggleLike → comment not found → throws AppException", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null);

    await expect(service.toggleLike("cmt-missing", "user1")).rejects.toBeInstanceOf(AppException);
  });

  it("toggleLike → not liked yet → creates like, returns { liked: true }", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: "cmt1" });
    mockPrisma.commentLike.findUnique.mockResolvedValue(null);

    const result = await service.toggleLike("cmt1", "user1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ liked: true });
  });

  it("toggleLike → already liked → deletes like, returns { liked: false }", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: "cmt1" });
    mockPrisma.commentLike.findUnique.mockResolvedValue({ userId: "user1", commentId: "cmt1" });

    const result = await service.toggleLike("cmt1", "user1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ liked: false });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  it("remove → not owner → throws AppException forbidden", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: "cmt1", userId: "other-user", parentId: null });

    await expect(service.remove("cmt1", "user1")).rejects.toBeInstanceOf(AppException);
    await expect(service.remove("cmt1", "user1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("remove → is owner, top-level comment → deletes successfully", async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ id: "cmt1", userId: "user1", parentId: null });

    // $transaction receives an async callback — invoke it with a tx proxy
    mockPrisma.$transaction = jest.fn().mockImplementation((cb: any) => {
      const tx = {
        comment: {
          delete: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });

    const result = await service.remove("cmt1", "user1");

    expect(result).toEqual({ deleted: true });
    const txFn = mockPrisma.$transaction.mock.calls[0][0];
    expect(typeof txFn).toBe("function");
  });

  // ---------------------------------------------------------------------------
  // getLikedCommentIds
  // ---------------------------------------------------------------------------

  it("getLikedCommentIds → returns Set of liked comment IDs", async () => {
    mockPrisma.commentLike.findMany.mockResolvedValue([
      { commentId: "cmt1" },
      { commentId: "cmt3" },
    ]);

    const result = await service.getLikedCommentIds("user1", ["cmt1", "cmt2", "cmt3"]);

    expect(result).toBeInstanceOf(Set);
    expect(result.has("cmt1")).toBe(true);
    expect(result.has("cmt3")).toBe(true);
    expect(result.has("cmt2")).toBe(false);
  });
});
