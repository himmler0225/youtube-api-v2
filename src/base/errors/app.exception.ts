/**
 * Custom exception của hệ thống — mở rộng từ HttpException của NestJS
 *
 * Thay vì throw HttpException thô, hãy dùng các static method:
 *   throw AppException.conflict('Username đã tồn tại')
 *   throw AppException.unauthorized()
 *   throw AppException.notFound('User không tồn tại')
 *
 * AllExceptionsFilter sẽ bắt và format thành ApiError chuẩn.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code';
import { ERROR_MESSAGES } from './error-messages';

export type AppExceptionPayload = {
  code: ErrorCode;
  // Nếu không truyền → dùng message mặc định từ ERROR_MESSAGES
  message?: string;
  // Thông tin bổ sung (danh sách lỗi validation, v.v.)
  details?: unknown;
};

export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(
    payload: AppExceptionPayload,
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    // Ưu tiên message truyền vào → message mặc định theo code → fallback 'Error'
    const message = payload.message ?? ERROR_MESSAGES[payload.code] ?? 'Error';
    super({ code: payload.code, message, details: payload.details }, status);

    this.code = payload.code;
    this.details = payload.details;
  }

  // Dùng khi request không hợp lệ (tổng quát) → HTTP 400
  static badRequest(message?: string, details?: unknown) {
    return new AppException(
      { code: ErrorCode.BAD_REQUEST, message, details },
      HttpStatus.BAD_REQUEST,
    );
  }

  static validation(details?: unknown, message?: string) {
    return new AppException(
      { code: ErrorCode.VALIDATION_ERROR, message, details },
      HttpStatus.BAD_REQUEST,
    );
  }

  static unauthorized(message?: string) {
    return new AppException(
      { code: ErrorCode.UNAUTHORIZED, message },
      HttpStatus.UNAUTHORIZED,
    );
  }

  static forbidden(message?: string) {
    return new AppException(
      { code: ErrorCode.FORBIDDEN, message },
      HttpStatus.FORBIDDEN,
    );
  }

  static notFound(message?: string) {
    return new AppException(
      { code: ErrorCode.NOT_FOUND, message },
      HttpStatus.NOT_FOUND,
    );
  }

  static conflict(message?: string, details?: unknown) {
    return new AppException(
      { code: ErrorCode.CONFLICT, message, details },
      HttpStatus.CONFLICT,
    );
  }

  static rateLimited(message?: string) {
    return new AppException(
      { code: ErrorCode.RATE_LIMITED, message },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  static internal(message?: string, details?: unknown) {
    return new AppException(
      { code: ErrorCode.INTERNAL_ERROR, message, details },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  static db(message?: string, details?: unknown) {
    return new AppException(
      { code: ErrorCode.DB_ERROR, message, details },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
