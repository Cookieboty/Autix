import type { GenerationTaskAdminListParams } from '@autix/shared-store';

export const GENERATION_TASK_PAGE_SIZE = 20;

export type GenerationTaskFilters = Partial<
  Record<'kind' | 'status' | 'errorStage' | 'userId' | 'model' | 'provider' | 'errorClass' | 'q' | 'from' | 'to', string>
>;

/** 空串一律剔除：后端 DTO 用 @IsOptional，空串会被当成有值而进入 where。 */
export function buildListParams(
  filters: GenerationTaskFilters,
  cursor: string | null,
): GenerationTaskAdminListParams {
  const params: GenerationTaskAdminListParams = { limit: GENERATION_TASK_PAGE_SIZE };
  for (const [key, value] of Object.entries(filters)) {
    if (value) (params as Record<string, unknown>)[key] = value;
  }
  if (cursor) params.cursor = cursor;
  return params;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m${seconds}s`;
}

export type StatusTone = 'success' | 'danger' | 'neutral';

export function statusTone(status: string): StatusTone {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED' || status === 'EXPIRED') return 'danger';
  return 'neutral';
}
