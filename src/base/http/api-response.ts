import { ErrorCode } from "@/base/errors/error-code";

export type ApiMeta = {
  requestId?: string;
  timestamp: string;
  path?: string;
  method?: string;
};

export type ApiSuccess<T> = {
  success: true;
  code: ErrorCode.OK;
  message: string;
  data: T;
  meta: ApiMeta;
};

export type ApiError = {
  success: false;
  code: Exclude<ErrorCode, ErrorCode.OK>;
  message: string;
  details?: unknown;
  meta: ApiMeta;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiResponse(x: unknown): x is ApiResponse<unknown> {
  return (
    x !== null &&
    x !== undefined &&
    typeof x === "object" &&
    "success" in x &&
    typeof x.success === "boolean" &&
    "meta" in x &&
    typeof x.meta === "object"
  );
}
