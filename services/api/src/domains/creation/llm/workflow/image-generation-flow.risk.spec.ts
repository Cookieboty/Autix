import { BadRequestException } from '@nestjs/common';
import {
  assertImageHardLimits,
  IMAGE_RISK_HARD_LIMITS,
  resolveImageCountCeiling,
} from './image-generation-flow.risk';

describe('resolveImageCountCeiling', () => {
  it('takes the model capability from metadata.limits.maxCount when it is below the risk cap', () => {
    expect(resolveImageCountCeiling({ limits: { maxCount: 1 } })).toBe(1);
    expect(resolveImageCountCeiling({ limits: { maxCount: 2 } })).toBe(2);
  });

  it('never lets a model claim more than the risk hard cap — 交集，不是取模型值', () => {
    // 风控硬上限是防滥用/DoS 的兜底：admin 在 metadata 里写 99 也不能突破它。
    expect(resolveImageCountCeiling({ limits: { maxCount: 99 } })).toBe(
      IMAGE_RISK_HARD_LIMITS.maxCount,
    );
  });

  it('falls back to the risk cap when the model declares no limit', () => {
    expect(resolveImageCountCeiling({})).toBe(IMAGE_RISK_HARD_LIMITS.maxCount);
    expect(resolveImageCountCeiling(null)).toBe(IMAGE_RISK_HARD_LIMITS.maxCount);
    expect(resolveImageCountCeiling({ limits: { maxCount: 0 } })).toBe(
      IMAGE_RISK_HARD_LIMITS.maxCount,
    );
  });
});

describe('assertImageHardLimits', () => {
  it('passes for reasonable size and count', () => {
    expect(() => assertImageHardLimits({ size: '1024x1024', count: 4 })).not.toThrow();
  });

  it('rejects a resolution above the absolute pixel ceiling', () => {
    expect(() => assertImageHardLimits({ size: '8192x8192', count: 1 })).toThrow(BadRequestException);
  });

  it('rejects a count above the hard cap', () => {
    expect(() =>
      assertImageHardLimits({ size: '512x512', count: IMAGE_RISK_HARD_LIMITS.maxCount + 1 }),
    ).toThrow(BadRequestException);
  });

  it('does not throw for unknown size (cannot enforce pixels)', () => {
    expect(() => assertImageHardLimits({ size: undefined, count: 1 })).not.toThrow();
  });
});
