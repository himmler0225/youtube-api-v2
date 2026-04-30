import { ErrorCode } from "./error-code.js";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.OK]: "OK",

  [ErrorCode.VALIDATION_ERROR]: "Dữ liệu không hợp lệ.",
  [ErrorCode.UNAUTHORIZED]: "Bạn cần đăng nhập để thực hiện thao tác này.",
  [ErrorCode.FORBIDDEN]: "Bạn không có quyền thực hiện thao tác này.",
  [ErrorCode.NOT_FOUND]: "Không tìm thấy tài nguyên.",
  [ErrorCode.CONFLICT]: "Dữ liệu bị trùng hoặc xung đột.",
  [ErrorCode.USERNAME_TAKEN]: "Username đã được sử dụng.",
  [ErrorCode.EMAIL_TAKEN]: "Email đã được sử dụng.",
  [ErrorCode.PHONE_TAKEN]: "Số điện thoại đã được sử dụng.",
  [ErrorCode.INVALID_CREDENTIALS]: "Thông tin đăng nhập không chính xác.",
  [ErrorCode.ACCOUNT_BANNED]: "Tài khoản của bạn đã bị khóa.",
  [ErrorCode.SESSION_EXPIRED]: "Phiên đăng nhập đã hết hạn.",
  [ErrorCode.TOKEN_REUSED]:
    "Phát hiện token bị tái sử dụng. Vui lòng đăng nhập lại.",
  [ErrorCode.RATE_LIMITED]: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",

  [ErrorCode.BAD_REQUEST]: "Yêu cầu không hợp lệ.",
  [ErrorCode.INTERNAL_ERROR]: "Có lỗi hệ thống. Vui lòng thử lại sau.",
  [ErrorCode.SERVICE_UNAVAILABLE]: "Dịch vụ tạm thời không khả dụng.",

  [ErrorCode.DB_ERROR]: "Lỗi cơ sở dữ liệu.",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "Lỗi dịch vụ bên thứ ba.",
};
