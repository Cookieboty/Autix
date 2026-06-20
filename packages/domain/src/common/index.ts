export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  msg: string;
  traceId: string;
  data: T;
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
  message: string;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR';

export function buildSuccess<T>(data: T, msg = 'common.request_success'): ApiResponse<T> {
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
