import { HttpStatus, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AppException } from "@/base/errors/app.exception";
import { ErrorCode } from "@/base/errors/error-code";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw new AppException(
        { code: ErrorCode.UNAUTHORIZED },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }
}
