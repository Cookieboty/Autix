import { ForbiddenException } from '@nestjs/common';

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
  concurrency: 1,
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
    concurrency: positiveIntOrDefault(image.concurrency, 1),
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
    throw new ForbiddenException({
      code: 'IMAGE_MEMBERSHIP_REQUIRED',
      message: `当前会员等级（${entitlement.levelName}）未开通图片生成功能，请升级套餐`,
    });
  }
  const pixels = parseImageSizePixels(requested.size);
  if (pixels > entitlement.maxPixels) {
    throw new ForbiddenException({
      code: 'IMAGE_MEMBERSHIP_LIMIT_EXCEEDED',
      message: `当前会员等级（${entitlement.levelName}）图片分辨率超出上限，请降低分辨率或升级套餐`,
    });
  }
  if (
    entitlement.allowedQualities.length > 0 &&
    requested.quality &&
    !entitlement.allowedQualities.includes(requested.quality)
  ) {
    throw new ForbiddenException({
      code: 'IMAGE_MEMBERSHIP_LIMIT_EXCEEDED',
      message: `当前会员等级（${entitlement.levelName}）不支持画质 ${requested.quality}，请调整画质或升级套餐`,
    });
  }
}

function positiveIntOrDefault(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
