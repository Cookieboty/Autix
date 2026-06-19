export type {
  ApiResponse,
  ErrorCode,
  ListPaginationMeta,
  ListResult,
  MessageResponse,
  PaginatedResult,
  PaginationMeta,
} from '@autix/types';
export { buildError, buildSuccess } from '@autix/types';

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
