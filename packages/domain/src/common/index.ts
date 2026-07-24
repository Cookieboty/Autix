export interface ApiResponseHint {
  i18nKey: string;
  params?: Record<string, string | number>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  data: T;
  hint?: ApiResponseHint;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> extends PaginationMeta {
  items: T[];
}

export interface ListPaginationMeta extends PaginationMeta {
  totalPages: number;
}

export interface ListResult<T> {
  list: T[];
  pagination: ListPaginationMeta;
}

export interface MessageResponse {
  /**
   * i18n 词条键，由 ResponseInterceptor 按请求语言翻译成 `message` 写入响应体。
   * 业务层只返回键，不硬编码文案。
   */
  messageKey: string;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VIDEO_MEMBERSHIP_REQUIRED'
  | 'VIDEO_MEMBERSHIP_LIMIT_EXCEEDED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'STEP_UP_REQUIRED'
  | 'STEP_UP_INVALID_OR_EXPIRED'
  | 'STEP_UP_UNAVAILABLE'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'
  | 'OTP_LOCKED'
  | 'OTP_ALREADY_CONSUMED'
  | 'EMAIL_CHANGE_TOKEN_INVALID'
  | 'EMAIL_TAKEN'
  | 'PASSWORD_TOO_WEAK'
  | 'PROVIDER_REAUTH_UNSUPPORTED'
  | 'TOO_MANY_REQUESTS'
  | 'INSUFFICIENT_POINTS'
  | 'USER_DELETED'
  | 'USER_NOT_AVAILABLE'
  | 'INVALID_STATUS_TRANSITION'
  | 'EMAIL_CHANGE_NOT_AVAILABLE'
  | 'ACCOUNT_DELETE_CONFIRMATION_MISMATCH'
  | 'SUPER_ADMIN_CANNOT_SELF_DELETE'
  | 'CONTACT_SUPPORT'
  | 'FEATURE_DISABLED'
  | 'STORAGE_RESERVATION_INVALID'
  | 'STORAGE_RESERVATION_CONSUMED'
  | 'STORAGE_OBJECT_MISSING'
  | 'AVATAR_UPLOAD_MISMATCH'
  | 'INVITE_CODE_INVALID'
  | 'REGISTRATION_ROLE_MISSING';

export const STEP_UP_ERROR_CODES: readonly ErrorCode[] = [
  'STEP_UP_REQUIRED',
  'STEP_UP_INVALID_OR_EXPIRED',
  'STEP_UP_UNAVAILABLE',
  'OTP_REQUIRED',
  'OTP_INVALID',
  'OTP_LOCKED',
  'OTP_ALREADY_CONSUMED',
] as const;

export function isStepUpErrorCode(code: string | undefined | null): boolean {
  if (!code) return false;
  return (STEP_UP_ERROR_CODES as readonly string[]).includes(code);
}

export function buildSuccess<T>(
  data: T,
  msg = 'common.request_success',
  hint?: ApiResponseHint,
): ApiResponse<T> {
  const res: ApiResponse<T> = {
    success: true,
    code: '200',
    msg,
    traceId: crypto.randomUUID(),
    data,
  };
  if (hint) res.hint = hint;
  return res;
}

export function buildError(
  code: ErrorCode,
  msg: string,
  traceId?: string,
  hint?: ApiResponseHint,
): ApiResponse<null> {
  const res: ApiResponse<null> = {
    success: false,
    code,
    msg,
    traceId: traceId ?? crypto.randomUUID(),
    data: null,
  };
  if (hint) res.hint = hint;
  return res;
}

export interface TaskEvent {
  id: string;
  taskType: string;
  taskId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}
