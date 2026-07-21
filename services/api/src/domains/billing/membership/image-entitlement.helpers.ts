import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@autix/domain';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

/**
 * FIX-4: 图片生成分级权益（复用视频侧 features 机制）。
 *
 * 默认行为为"宽松"：当某等级未配置 `features.image` 时，等同于硬上限（不额外收紧），
 * 因此在管理员配置分级矩阵之前不会破坏现有图片生成流程；真正的绝对兜底由
 * RiskService 风格的硬上限（见 image-generation-flow.risk.ts）保证。
 */
export interface ImageEntitlement {
  enabled: boolean;
  /** 单张图片最大像素（宽 × 高）。 */
  maxPixels: number;
  /** 允许的画质列表；为空表示不限制画质。 */
  allowedQualities: string[];
  concurrency: number;
  levelName: string;
  level: number;
  source: 'membership' | 'free_default';
}

/** 图片分辨率绝对硬上限（4096 × 4096）。 */
export const IMAGE_PIXELS_HARD_CEILING = 4096 * 4096;

export function parseImageSizePixels(size?: string | null): number {
  if (!size || typeof size !== 'string') return 0;
  const match = size.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!match) return 0;
  return Number(match[1]) * Number(match[2]);
}

const FREE_IMAGE_ENTITLEMENT: ImageEntitlement = {
  enabled: true,
  maxPixels: IMAGE_PIXELS_HARD_CEILING,
  allowedQualities: [],
  concurrency: 2,
  levelName: 'Free',
  level: 0,
  source: 'free_default',
};

type MembershipLevelRow = {
  status: string;
  expiresAt: Date;
  level: { level: number; name: string; features: unknown } | null;
} | null;

export function resolveImageEntitlement(
  membership: MembershipLevelRow,
  now: Date,
): ImageEntitlement {
  if (
    !membership ||
    membership.status !== 'ACTIVE' ||
    membership.expiresAt <= now ||
    !membership.level
  ) {
    return FREE_IMAGE_ENTITLEMENT;
  }
  const features = (membership.level.features ?? {}) as Record<string, unknown>;
  const image = (features.image ?? {}) as Record<string, unknown>;
  return {
    enabled: image.enabled === undefined ? true : Boolean(image.enabled),
    maxPixels: positiveIntOrDefault(image.maxPixels, IMAGE_PIXELS_HARD_CEILING),
    allowedQualities: Array.isArray(image.allowedQualities)
      ? image.allowedQualities.filter((q): q is string => typeof q === 'string')
      : [],
    concurrency: positiveIntOrDefault(image.concurrency, 2),
    levelName: membership.level.name,
    level: membership.level.level,
    source: 'membership',
  };
}

export function assertImageEntitlement(
  entitlement: ImageEntitlement,
  requested: { size?: string | null; quality?: string | null },
): void {
  if (!entitlement.enabled) {
    throw new I18nHttpException(
      HttpStatus.FORBIDDEN,
      'image_entitlement.membership_required',
      { levelName: entitlement.levelName },
      { code: 'IMAGE_MEMBERSHIP_REQUIRED' as ErrorCode },
    );
  }
  const pixels = parseImageSizePixels(requested.size);
  if (pixels > entitlement.maxPixels) {
    throw new I18nHttpException(
      HttpStatus.FORBIDDEN,
      'image_entitlement.resolution_exceeded',
      { levelName: entitlement.levelName },
      { code: 'IMAGE_MEMBERSHIP_LIMIT_EXCEEDED' as ErrorCode },
    );
  }
  if (
    entitlement.allowedQualities.length > 0 &&
    requested.quality &&
    !entitlement.allowedQualities.includes(requested.quality)
  ) {
    throw new I18nHttpException(
      HttpStatus.FORBIDDEN,
      'image_entitlement.quality_not_supported',
      { levelName: entitlement.levelName, quality: requested.quality },
      { code: 'IMAGE_MEMBERSHIP_LIMIT_EXCEEDED' as ErrorCode },
    );
  }
}

export class ImageConcurrencyLimitException extends HttpException {
  constructor(levelName: string, concurrency: number, activeCount = 0, requestedCount = 1) {
    super(
      {
        code: 'IMAGE_CONCURRENCY_LIMIT_EXCEEDED',
        message: `当前会员等级（${levelName}）最多同时生成 ${concurrency} 张图片，当前还有 ${activeCount} 张在生成中，本次请求 ${requestedCount} 张会超过上限，请等进行中的任务完成后再试`,
        // `data` 会被 AllExceptionsFilter 平铺进错误响应 envelope 的 data 字段，
        // 前端据此在弹窗里显示具体的 limit / active / requested。
        data: {
          levelName,
          concurrency,
          activeCount,
          requestedCount,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * FIX: 图片生成并发闸门。activeCount 为该用户在途（PENDING/PROCESSING）的
 * image_generation hold 数；activeCount + requestedCount 超过等级 concurrency 即拒绝。
 * 必须在创建本次 hold「之前」调用，否则会把自己算进去。
 */
export function assertImageConcurrency(
  activeCount: number,
  entitlement: ImageEntitlement,
  requestedCount = 1,
): void {
  const safeRequested = Math.max(1, Math.floor(requestedCount));
  if (activeCount + safeRequested > entitlement.concurrency) {
    throw new ImageConcurrencyLimitException(
      entitlement.levelName,
      entitlement.concurrency,
      activeCount,
      safeRequested,
    );
  }
}

function positiveIntOrDefault(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
