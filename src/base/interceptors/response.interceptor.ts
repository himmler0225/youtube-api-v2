import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";
import { Request } from "express";
import { ErrorCode } from "@/base/errors/error-code";
import { ApiResponse, isApiResponse } from "@/base/http/api-response";

type RequestWithContext = Request & { requestId?: string };

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<RequestWithContext>();

    const meta = {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    };

    return next.handle().pipe(
      map((data) => {
        if (isApiResponse(data)) return data;

        return {
          success: true,
          code: ErrorCode.OK,
          message: "OK",
          data,
          meta,
        };
      }),
    );
  }
}
