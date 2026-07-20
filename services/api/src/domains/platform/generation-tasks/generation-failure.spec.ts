import { GenerationErrorStage } from '../prisma/generated';
import { fromUnknown, fromImageUpstreamError } from './generation-failure';
import { ImageUpstreamError } from '@autix/ai-adapters/image';

describe('GenerationFailure', () => {
  it('保留上游结构化字段 —— 这正是当前落库时丢掉的信息', () => {
    const err = new ImageUpstreamError({
      message: 'upstream image call failed with 400',
      httpStatus: 400,
      classification: 'params',
      requestId: 'req-1',
      upstreamBody: '{"error":{"code":"bad_size"}}',
      retryable: false,
      endpoint: 'https://x/gen',
    });
    const failure = fromImageUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.stage).toBe(GenerationErrorStage.SUBMIT);
    expect(failure.upstreamStatus).toBe(400);
    expect(failure.class).toBe('params');
    expect(failure.upstreamRequestId).toBe('req-1');
    expect(failure.upstreamBody).toContain('bad_size');
  });

  it('超长 upstreamBody 被截断', () => {
    const err = new ImageUpstreamError({
      message: 'boom',
      httpStatus: 500,
      classification: 'upstream',
      upstreamBody: 'x'.repeat(20000),
      retryable: true,
    });
    const failure = fromImageUpstreamError(err, GenerationErrorStage.SUBMIT);
    expect(Buffer.byteLength(failure.upstreamBody!, 'utf8')).toBeLessThan(5000);
    expect(failure.upstreamBody).toContain('truncated');
  });

  it('未知异常降级为 message，不抛', () => {
    expect(fromUnknown(new Error('boom'), GenerationErrorStage.PERSIST)).toEqual({
      stage: GenerationErrorStage.PERSIST,
      message: 'boom',
    });
    expect(fromUnknown('plain', GenerationErrorStage.BILLING).message).toBe('plain');
  });
});
