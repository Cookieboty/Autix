export interface TaskInput {
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  resolution?: string;
  duration?: number;
  quality?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'expired';
  resultUrl?: string;
  error?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerationProvider {
  readonly providerName: string;
  createTask(input: TaskInput): Promise<string>;
  queryTask(taskId: string): Promise<TaskStatus>;
  cancelTask?(taskId: string): Promise<void>;
}
