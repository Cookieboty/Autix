import { GenerationKind, GenerationErrorStage, GenerationTaskStatus } from '../prisma/generated';
import { GenerationTaskRecorder } from './generation-task.recorder';

function buildRepo() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    markQueued: vi.fn().mockResolvedValue(undefined),
    claimTerminal: vi.fn().mockResolvedValue(true),
    recordBilling: vi.fn().mockResolvedValue(undefined),
    recordLateCallback: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GenerationTaskRecorder', () => {
  it('start 会净化快照并记录 prompt 长度', async () => {
    const repo = buildRepo();
    const recorder = new GenerationTaskRecorder(repo as any);

    await recorder.start({
      id: 't-1',
      kind: GenerationKind.IMAGE,
      userId: 'u-1',
      model: 'seedream',
      prompt: '一只猫',
      paramsSnapshot: { apiKey: 'sk-1' },
    });

    const arg = repo.create.mock.calls[0][0];
    expect(arg.promptLength).toBe(3);
    expect(arg.paramsSnapshot).toEqual({ apiKey: '[REDACTED]' });
  });

  it('start 失败必须抛出 —— 任务行是生成的前置条件，不是旁挂记录', async () => {
    const repo = buildRepo();
    repo.create.mockRejectedValue(new Error('db down'));
    const recorder = new GenerationTaskRecorder(repo as any);

    await expect(
      recorder.start({ id: 't-1', kind: GenerationKind.IMAGE, userId: 'u-1', model: 'm' }),
    ).rejects.toThrow('db down');
  });

  it('fail 把 GenerationFailure 展开成列', async () => {
    const repo = buildRepo();
    const recorder = new GenerationTaskRecorder(repo as any);
    const tx = {} as any;

    await recorder.fail(
      't-1',
      {
        stage: GenerationErrorStage.SUBMIT,
        class: 'params',
        message: 'bad size',
        upstreamStatus: 400,
        upstreamBody: '{"e":1}',
        upstreamRequestId: 'req-1',
      },
      tx,
    );

    const [, next] = repo.claimTerminal.mock.calls[0];
    expect(next.status).toBe(GenerationTaskStatus.FAILED);
    expect(next.errorStage).toBe(GenerationErrorStage.SUBMIT);
    expect(next.errorClass).toBe('params');
    expect(next.errorMessage).toBe('bad size');
    expect(next.upstreamStatus).toBe(400);
    expect(next.upstreamBody).toBe('{"e":1}');
    expect(next.upstreamRequestId).toBe('req-1');
  });

  it('succeed 把 imageGenerationId/durationMs 透传给终态更新，返回值即 claimTerminal 的布尔结果', async () => {
    const repo = buildRepo();
    repo.claimTerminal.mockResolvedValue(false);
    const recorder = new GenerationTaskRecorder(repo as any);
    const tx = {} as any;

    const result = await recorder.succeed(
      't-1',
      { imageGenerationId: 'img-1', durationMs: 1234 },
      tx,
    );

    const [, next] = repo.claimTerminal.mock.calls[0];
    expect(next.status).toBe(GenerationTaskStatus.SUCCEEDED);
    expect(next.imageGenerationId).toBe('img-1');
    expect(next.durationMs).toBe(1234);
    // claimTerminal mock 显式设成 false，验证 succeed 直接透传返回值而非恒返回 true。
    expect(result).toBe(false);
  });

  it('recordBilling 失败只吞掉，不影响调用方', async () => {
    const repo = buildRepo();
    repo.recordBilling.mockRejectedValue(new Error('nope'));
    const recorder = new GenerationTaskRecorder(repo as any);

    await expect(recorder.recordBilling('t-1', 'REFUNDED' as any)).resolves.toBeUndefined();
  });
});
