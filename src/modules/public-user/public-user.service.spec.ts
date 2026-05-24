import { PublicUserService } from "./public-user.service";
import { AppException } from "@/base/errors/app.exception";

describe("PublicUserService", () => {
  let service: PublicUserService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: { findFirst: jest.fn() },
      comment: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new PublicUserService(mockPrisma);
  });

  it("getProfile → user found by username → returns profile with stats", async () => {
    const user = {
      id: "user1",
      username: "johndoe",
      displayName: null,
      avatar: "https://avatar.example.com/1.png",
      createdAt: new Date("2024-01-01"),
    };

    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockPrisma.comment.count.mockResolvedValue(5);
    mockPrisma.comment.aggregate.mockResolvedValue({ _sum: { likesCount: 42 } });

    const result = await service.getProfile("johndoe");

    expect(result.username).toBe("johndoe");
    expect(result.stats.commentCount).toBe(5);
    expect(result.stats.totalLikes).toBe(42);
    expect(mockPrisma.comment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ author: "johndoe" }) }),
    );
  });

  it("getProfile → user not found → throws AppException notFound", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getProfile("ghost")).rejects.toBeInstanceOf(AppException);
    await expect(service.getProfile("ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getProfile → user has displayName → uses displayName as author for stats", async () => {
    const user = {
      id: "user2",
      username: "johndoe",
      displayName: "John Doe",
      avatar: null,
      createdAt: new Date("2024-03-01"),
    };

    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockPrisma.comment.count.mockResolvedValue(3);
    mockPrisma.comment.aggregate.mockResolvedValue({ _sum: { likesCount: null } });

    const result = await service.getProfile("johndoe");

    expect(mockPrisma.comment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ author: "John Doe" }) }),
    );
    expect(result.stats.totalLikes).toBe(0);
  });

  it("getComments → success → returns paginated comments", async () => {
    const user = { username: "johndoe", displayName: null };
    const comments = [
      { id: "cmt1", content: "Hello", video: { id: "vid1", title: "Test video", thumbnails: [], channelName: "Chan" } },
    ];

    mockPrisma.user.findFirst.mockResolvedValue(user);
    mockPrisma.comment.findMany.mockResolvedValue(comments);
    mockPrisma.comment.count.mockResolvedValue(1);

    const result = await service.getComments("johndoe", 1, 20);

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.comments).toHaveLength(1);
    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it("getComments → user not found → throws AppException notFound", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getComments("nobody")).rejects.toBeInstanceOf(AppException);
    await expect(service.getComments("nobody")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
