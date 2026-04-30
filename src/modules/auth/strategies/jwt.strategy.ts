import { HttpStatus, Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/modules/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";
import { AppException } from "@/base/errors/app.exception";
import { ErrorCode } from "@/base/errors/error-code";
import { UserStatus } from "@generated/prisma/enums";

export type JwtPayload = {
  userId: string;
  sessionId: string;
  v: number;
  jti: string;
  exp: number; // injected automatically by jwt.sign
};

export type JwtUser = {
  userId: string;
  sessionId: string;
  jti: string;
  exp: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    // JTI blacklist — token đã bị logout hay chưa
    const blacklisted = await this.redis.exists(`jti:${payload.jti}`);
    if (blacklisted) {
      throw new AppException(
        { code: ErrorCode.UNAUTHORIZED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // tokenVersion + status — invalidate ngay khi đổi mật khẩu hoặc ban account
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true, status: true },
    });

    if (
      !user ||
      user.tokenVersion !== payload.v ||
      user.status !== UserStatus.ACTIVE
    ) {
      throw new AppException(
        { code: ErrorCode.UNAUTHORIZED },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      userId: payload.userId,
      sessionId: payload.sessionId,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
