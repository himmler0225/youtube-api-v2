import { HttpStatus, Injectable } from "@nestjs/common";
import { Request } from "express";
import * as argon2 from "argon2";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { RegisterDto, LoginDto, RefreshDto } from "@/modules/auth/dto";
import { UserRepository } from "@/modules/auth/repositories/user.repository";
import { AppException } from "@/base/errors/app.exception";
import { ErrorCode } from "@/base/errors/error-code";
import { AppLogger } from "@/base/logger/app-logger.service";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";
import {
  SessionStatus,
  UserStatus,
  AuthEventType,
} from "@generated/prisma/enums";
import {
  REFRESH_TOKEN_TTL_MS,
  IDENTIFIER_FAIL_LIMIT,
  IDENTIFIER_FAIL_WINDOW_MS,
  IP_FAIL_LIMIT,
  IP_FAIL_WINDOW_MS,
} from "@/modules/auth/auth.constants";

@Injectable()
export class AuthService {
  private readonly pepper: string;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.pepper = this.config.getOrThrow<string>("TOKEN_PEPPER");
  }

  // ── Register ────────────────────────────────────────────────────────────────

  async create(payload: RegisterDto, req: Request) {
    const { username, email, phone, password, deviceId, deviceName } = payload;

    const usernameExists = await this.userRepo.existsBy("username", username);
    if (usernameExists) {
      throw new AppException(
        { code: ErrorCode.USERNAME_TAKEN },
        HttpStatus.CONFLICT,
      );
    }

    if (email) {
      const emailExists = await this.userRepo.existsBy("email", email);
      if (emailExists) {
        throw new AppException(
          { code: ErrorCode.EMAIL_TAKEN },
          HttpStatus.CONFLICT,
        );
      }
    }

    if (phone) {
      const phoneExists = await this.userRepo.existsBy("phone", phone);
      if (phoneExists) {
        throw new AppException(
          { code: ErrorCode.PHONE_TAKEN },
          HttpStatus.CONFLICT,
        );
      }
    }

    const passwordHash = await argon2.hash(password);

    const user = await this.userRepo.create({
      username,
      email,
      phone,
      passwordHash,
      passwordAlgo: "argon2id-v1",
    });

    this.logger.info("User registered", { userId: user.id, username });
    return this.createSession(user.id, deviceId, deviceName, req);
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(payload: LoginDto, req: Request) {
    const { identifier, password, deviceId, deviceName } = payload;

    const ipHash = this.hashData(req.ip ?? "unknown");
    const uaHash = this.hashData(req.headers["user-agent"] ?? "unknown");

    // Per-identifier brute-force (DB, persists across restarts)
    const identifierFails = await this.prisma.loginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: new Date(Date.now() - IDENTIFIER_FAIL_WINDOW_MS) },
      },
    });
    if (identifierFails >= IDENTIFIER_FAIL_LIMIT) {
      await this.recordLoginAttempt(
        null,
        identifier,
        ipHash,
        uaHash,
        false,
        "rate_limited",
      );
      throw AppException.rateLimited();
    }

    // Per-IP brute-force (Redis sliding window, fast path)
    const ipKey = `brute:ip:${ipHash}`;
    const ipFails = await this.redis.slidingWindowCount(
      ipKey,
      IP_FAIL_WINDOW_MS,
    );
    if (ipFails >= IP_FAIL_LIMIT) {
      throw AppException.rateLimited();
    }

    const user = await this.userRepo.findByIdentifier(identifier);

    if (!user || !user.passwordHash) {
      await this.recordLoginAttempt(
        null,
        identifier,
        ipHash,
        uaHash,
        false,
        "user_not_found",
      );
      await this.redis.slidingWindowAdd(ipKey, IP_FAIL_WINDOW_MS);
      throw new AppException(
        { code: ErrorCode.INVALID_CREDENTIALS },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status === UserStatus.BANNED) {
      await this.recordLoginAttempt(
        user.id,
        identifier,
        ipHash,
        uaHash,
        false,
        "user_banned",
      );
      throw new AppException(
        { code: ErrorCode.ACCOUNT_BANNED },
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status === UserStatus.DELETED) {
      await this.recordLoginAttempt(
        null,
        identifier,
        ipHash,
        uaHash,
        false,
        "user_deleted",
      );
      throw new AppException(
        { code: ErrorCode.INVALID_CREDENTIALS },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      await this.recordLoginAttempt(
        user.id,
        identifier,
        ipHash,
        uaHash,
        false,
        "bad_password",
      );
      await this.redis.slidingWindowAdd(ipKey, IP_FAIL_WINDOW_MS);
      throw new AppException(
        { code: ErrorCode.INVALID_CREDENTIALS },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.recordLoginAttempt(
      user.id,
      identifier,
      ipHash,
      uaHash,
      true,
      null,
    );
    this.logger.info("User logged in", { userId: user.id, identifier });
    return this.createSession(user.id, deviceId, deviceName, req);
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refresh(payload: RefreshDto, req: Request) {
    const { refreshToken, deviceId } = payload;

    const session = await this.prisma.authSession.findFirst({
      where: { deviceId, status: SessionStatus.ACTIVE },
      include: { user: true },
    });

    if (!session) {
      throw new AppException(
        { code: ErrorCode.UNAUTHORIZED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const ipHash = this.hashData(req.ip ?? "unknown");
    const uaHash = this.hashData(req.headers["user-agent"] ?? "unknown");

    // Timing-safe comparison — prevents timing attacks on token hash comparison
    const incomingHash = this.hashData(refreshToken);
    const storedHash = session.refreshTokenHash;

    const a = Buffer.from(incomingHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    const tokenMatch = a.length === b.length && timingSafeEqual(a, b);

    if (!tokenMatch) {
      // Revoke entire family — refresh token reuse detected
      await this.prisma.authSession.updateMany({
        where: { refreshTokenFamily: session.refreshTokenFamily },
        data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: session.userId,
          event: AuthEventType.REFRESH_REUSE_DETECTED,
          sessionId: session.id,
          ipHash,
          uaHash,
        },
      });
      throw new AppException(
        { code: ErrorCode.TOKEN_REUSED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.refreshExpiresAt < new Date()) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.EXPIRED },
      });
      throw new AppException(
        { code: ErrorCode.SESSION_EXPIRED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        { code: ErrorCode.ACCOUNT_BANNED },
        HttpStatus.FORBIDDEN,
      );
    }

    const newRefreshToken = randomBytes(32).toString("hex");
    const newRefreshTokenHash = this.hashData(newRefreshToken);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastRotatedAt: new Date(),
        lastSeenAt: new Date(),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const jti = randomUUID();
    const accessToken = this.jwt.sign({
      userId: session.userId,
      sessionId: session.id,
      v: session.user.tokenVersion,
      jti,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: session.userId,
        event: AuthEventType.REFRESH_SUCCESS,
        sessionId: session.id,
        ipHash,
        uaHash,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ── Me ──────────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.userRepo.findOne(userId, {
      select: [
        "id",
        "username",
        "email",
        "phone",
        "status",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!user) throw AppException.notFound("User not found");
    return user;
  }

  // ── Sessions ─────────────────────────────────────────────────────────────────

  async getSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, status: SessionStatus.ACTIVE },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        createdAt: true,
        lastSeenAt: true,
        refreshExpiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(
    userId: string,
    sessionId: string,
    jti: string,
    tokenExp: number,
    req: Request,
  ) {
    const session = await this.prisma.authSession.findFirst({
      where: { id: sessionId, userId, status: SessionStatus.ACTIVE },
    });

    if (!session) {
      throw new AppException(
        { code: ErrorCode.UNAUTHORIZED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });

    // Blacklist JTI to invalidate the access token immediately
    const ttl = tokenExp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`jti:${jti}`, 1, ttl);
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        event: AuthEventType.LOGOUT,
        sessionId,
        ipHash: this.hashData(req.ip ?? "unknown"),
        uaHash: this.hashData(req.headers["user-agent"] ?? "unknown"),
      },
    });

    this.logger.info("User logged out", { userId, sessionId });
    return { success: true };
  }

  // ── Logout All ───────────────────────────────────────────────────────────────

  async logoutAll(userId: string, sessionId: string, req: Request) {
    // Increment tokenVersion — invalidates ALL existing access tokens immediately
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    await this.prisma.authSession.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
    });

    const ipHash = this.hashData(req.ip ?? "unknown");
    const uaHash = this.hashData(req.headers["user-agent"] ?? "unknown");

    await this.prisma.auditLog.create({
      data: {
        userId,
        event: AuthEventType.LOGOUT_ALL,
        sessionId,
        ipHash,
        uaHash,
      },
    });

    this.logger.info("User logged out all sessions", { userId });
    return { success: true };
  }

  // ── Change Password ──────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    req: Request,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user.passwordHash) {
      throw new AppException(
        { code: ErrorCode.INVALID_CREDENTIALS },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new AppException(
        { code: ErrorCode.INVALID_CREDENTIALS },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const newHash = await argon2.hash(newPassword);

    // Atomic: update password + tokenVersion + revoke all sessions
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.REVOKED, revokedAt: new Date() },
      }),
    ]);

    const ipHash = this.hashData(req.ip ?? "unknown");
    const uaHash = this.hashData(req.headers["user-agent"] ?? "unknown");

    await this.prisma.auditLog.create({
      data: {
        userId,
        event: AuthEventType.PASSWORD_CHANGED,
        sessionId,
        ipHash,
        uaHash,
      },
    });

    this.logger.info("Password changed", { userId });
    return { success: true };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async createSession(
    userId: string,
    deviceId: string,
    deviceName: string | undefined,
    req: Request,
  ) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        status: true,
        tokenVersion: true,
        createdAt: true,
      },
    });

    const sessionId = randomUUID();
    const refreshToken = randomBytes(32).toString("hex");
    const refreshTokenFamily = randomUUID();
    const jti = randomUUID();

    const refreshTokenHash = this.hashData(refreshToken);
    const ipHash = this.hashData(req.ip ?? "unknown");
    const userAgentHash = this.hashData(req.headers["user-agent"] ?? "unknown");

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        deviceId,
        deviceName,
        refreshTokenHash,
        refreshTokenFamily,
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipHash,
        userAgentHash,
      },
    });

    const accessToken = this.jwt.sign({
      userId,
      sessionId,
      v: dbUser.tokenVersion,
      jti,
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        event: AuthEventType.LOGIN_SUCCESS,
        sessionId,
        ipHash,
        uaHash: userAgentHash,
      },
    });

    this.logger.info("Session created", { userId, sessionId, deviceId });

    const user = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      phone: dbUser.phone,
      status: dbUser.status,
      createdAt: dbUser.createdAt,
    };
    return { accessToken, refreshToken, user };
  }

  private async recordLoginAttempt(
    userId: string | null,
    identifier: string,
    ipHash: string,
    uaHash: string,
    success: boolean,
    reason: string | null,
  ) {
    await this.prisma.loginAttempt.create({
      data: { userId, identifier, ipHash, uaHash, success, reason },
    });
  }

  // HMAC-SHA256 with pepper — rainbow tables ineffective even if DB is dumped
  private hashData(data: string): string {
    return createHmac("sha256", this.pepper).update(data).digest("hex");
  }
}
