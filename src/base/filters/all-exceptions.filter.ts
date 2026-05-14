import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ErrorCode } from "@/base/errors/error-code";
import { ERROR_MESSAGES } from "@/base/errors/error-messages";
import { AppLogger, parseOrigin } from "@/base/logger/app-logger.service";
import { AppException } from "@/base/errors/app.exception";

const CONTEXT = "ExceptionFilter";

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
        typeof response === "object"
          ? (response as HttpExceptionResponse)
          : undefined;

      if (r?.code) {
        code = r.code;
        message =
          typeof r.message === "string"
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

        if (r && typeof r === "object") {
          message =
            r.message && typeof r.message === "string"
              ? r.message
              : (ERROR_MESSAGES[code] ?? message);
          details =
            r.message && Array.isArray(r.message)
              ? { errors: r.message }
              : undefined;
        }
      }
    }

    this.logException(exception, {
      requestId,
      status,
      code,
      path: req.url,
      method: req.method,
    });

    res.status(status).json({ success: false, code, message, details, meta });
  }

  private logException(
    exception: unknown,
    info: {
      requestId?: string;
      status: number;
      code: ErrorCode;
      path: string;
      method: string;
    },
  ) {
    // AppException 4xx are intentional business errors — warn without stack
    if (exception instanceof AppException && info.status < 500) {
      this.logger.warn(
        "Expected error",
        {
          requestId: info.requestId,
          code: info.code,
          method: info.method,
          path: info.path,
        },
        CONTEXT,
      );
      return;
    }

    // Everything else is unexpected — log with origin file for debugging
    const err = exception instanceof Error ? exception : undefined;
    const origin = parseOrigin(err?.stack);

    this.logger.error(
      "Unhandled exception",
      {
        requestId: info.requestId,
        status: info.status,
        code: info.code,
        method: info.method,
        path: info.path,
        ...(origin && { origin }),
        error: serializeError(exception),
      },
      CONTEXT,
    );
  }
}

function serializeError(e: unknown) {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  return { value: e };
}
