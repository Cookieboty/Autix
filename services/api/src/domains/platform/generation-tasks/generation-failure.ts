import type { GenerationErrorStage } from '../prisma/generated';
import { truncateToBytes, UPSTREAM_BODY_BYTE_LIMIT } from '../common/snapshot-sanitizer';
import type { ImageUpstreamError } from '@autix/ai-adapters/image';
import type { VideoUpstreamError } from '@autix/ai-adapters/video';

/**
 * 统一失败描述。**必须在异常最原始的位置构造** —— 现状是图片在 callImageApi 内就被转成
 * BadRequestException（只留 httpStatus + message），视频被压成 err.message，等到落库点
 * 时结构化字段早已丢失。构造顺序应为：catch 上游异常 → GenerationFailure → 再派生用户异常。
 */
export interface GenerationFailure {
  stage: GenerationErrorStage;
  class?: string;
  code?: string;
  message: string;
  upstreamStatus?: number;
  upstreamBody?: string;
  upstreamRequestId?: string;
  diagnostics?: Record<string, unknown>;
}

function clipBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;
  return truncateToBytes(body, UPSTREAM_BODY_BYTE_LIMIT);
}

/**
 * 挤掉值为 undefined 的 key；若挤完一个 key 都不剩，返回 undefined 而非 `{}`——
 * 兜底列宁可缺失也不留一个空对象占位（区分「没有诊断信息」与「诊断信息是空对象」）。
 */
function compactDiagnostics(
  fields: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function fromImageUpstreamError(
  err: ImageUpstreamError,
  stage: GenerationErrorStage,
): GenerationFailure {
  return {
    stage,
    class: err.classification,
    message: err.message,
    upstreamStatus: err.httpStatus,
    upstreamBody: clipBody(err.upstreamBody),
    upstreamRequestId: err.requestId,
    diagnostics: compactDiagnostics({
      endpoint: err.endpoint,
      retryAfter: err.retryAfter,
      retryable: err.retryable,
    }),
  };
}

export function fromVideoUpstreamError(
  err: VideoUpstreamError,
  stage: GenerationErrorStage,
): GenerationFailure {
  return {
    stage,
    class: err.classification,
    message: err.message,
    upstreamStatus: err.httpStatus,
    upstreamBody: clipBody(err.upstreamBody),
    upstreamRequestId: err.requestId,
    // video 侧 VideoUpstreamError 没有 retryAfter 字段（确认 packages/ai-adapters/src/video/protocol/types.ts），
    // 故这里只放 endpoint/retryable，不是漏填。
    diagnostics: compactDiagnostics({
      endpoint: err.endpoint,
      retryable: err.retryable,
    }),
  };
}

export function fromUnknown(err: unknown, stage: GenerationErrorStage): GenerationFailure {
  return {
    stage,
    message: err instanceof Error ? err.message : String(err),
  };
}
