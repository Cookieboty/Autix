import { GenerationErrorStage } from '../prisma/generated';
import { fromUnknown, fromImageUpstreamError, fromVideoUpstreamError } from './generation-failure';
import { ImageUpstreamError } from '@autix/ai-adapters/image';
import { VideoUpstreamError } from '@autix/ai-adapters/video';

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

  it('upstreamBody 为空字符串时保留为空字符串，与字段整个不传（undefined）区分', () => {
    const emptyBodyErr = new ImageUpstreamError({
      message: 'upstream responded with empty body',
      httpStatus: 502,
      classification: 'upstream',
      upstreamBody: '',
      retryable: true,
    });
    const emptyBodyFailure = fromImageUpstreamError(emptyBodyErr, GenerationErrorStage.SUBMIT);
    expect(emptyBodyFailure.upstreamBody).toBe('');

    const noBodyErr = new ImageUpstreamError({
      message: 'upstream unreachable',
      httpStatus: undefined,
      classification: 'timeout',
      retryable: true,
    });
    const noBodyFailure = fromImageUpstreamError(noBodyErr, GenerationErrorStage.SUBMIT);
    expect(noBodyFailure.upstreamBody).toBeUndefined();
  });

  it('fromVideoUpstreamError 保留上游结构化字段 —— 与 image 侧对称', () => {
    const err = new VideoUpstreamError({
      message: 'upstream video call failed with 400',
      httpStatus: 400,
      classification: 'params',
      requestId: 'req-2',
      upstreamBody: '{"error":{"code":"bad_duration"}}',
      retryable: false,
      endpoint: 'https://x/video',
    });
    const failure = fromVideoUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.stage).toBe(GenerationErrorStage.SUBMIT);
    expect(failure.class).toBe('params');
    expect(failure.upstreamStatus).toBe(400);
    expect(failure.upstreamRequestId).toBe('req-2');
    expect(failure.upstreamBody).toContain('bad_duration');
  });

  it('fromImageUpstreamError 把 endpoint/retryAfter/retryable 收进 diagnostics', () => {
    const err = new ImageUpstreamError({
      message: 'upstream image call failed with 503',
      httpStatus: 503,
      classification: 'upstream',
      retryable: true,
      endpoint: 'https://x/gen?sig=abc',
      retryAfter: '30',
    });
    const failure = fromImageUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.diagnostics).toEqual({
      endpoint: 'https://x/gen?sig=abc',
      retryAfter: '30',
      retryable: true,
    });
  });

  it('fromImageUpstreamError 未提供 endpoint/retryAfter 时 diagnostics 仍保留已定义的 retryable', () => {
    const err = new ImageUpstreamError({
      message: 'upstream unreachable',
      classification: 'timeout',
      retryable: false,
    });
    const failure = fromImageUpstreamError(err, GenerationErrorStage.SUBMIT);

    // retryable 是必填 boolean（恒有值），故三字段"全 undefined"分支在真实调用下不可达；
    // 这里验证的是 false 这个已定义值不会被误当作 undefined 挤掉。
    expect(failure.diagnostics).toEqual({ retryable: false });
  });

  it('fromImageUpstreamError 防御性分支：诊断字段全部 undefined（含 retryable）时 diagnostics 为 undefined 而非空对象', () => {
    const err = new ImageUpstreamError({
      message: 'upstream unreachable',
      classification: 'timeout',
      // 类型上 retryable 是必填项，这里用 as unknown 强制传 undefined，只为验证
      // 「compact 之后无 key 则整体 undefined」这条通用契约，而非模拟真实调用路径。
      retryable: undefined as unknown as boolean,
    });
    const failure = fromImageUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.diagnostics).toBeUndefined();
  });

  it('fromVideoUpstreamError 把 endpoint/retryable 收进 diagnostics（video 侧无 retryAfter 字段）', () => {
    const err = new VideoUpstreamError({
      message: 'upstream video call failed with 503',
      httpStatus: 503,
      classification: 'upstream',
      retryable: true,
      endpoint: 'https://x/video?sig=abc',
    });
    const failure = fromVideoUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.diagnostics).toEqual({
      endpoint: 'https://x/video?sig=abc',
      retryable: true,
    });
  });

  it('fromVideoUpstreamError 未提供 endpoint 时 diagnostics 仍保留已定义的 retryable', () => {
    const err = new VideoUpstreamError({
      message: 'upstream unreachable',
      classification: 'timeout',
      retryable: false,
    });
    const failure = fromVideoUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.diagnostics).toEqual({ retryable: false });
  });

  it('fromVideoUpstreamError 防御性分支：诊断字段全部 undefined（含 retryable）时 diagnostics 为 undefined 而非空对象', () => {
    const err = new VideoUpstreamError({
      message: 'upstream unreachable',
      classification: 'timeout',
      retryable: undefined as unknown as boolean,
    });
    const failure = fromVideoUpstreamError(err, GenerationErrorStage.SUBMIT);

    expect(failure.diagnostics).toBeUndefined();
  });

  it('fromUnknown 不填 diagnostics', () => {
    const failure = fromUnknown(new Error('boom'), GenerationErrorStage.PERSIST);
    expect(failure.diagnostics).toBeUndefined();
  });
});
