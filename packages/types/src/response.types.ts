export interface ApiResponse<T = any> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  data: T;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';

export function buildSuccess<T>(data: T, msg = '请求成功'): ApiResponse<T> {
  return {
    success: true,
    code: '200',
    msg,
    traceId: crypto.randomUUID(),
    data,
  };
}

export function buildError(code: ErrorCode, msg: string, traceId?: string): ApiResponse<null> {
  return {
    success: false,
    code,
    msg,
    traceId: traceId ?? crypto.randomUUID(),
    data: null,
  };
}
