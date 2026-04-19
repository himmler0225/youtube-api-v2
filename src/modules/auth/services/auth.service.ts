import { HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

import { RegisterDto, LoginDto, RefreshDto } from '../dto';
import { UserRepository } from '../repositories/user.repository';
import { AppException } from '../../../base/errors/app.exception';
import { ErrorCode } from '../../../base/errors/error-code';
import { AppLogger } from '../../../base/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SessionStatus,
  UserStatus,
  AuthEventType,
} from '../../../../generated/prisma/enums';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly logger: AppLogger,
  ) {}

  async create(payload: RegisterDto, req: Request) {
    const { username, email, phone, password, deviceId, deviceName } = payload;

    const usernameExists = await this.userRepo.existsBy('username', username);
    if (usernameExists) {
      throw new AppException(
        { code: ErrorCode.USERNAME_TAKEN },
        HttpStatus.CONFLICT,
      );
    }

    if (email) {
      const emailExists = await this.userRepo.existsBy('email', email);
      if (emailExists) {
        throw new AppException(
          { code: ErrorCode.EMAIL_TAKEN },
          HttpStatus.CONFLICT,
        );
      }
    }

    if (phone) {
      const phoneExists = await this.userRepo.existsBy('phone', phone);
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
      passwordAlgo: 'argon2id-v1',
    });

    this.logger.info('User registered', { userId: user.id, username });

    return this.createSession(user.id, deviceId, deviceName, req);
  }

  async login(payload: LoginDto, req: Request) {
    const { identifier, password, deviceId, deviceName } = payload;

    const ipHash = this.hashData(req.ip ?? 'unknown');
    const uaHash = this.hashData(req.headers['user-agent'] ?? 'unknown');

    const user = await this.userRepo.findByIdentifier(identifier);

    // same error for user_not_found and bad_password to avoid user enumeration
    if (!user || !user.passwordHash) {
      await this.recordLoginAttempt(
        null,
        identifier,
        ipHash,
        uaHash,
        false,
        'user_not_found',
      );
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
        'user_banned',
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
        'user_deleted',
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
        'bad_password',
      );
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

    this.logger.info('User logged in', { userId: user.id, identifier });

    return this.createSession(user.id, deviceId, deviceName, req);
  }

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

    const ipHash = this.hashData(req.ip ?? 'unknown');
    const uaHash = this.hashData(req.headers['user-agent'] ?? 'unknown');

    const incomingHash = this.hashToken(refreshToken);
    if (incomingHash !== session.refreshTokenHash) {
      // revoke entire family — old rotated token reuse detected
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

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastRotatedAt: new Date(),
        lastSeenAt: new Date(),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessToken = this.jwt.sign({
      userId: session.userId,
      sessionId: session.id,
      v: session.user.tokenVersion,
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

  async logout(userId: string, sessionId: string, req: Request) {
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

    await this.prisma.auditLog.create({
      data: {
        userId,
        event: AuthEventType.LOGOUT,
        sessionId,
        ipHash: this.hashData(req.ip ?? 'unknown'),
        uaHash: this.hashData(req.headers['user-agent'] ?? 'unknown'),
      },
    });

    this.logger.info('User logged out', { userId, sessionId });

    return { success: true };
  }

  private async createSession(
    userId: string,
    deviceId: string,
    deviceName: string | undefined,
    req: Request,
  ) {
    const sessionId = crypto.randomUUID();
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenFamily = crypto.randomUUID();

    const refreshTokenHash = this.hashToken(refreshToken);
    const ipHash = this.hashData(req.ip ?? 'unknown');
    const userAgentHash = this.hashData(req.headers['user-agent'] ?? 'unknown');

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
      v: 0, // initial tokenVersion
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

    const user = await this.userRepo.findOne(userId, {
      select: ['id', 'username', 'email', 'phone', 'status', 'createdAt'],
    });

    this.logger.info('Session created', { userId, sessionId, deviceId });

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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
