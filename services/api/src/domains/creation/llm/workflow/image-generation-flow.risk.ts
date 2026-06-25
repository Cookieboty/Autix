import { BadRequestException } from '@nestjs/common';
import {
  IMAGE_PIXELS_HARD_CEILING,
  parseImageSizePixels,
} from '../../../billing/membership/image-entitlement.helpers';

/**
 * FIX-4: 图片生成绝对硬上限（不分等级，任何人都不得突破）。
 * 与分级 entitlement 互补：entitlement 默认宽松，硬上限作为防滥用/防 DoS 的兜底。
 */
export const IMAGE_RISK_HARD_LIMITS = {
  maxPixels: IMAGE_PIXELS_HARD_CEILING,
  maxCount: 4,
} as const;

export function assertImageHardLimits(req: { size?: string | null; count: number }): void {
  const pixels = parseImageSizePixels(req.size);
  if (pixels > IMAGE_RISK_HARD_LIMITS.maxPixels) {
    throw new BadRequestException(
      `图片分辨率超过硬上限（${IMAGE_RISK_HARD_LIMITS.maxPixels} 像素）`,
    );
  }
  if (req.count > IMAGE_RISK_HARD_LIMITS.maxCount) {
    throw new BadRequestException(
      `单次图片数量不得超过 ${IMAGE_RISK_HARD_LIMITS.maxCount}`,
    );
  }
}
