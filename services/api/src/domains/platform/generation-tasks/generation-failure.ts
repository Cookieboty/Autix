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
}

function clipBody(body: string | undefined): string | undefined {
  if (body === undefined) return undefined;
  return truncateToBytes(body, UPSTREAM_BODY_BYTE_LIMIT);
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
  };
}

export function fromUnknown(err: unknown, stage: GenerationErrorStage): GenerationFailure {
  return {
    stage,
    message: err instanceof Error ? err.message : String(err),
  };
}
