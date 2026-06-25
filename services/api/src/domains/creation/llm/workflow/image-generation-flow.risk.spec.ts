import { BadRequestException } from '@nestjs/common';
import { assertImageHardLimits, IMAGE_RISK_HARD_LIMITS } from './image-generation-flow.risk';

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
