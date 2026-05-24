import { HttpStatus } from '@nestjs/common';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 'argon2id',
}));

import { AuthService } from './auth.service';
import { AppException } from '@/base/errors/app.exception';
import { ErrorCode } from '@/base/errors/error-code';
import { UserStatus, SessionStatus } from '@generated/prisma/enums';

const mockReq = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'test-agent' },
  get: jest.fn().mockReturnValue('test-agent'),
} as any;

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockPrisma: any;
  let mockJwt: any;
  let mockRedis: any;
  let mockConfig: any;
  let mockLogger: any;

  beforeEach(() => {
    mockUserRepo = {
      findByIdentifier: jest.fn(),
      existsBy: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
      findOne: jest.fn(),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      loginAttempt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    mockJwt = {
      sign: jest.fn().mockReturnValue('mock-token'),
      decode: jest.fn().mockReturnValue({ jti: 'test-jti', exp: 9999999999 }),
    };

    mockRedis = {
      set: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
      slidingWindowCount: jest.fn().mockResolvedValue(0),
      slidingWindowAdd: jest.fn(),
    };

    mockConfig = {
      getOrThrow: jest.fn().mockReturnValue('test-pepper'),
      get: jest.fn().mockReturnValue('15m'),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    service = new AuthService(
      mockUserRepo,
      mockPrisma,
      mockJwt,
      mockRedis,
      mockConfig,
      mockLogger,
    );
  });

  // ── create (register) ──────────────────────────────────────────────────────

  describe('create (register)', () => {
    it('throws CONFLICT when username is already taken', async () => {
      mockUserRepo.existsBy.mockResolvedValue(true);

      const payload = {
        username: 'existinguser',
        password: 'Password1!',
        deviceId: 'device-1',
      };

      await expect(service.create(payload as any, mockReq)).rejects.toThrow(
        AppException,
      );

      let thrownError: AppException | null = null;
      try {
        await service.create(payload as any, mockReq);
      } catch (e) {
        thrownError = e as AppException;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      expect(thrownError!.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(thrownError!.code).toBe(ErrorCode.USERNAME_TAKEN);
    });

    it("creates user and returns tokens for a new registration", async () => {
      mockUserRepo.existsBy.mockResolvedValue(false);

      const newUser = {
        id: 'user-123',
        username: 'newuser',
        email: null,
        phone: null,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
        createdAt: new Date(),
      };
      mockUserRepo.create.mockResolvedValue(newUser);
      mockPrisma.authSession.findMany.mockResolvedValue([]);

      const payload = {
        username: 'newuser',
        password: 'Password1!',
        deviceId: 'device-1',
        deviceName: 'Chrome',
      };

      const result = await service.create(payload as any, mockReq);

      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockPrisma.authSession.create).toHaveBeenCalled();
      expect(mockJwt.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toMatchObject({ id: 'user-123', username: 'newuser' });
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UNAUTHORIZED when user is not found', async () => {
      mockUserRepo.findByIdentifier.mockResolvedValue(null);

      const payload = {
        identifier: 'ghost@example.com',
        password: 'Password1!',
        deviceId: 'device-1',
      };

      let thrownError: AppException | null = null;
      try {
        await service.login(payload as any, mockReq);
      } catch (e) {
        thrownError = e as AppException;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      expect(thrownError!.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(thrownError!.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    it('returns tokens when credentials are correct', async () => {
      const existingUser = {
        id: 'user-456',
        username: 'alice',
        email: 'alice@example.com',
        phone: null,
        passwordHash: '$argon2id$hashed',
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        createdAt: new Date(),
      };
      mockUserRepo.findByIdentifier.mockResolvedValue(existingUser);
      mockPrisma.authSession.findMany.mockResolvedValue([]);

      const payload = {
        identifier: 'alice',
        password: 'correctpassword',
        deviceId: 'device-2',
        deviceName: 'Firefox',
      };

      const result = await service.login(payload as any, mockReq);

      expect(mockUserRepo.findByIdentifier).toHaveBeenCalledWith('alice');
      expect(mockPrisma.authSession.create).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken', 'mock-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toMatchObject({ id: 'user-456', username: 'alice' });
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('blacklists JTI in Redis and returns success', async () => {
      const activeSession = { id: 'session-789' };
      mockPrisma.authSession.findFirst.mockResolvedValue(activeSession);

      const tokenExp = Math.floor(Date.now() / 1000) + 900; // expires in 15 min

      const result = await service.logout(
        'user-456',
        'session-789',
        'jti-abc',
        tokenExp,
        mockReq,
      );

      expect(mockPrisma.authSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-789' },
          data: expect.objectContaining({ status: SessionStatus.REVOKED }),
        }),
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'jti:jti-abc',
        1,
        expect.any(Number),
      );
      expect(result).toEqual({ success: true });
    });

    it('throws UNAUTHORIZED when session does not exist', async () => {
      mockPrisma.authSession.findFirst.mockResolvedValue(null);

      let thrownError: AppException | null = null;
      try {
        await service.logout('user-999', 'bad-session', 'jti-xyz', 9999999999, mockReq);
      } catch (e) {
        thrownError = e as AppException;
      }

      expect(thrownError).toBeInstanceOf(AppException);
      expect(thrownError!.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
