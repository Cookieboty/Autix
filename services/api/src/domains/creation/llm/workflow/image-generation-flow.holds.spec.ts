import { BadRequestException } from '@nestjs/common';
import {
  assertPromptOptimizeInputWithinLimit,
  PROMPT_OPTIMIZE_MAX_INPUT_TOKENS,
} from './image-generation-flow.holds';

describe('assertPromptOptimizeInputWithinLimit (FIX-18)', () => {
  it('allows input at or below the cap', () => {
    expect(() => assertPromptOptimizeInputWithinLimit(PROMPT_OPTIMIZE_MAX_INPUT_TOKENS)).not.toThrow();
    expect(() => assertPromptOptimizeInputWithinLimit(100)).not.toThrow();
  });

  it('rejects input above the cap', () => {
    expect(() =>
      assertPromptOptimizeInputWithinLimit(PROMPT_OPTIMIZE_MAX_INPUT_TOKENS + 1),
    ).toThrow(BadRequestException);
  });
});
