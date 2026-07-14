import { BadRequestException } from '@nestjs/common';
import { readImageMaxCount } from '@autix/domain/model';
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

/**
 * 张数上限 = 模型能力上限 ∩ 风控硬上限（spec §5.2）。
 *
 * `IMAGE_RISK_HARD_LIMITS.maxCount` 是**风控**上限（防滥用/DoS），任何模型都不得突破；
 * `metadata.limits.maxCount` 是**能力**上限（这个模型一次最多出几张）。两者取交：
 * admin 在 metadata 里写 99 也只会被 clamp 到风控上限。模型没声明能力上限时退回风控上限。
 *
 * 这是**唯一**的 clamp 点（dispatch 入口调一次）—— 此前 adapter 层与 coerceImageParams
 * 各自 clamp 一遍，谁是权威说不清。
 */
export function resolveImageCountCeiling(metadata: unknown): number {
  const modelMax = readImageMaxCount(metadata) ?? IMAGE_RISK_HARD_LIMITS.maxCount;
  return Math.min(modelMax, IMAGE_RISK_HARD_LIMITS.maxCount);
}

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
