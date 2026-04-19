import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-code';
import { ERROR_MESSAGES } from '../errors/error-messages';
import { AppLogger } from '../logger/app-logger.service';

type RequestWithContext = Request & { requestId?: string };

type HttpExceptionResponse = {
  code?: ErrorCode;
  message?: string | string[];
  details?: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithContext>();
    const res = ctx.getResponse<Response>();

    const requestId = req.requestId;
    const meta = {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    };

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const r =
        typeof response === 'object'
          ? (response as HttpExceptionResponse)
          : undefined;

      if (r && typeof r === 'object' && r.code) {
        code = r.code;
        message =
          typeof r.message === 'string'
            ? r.message
            : (ERROR_MESSAGES[code] ?? message);
        details = r.details;
      } else {
        if (status === HttpStatus.BAD_REQUEST) code = ErrorCode.BAD_REQUEST;
        if (status === HttpStatus.UNAUTHORIZED) code = ErrorCode.UNAUTHORIZED;
        if (status === HttpStatus.FORBIDDEN) code = ErrorCode.FORBIDDEN;
        if (status === HttpStatus.NOT_FOUND) code = ErrorCode.NOT_FOUND;
        if (status === HttpStatus.CONFLICT) code = ErrorCode.CONFLICT;
        if (status === HttpStatus.TOO_MANY_REQUESTS)
          code = ErrorCode.RATE_LIMITED;

        if (r && typeof r === 'object') {
          message =
            r.message && typeof r.message === 'string'
              ? r.message
              : (ERROR_MESSAGES[code] ?? message);
          details =
            r.message && Array.isArray(r.message)
              ? { errors: r.message }
              : undefined;
        }
      }
    }

    this.logger.error('Unhandled exception', {
      requestId,
      status,
      code,
      path: req.url,
      method: req.method,
      exception: serializeError(exception),
    });

    res.status(status).json({
      success: false,
      code,
      message,
      details,
      meta,
    });
  }
}

function serializeError(e: unknown) {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
    };
  }
  return { value: e };
}
