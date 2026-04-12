export class TaskEventResponseDto {
  id!: string;
  taskType!: string;
  taskId!: string;
  status!: 'pending' | 'processing' | 'done' | 'error';
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt!: string;
  readAt?: string;
}

export class TaskHistoryResponseDto {
  items!: TaskEventResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
  hasMore!: boolean;
}