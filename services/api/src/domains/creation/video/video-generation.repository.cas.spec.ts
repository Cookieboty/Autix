import { VideoGenStatus } from '../../platform/prisma/generated';
import { GenerationTaskRecorder } from '../../platform/generation-tasks/generation-task.recorder';
import { GenerationTaskRepository } from '../../platform/generation-tasks/generation-task.repository';
import type { GenerationFailure } from '../../platform/generation-tasks/generation-failure';
import { VideoGenerationRepository } from './video-generation.repository';

/**
 * 任务侧（generation_tasks）在这些用例里跑**真实**的 recorder + repository，只把
 * PrismaClient 换成计数 stub —— 断言的是「输家不得写任务行」这条真实链路，
 * 而不是一个手写 mock 对 recorder 契约的复述。
 */
function makeTaskStub(taskClaimCount = 1) {
  const generation_tasks = {
    create: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: taskClaimCount })),
    update: vi.fn(async () => ({})),
  };
  return generation_tasks;
}

function makeRecorder(prisma: unknown) {
  return new GenerationTaskRecorder(new GenerationTaskRepository(prisma as never));
}

const submitFailure: GenerationFailure = { stage: 'SUBMIT', message: 'boom' };
const pollFailure: GenerationFailure = { stage: 'POLL', message: 'boom' };

/**
 * 回归：终态写入必须是 CAS。
 * 现状（修复前）是无状态条件的 update({where:{id}})，两个并发终态会互相覆盖，
 * 且 reconcileIfTerminal 只检查调用方传入的旧对象、不重读不加锁。
 */
describe('video 终态 CAS', () => {
  it('updateMany 的 where 必须带旧状态条件，只允许 pending/queued 迁出', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { video_clip_generations: { updateMany } } as any;

    const { claimVideoTerminal } = await import('./video-generation-terminal-cas');
    await claimVideoTerminal(tx, 'gen-1', {
      status: VideoGenStatus.completed,
      externalStatus: 'succeeded',
    });

    const where = updateMany.mock.calls[0][0].where;
    expect(where.id).toBe('gen-1');
    expect(where.status).toEqual({
      in: [VideoGenStatus.pending, VideoGenStatus.queued],
    });
  });

  it('count 为 0 时返回 false —— 输家不得继续写任何表', async () => {
    const tx = {
      video_clip_generations: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as any;

    const { claimVideoTerminal } = await import('./video-generation-terminal-cas');
    await expect(
      claimVideoTerminal(tx, 'gen-1', {
        status: VideoGenStatus.failed,
        externalStatus: 'failed',
        error: 'boom',
      }),
    ).resolves.toBe(false);
  });

  // 注意命名：这是**单元测**，用计数器模拟数据库的原子性，验证的是「输家不得继续」
  // 这条调用方契约，不是真并发。真并发需要打真实 Postgres 的两个并发事务，
  // 本仓暂无此类集成测试先例，已记入 backlog，本任务不做。
  it('CAS 输家不得继续写入：两次抢占只有一个返回 true', async () => {
    let remaining = 1;
    const updateMany = vi.fn().mockImplementation(async () => {
      if (remaining > 0) {
        remaining -= 1;
        return { count: 1 };
      }
      return { count: 0 };
    });
    const tx = { video_clip_generations: { updateMany } } as any;

    const { claimVideoTerminal } = await import('./video-generation-terminal-cas');
    const results = await Promise.all([
      claimVideoTerminal(tx, 'gen-1', {
        status: VideoGenStatus.completed,
        externalStatus: 'succeeded',
      }),
      claimVideoTerminal(tx, 'gen-1', {
        status: VideoGenStatus.failed,
        externalStatus: 'failed',
        error: 'boom',
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

/**
 * 四个终态方法的调用方契约：CAS 输家必须整体放弃 ——
 * 不写 clip、不确认 hold、不退款、不落素材。漏掉任何一处，并发下就意味着
 * 重复退款或重复落素材。
 */
describe('VideoGenerationRepository 终态方法：输家不得执行副作用', () => {
  function makeRepo(claimCount: number) {
    const tx = {
      video_clip_generations: {
        updateMany: vi.fn(async () => ({ count: claimCount })),
        findUnique: vi.fn(async () => ({
          id: 'gen-1',
          userId: 'user-1',
          resolvedPrompt: 'a cat surfing',
          model: 'seedance-2-0-fast',
          createdAt: new Date('2026-01-01T00:00:00.123Z'),
        })),
      },
      video_clips: { update: vi.fn(async () => ({})) },
      generation_tasks: makeTaskStub(),
    };
    const prisma = {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      material_assets: { createMany: vi.fn(async () => ({ count: 1 })) },
      generation_tasks: tx.generation_tasks,
    };
    const repo = new VideoGenerationRepository(prisma as any, makeRecorder(prisma));
    return { repo, tx, prisma };
  }

  const failedInput = {
    generationId: 'gen-1',
    clipId: 'clip-1',
    status: VideoGenStatus.failed,
    externalStatus: 'failed',
    error: 'boom',
    failure: pollFailure,
  };
  const completedInput = {
    generationId: 'gen-1',
    clipId: 'clip-1',
    externalStatus: 'succeeded',
    videoUrl: 'https://cdn/v.mp4',
    lastFrameUrl: null,
    durationSec: 5,
  };

  it('markGenerationCreateTaskFailedAndRefund：输家返回 false，不标 clip、不退款', async () => {
    const { repo, tx } = makeRepo(0);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markGenerationCreateTaskFailedAndRefund(
        { generationId: 'gen-1', clipId: 'clip-1', error: 'boom', failure: submitFailure },
        refundHold,
      ),
    ).resolves.toBe(false);

    expect(tx.video_clips.update).not.toHaveBeenCalled();
    expect(refundHold).not.toHaveBeenCalled();
  });

  it('markGenerationCreateTaskFailedAndRefund：赢家返回 true 并执行副作用', async () => {
    const { repo, tx } = makeRepo(1);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markGenerationCreateTaskFailedAndRefund(
        { generationId: 'gen-1', clipId: 'clip-1', error: 'boom', failure: submitFailure },
        refundHold,
      ),
    ).resolves.toBe(true);

    expect(tx.video_clips.update).toHaveBeenCalled();
    expect(refundHold).toHaveBeenCalledTimes(1);
  });

  it('markGenerationCompletedAndConfirmHold：输家返回 false，不确认 hold、不标 clip、不落素材', async () => {
    const { repo, tx, prisma } = makeRepo(0);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markGenerationCompletedAndConfirmHold(completedInput, confirmHold),
    ).resolves.toBe(false);

    expect(confirmHold).not.toHaveBeenCalled();
    expect(tx.video_clips.update).not.toHaveBeenCalled();
    expect(prisma.material_assets.createMany).not.toHaveBeenCalled();
  });

  it('markGenerationCompletedAndConfirmHold：赢家确认 hold、标 clip、落素材（素材元数据取重读的生成行）', async () => {
    const { repo, tx, prisma } = makeRepo(1);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markGenerationCompletedAndConfirmHold(completedInput, confirmHold),
    ).resolves.toBe(true);

    expect(confirmHold).toHaveBeenCalledTimes(1);
    expect(tx.video_clips.update).toHaveBeenCalled();
    // updateMany 不回行，落素材所需字段必须在同一事务里重读
    expect(tx.video_clip_generations.findUnique).toHaveBeenCalledWith({
      where: { id: 'gen-1' },
    });
    expect(prisma.material_assets.createMany).toHaveBeenCalledTimes(1);
    const rows = (prisma.material_assets.createMany.mock.calls as any[])[0][0].data;
    expect(rows[0].userId).toBe('user-1');
  });

  it('markGenerationFailedAndRefund：输家返回 false，不标 clip、不退款', async () => {
    const { repo, tx } = makeRepo(0);
    const refundHold = vi.fn(async () => ({}));

    await expect(repo.markGenerationFailedAndRefund(failedInput, refundHold)).resolves.toBe(false);

    expect(tx.video_clips.update).not.toHaveBeenCalled();
    expect(refundHold).not.toHaveBeenCalled();
  });

  it('markGenerationFailedAndRefund：赢家返回 true 并退款一次', async () => {
    const { repo, tx } = makeRepo(1);
    const refundHold = vi.fn(async () => ({}));

    await expect(repo.markGenerationFailedAndRefund(failedInput, refundHold)).resolves.toBe(true);

    expect(tx.video_clips.update).toHaveBeenCalled();
    expect(refundHold).toHaveBeenCalledTimes(1);
  });

  it('markGenerationExpiredWithoutRefund：输家返回 false，不把已完成的 clip 打成 failed', async () => {
    const { repo, tx } = makeRepo(0);

    await expect(
      repo.markGenerationExpiredWithoutRefund({ ...failedInput, status: VideoGenStatus.expired }),
    ).resolves.toBe(false);

    expect(tx.video_clips.update).not.toHaveBeenCalled();
  });

  it('markGenerationExpiredWithoutRefund：赢家返回 true 并标 clip failed', async () => {
    const { repo, tx } = makeRepo(1);

    await expect(
      repo.markGenerationExpiredWithoutRefund({ ...failedInput, status: VideoGenStatus.expired }),
    ).resolves.toBe(true);

    expect(tx.video_clips.update).toHaveBeenCalled();
  });
});

/**
 * Task 7.5：项目级 / 直连级的另外 6 个终态方法。
 * 与上面四个同构，但父行操作不同：
 *   - 项目级：video_clips.updateMany（整个项目的分镜）+ video_projects.update
 *   - 直连级：无父行，只写 generation 行本身
 * 输家一旦漏防，后果是重复确认扣费（真实资金）或重复退款（凭空发积分）。
 */
describe('VideoGenerationRepository 项目级/直连级终态方法：输家不得执行副作用', () => {
  function makeRepo(claimCount: number) {
    const tx = {
      video_clip_generations: {
        updateMany: vi.fn(async () => ({ count: claimCount })),
        findUnique: vi.fn(async () => ({
          id: 'gen-1',
          userId: 'user-1',
          resolvedPrompt: 'a cat surfing',
          model: 'seedance-2-0-fast',
          createdAt: new Date('2026-01-01T00:00:00.123Z'),
        })),
      },
      video_clips: { updateMany: vi.fn(async () => ({ count: 3 })) },
      video_projects: { update: vi.fn(async () => ({})) },
      generation_tasks: makeTaskStub(),
    };
    const prisma = {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      video_clip_generations: { updateMany: tx.video_clip_generations.updateMany },
      material_assets: { createMany: vi.fn(async () => ({ count: 1 })) },
      generation_tasks: tx.generation_tasks,
    };
    const repo = new VideoGenerationRepository(prisma as any, makeRecorder(prisma));
    return { repo, tx, prisma };
  }

  const projectCompletedInput = {
    generationId: 'gen-1',
    projectId: 'project-1',
    externalStatus: 'succeeded',
    videoUrl: 'https://cdn/v.mp4',
    lastFrameUrl: null,
    durationSec: 5,
  };
  const projectFailedInput = {
    generationId: 'gen-1',
    projectId: 'project-1',
    status: VideoGenStatus.failed,
    externalStatus: 'failed',
    error: 'boom',
    failure: pollFailure,
  };
  const directCompletedInput = {
    generationId: 'gen-1',
    externalStatus: 'succeeded',
    videoUrl: 'https://cdn/v.mp4',
    lastFrameUrl: null,
    durationSec: 5,
  };
  const directFailedInput = {
    generationId: 'gen-1',
    status: VideoGenStatus.failed,
    externalStatus: 'failed',
    error: 'boom',
    failure: pollFailure,
  };

  it('markProjectGenerationCompletedAndConfirmHold：输家返回 false，不确认 hold、不改分镜/项目、不落素材', async () => {
    const { repo, tx, prisma } = makeRepo(0);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markProjectGenerationCompletedAndConfirmHold(projectCompletedInput, confirmHold),
    ).resolves.toBe(false);

    // 语句顺序回归：confirmHold 必须排在 CAS 之后，否则输家会把扣费确认第二次。
    expect(confirmHold).not.toHaveBeenCalled();
    expect(tx.video_clips.updateMany).not.toHaveBeenCalled();
    expect(tx.video_projects.update).not.toHaveBeenCalled();
    expect(prisma.material_assets.createMany).not.toHaveBeenCalled();
  });

  it('markProjectGenerationCompletedAndConfirmHold：赢家确认 hold、收敛分镜与项目、落素材', async () => {
    const { repo, tx, prisma } = makeRepo(1);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markProjectGenerationCompletedAndConfirmHold(projectCompletedInput, confirmHold),
    ).resolves.toBe(true);

    expect(confirmHold).toHaveBeenCalledTimes(1);
    expect(tx.video_clips.updateMany).toHaveBeenCalled();
    expect(tx.video_projects.update).toHaveBeenCalled();
    // updateMany 不回行，落素材所需字段必须在同一事务里重读
    expect(tx.video_clip_generations.findUnique).toHaveBeenCalledWith({ where: { id: 'gen-1' } });
    expect(prisma.material_assets.createMany).toHaveBeenCalledTimes(1);
    const rows = (prisma.material_assets.createMany.mock.calls as any[])[0][0].data;
    expect(rows[0].userId).toBe('user-1');
  });

  it('markProjectGenerationFailedAndRefund：输家返回 false，不退款、不把整个项目打成 failed', async () => {
    const { repo, tx } = makeRepo(0);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markProjectGenerationFailedAndRefund(projectFailedInput, refundHold),
    ).resolves.toBe(false);

    expect(refundHold).not.toHaveBeenCalled();
    expect(tx.video_clips.updateMany).not.toHaveBeenCalled();
    expect(tx.video_projects.update).not.toHaveBeenCalled();
  });

  it('markProjectGenerationFailedAndRefund：赢家返回 true，收敛分镜与项目并退款一次', async () => {
    const { repo, tx } = makeRepo(1);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markProjectGenerationFailedAndRefund(projectFailedInput, refundHold),
    ).resolves.toBe(true);

    expect(refundHold).toHaveBeenCalledTimes(1);
    expect(tx.video_clips.updateMany).toHaveBeenCalled();
    expect(tx.video_projects.update).toHaveBeenCalled();
  });

  it('markDirectGenerationCompletedAndConfirmHold：输家返回 false，不确认 hold、不落素材', async () => {
    const { repo, prisma } = makeRepo(0);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markDirectGenerationCompletedAndConfirmHold(directCompletedInput, confirmHold),
    ).resolves.toBe(false);

    expect(confirmHold).not.toHaveBeenCalled();
    expect(prisma.material_assets.createMany).not.toHaveBeenCalled();
  });

  it('markDirectGenerationCompletedAndConfirmHold：赢家确认 hold 并落素材', async () => {
    const { repo, tx, prisma } = makeRepo(1);
    const confirmHold = vi.fn(async () => ({ userId: 'user-1' }));

    await expect(
      repo.markDirectGenerationCompletedAndConfirmHold(directCompletedInput, confirmHold),
    ).resolves.toBe(true);

    expect(confirmHold).toHaveBeenCalledTimes(1);
    expect(tx.video_clip_generations.findUnique).toHaveBeenCalledWith({ where: { id: 'gen-1' } });
    expect(prisma.material_assets.createMany).toHaveBeenCalledTimes(1);
    // 直连无父 clip/project —— 一行都不能碰（where:{id:null} 会抛）
    expect(tx.video_clips.updateMany).not.toHaveBeenCalled();
    expect(tx.video_projects.update).not.toHaveBeenCalled();
  });

  it('markDirectGenerationFailedAndRefund：输家返回 false，不退款', async () => {
    const { repo } = makeRepo(0);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markDirectGenerationFailedAndRefund(directFailedInput, refundHold),
    ).resolves.toBe(false);

    expect(refundHold).not.toHaveBeenCalled();
  });

  it('markDirectGenerationFailedAndRefund：赢家返回 true 并退款一次', async () => {
    const { repo } = makeRepo(1);
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markDirectGenerationFailedAndRefund(directFailedInput, refundHold),
    ).resolves.toBe(true);

    expect(refundHold).toHaveBeenCalledTimes(1);
  });

  it('markDirectGenerationExpiredWithoutRefund：输家返回 false，不把 completed 覆盖成 expired', async () => {
    const { repo, prisma } = makeRepo(0);

    await expect(
      repo.markDirectGenerationExpiredWithoutRefund({
        generationId: 'gen-1',
        externalStatus: 'expired',
        error: 'timeout',
        failure: pollFailure,
      }),
    ).resolves.toBe(false);

    // CAS 是唯一写入点：where 必须带旧状态条件
    const where = (prisma.video_clip_generations.updateMany.mock.calls as any[])[0][0].where;
    expect(where.status).toEqual({ in: [VideoGenStatus.pending, VideoGenStatus.queued] });
  });

  it('markDirectGenerationExpiredWithoutRefund：赢家返回 true', async () => {
    const { repo } = makeRepo(1);

    await expect(
      repo.markDirectGenerationExpiredWithoutRefund({
        generationId: 'gen-1',
        externalStatus: 'expired',
        error: 'timeout',
        failure: pollFailure,
      }),
    ).resolves.toBe(true);
  });

  it('markDirectGenerationFailed：输家返回 false，不覆盖已有终态', async () => {
    const { repo, prisma } = makeRepo(0);

    await expect(repo.markDirectGenerationFailed('gen-1', 'boom', submitFailure)).resolves.toBe(false);

    const where = (prisma.video_clip_generations.updateMany.mock.calls as any[])[0][0].where;
    expect(where.status).toEqual({ in: [VideoGenStatus.pending, VideoGenStatus.queued] });
  });

  it('markDirectGenerationFailed：赢家返回 true', async () => {
    const { repo } = makeRepo(1);

    await expect(repo.markDirectGenerationFailed('gen-1', 'boom', submitFailure)).resolves.toBe(true);
  });
});

/**
 * Task 8：generation_tasks 的写入必须与 video_clip_generations 的写入**同事务**。
 *
 * 两条不变量：
 *  1. `start()` 与 `video_clip_generations.create` 同事务 —— 否则任务行缺失会让终态 CAS
 *     恒判负，反而阻塞生成收敛（这正是本任务最大的坑）。
 *  2. 终态 CAS 输家一行都不写 —— 包括任务行。
 */
describe('Task 8：generation_tasks 与视频行同事务', () => {
  function makeTxRepo(claimCount: number) {
    const tx = {
      video_clip_generations: {
        create: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: claimCount })),
        findUnique: vi.fn(async () => ({
          id: 'gen-1',
          userId: 'user-1',
          resolvedPrompt: 'a cat surfing',
          model: 'seedance-2-0-fast',
          createdAt: new Date('2026-01-01T00:00:00.123Z'),
        })),
      },
      video_clips: { update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
      video_projects: { update: vi.fn(async () => ({})) },
      generation_tasks: {
        create: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: claimCount })),
        update: vi.fn(async () => ({})),
      },
    };
    // 事务外的 client 刻意**不**提供 generation_tasks.create/updateMany：任何漏用 tx 的
    // 写入都会在这里炸掉，而不是静默地跑到另一个连接上。
    const prisma = {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      material_assets: { createMany: vi.fn(async () => ({ count: 1 })) },
      // recordBilling 走事务外（提交之后），这里必须存在。
      generation_tasks: { update: vi.fn(async () => ({})) },
    };
    return { repo: new VideoGenerationRepository(prisma as any, makeRecorder(prisma)), tx, prisma };
  }

  it('createPendingGenerationAndMarkRunning：start 与 create 用同一个 tx client', async () => {
    const { repo, tx, prisma } = makeTxRepo(1);

    await repo.createPendingGenerationAndMarkRunning({
      generationId: 'gen-1',
      clipId: 'clip-1',
      projectId: 'project-1',
      userId: 'user-1',
      model: 'seedance-2-0-fast',
      resolvedPrompt: 'a cat surfing',
      params: {} as any,
      protocolKey: 'ark-video@v3',
      modelConfigId: 'mc-1',
      task: { provider: 'volcengine', materialCount: 2, holdId: 'hold-1' },
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.video_clip_generations.create).toHaveBeenCalledTimes(1);
    expect(tx.generation_tasks.create).toHaveBeenCalledTimes(1);
    expect((tx.generation_tasks.create.mock.calls as any[])[0][0].data).toMatchObject({
      id: 'gen-1',
      kind: 'VIDEO',
      userId: 'user-1',
      model: 'seedance-2-0-fast',
      modelConfigId: 'mc-1',
      provider: 'volcengine',
      protocolKey: 'ark-video@v3',
      materialCount: 2,
      holdId: 'hold-1',
      // 视频行在 start 时就存在 → 反向指针 create 时即写（与图片的 imageGenerationId 相反）。
      videoGenerationId: 'gen-1',
    });
  });

  it('start 抛出时整条生成不启动：异常向上传播，不被吞成 best-effort', async () => {
    const { repo, tx } = makeTxRepo(1);
    tx.generation_tasks.create.mockRejectedValueOnce(new Error('task insert failed'));

    await expect(
      repo.createDirectPendingGeneration({
        generationId: 'gen-1',
        userId: 'user-1',
        model: 'm',
        resolvedPrompt: 'p',
        params: {} as any,
        protocolKey: 'ark-video@v3',
        modelConfigId: 'mc-1',
        task: { materialCount: 0, holdId: 'hold-1' },
      }),
    ).rejects.toThrow('task insert failed');
  });

  it('终态赢家：任务行在同一 tx 内写 FAILED，errorStage 取调用方给的 stage', async () => {
    const { repo, tx } = makeTxRepo(1);

    await expect(
      repo.markGenerationFailedAndRefund(
        {
          generationId: 'gen-1',
          clipId: 'clip-1',
          status: VideoGenStatus.failed,
          externalStatus: 'failed',
          error: 'boom',
          failure: { stage: 'CALLBACK', message: 'boom', code: 'failed' },
        },
        vi.fn(async () => ({})),
      ),
    ).resolves.toBe(true);

    const call = (tx.generation_tasks.updateMany.mock.calls as any[])[0][0];
    expect(call.where.status).toEqual({ in: ['PENDING', 'QUEUED'] });
    expect(call.data).toMatchObject({
      status: 'FAILED',
      // stage 由调用方显式传入，**不得**从 callbackReceivedAt 推断。
      errorStage: 'CALLBACK',
      errorMessage: 'boom',
    });
  });

  it('expired 路径：任务状态直译成 EXPIRED，stage=POLL，且不写 billingStatus（本路径不退款）', async () => {
    const { repo, tx, prisma } = makeTxRepo(1);

    await expect(
      repo.markGenerationExpiredWithoutRefund({
        generationId: 'gen-1',
        clipId: 'clip-1',
        status: VideoGenStatus.expired,
        externalStatus: 'expired',
        error: 'timeout',
        failure: { stage: 'POLL', message: 'timeout', code: 'expired' },
      }),
    ).resolves.toBe(true);

    expect((tx.generation_tasks.updateMany.mock.calls as any[])[0][0].data).toMatchObject({
      status: 'EXPIRED',
      errorStage: 'POLL',
    });
    // 没试过退款就不该报 REFUNDED/REFUND_FAILED。
    expect(prisma.generation_tasks.update).not.toHaveBeenCalled();
  });

  it('终态输家：任务行一行不写（视频 CAS 判负时整体放弃）', async () => {
    const { repo, tx } = makeTxRepo(0);

    await expect(
      repo.markGenerationFailedAndRefund(
        {
          generationId: 'gen-1',
          clipId: 'clip-1',
          status: VideoGenStatus.failed,
          externalStatus: 'failed',
          error: 'boom',
          failure: pollFailure,
        },
        vi.fn(async () => ({})),
      ),
    ).resolves.toBe(false);

    expect(tx.generation_tasks.updateMany).not.toHaveBeenCalled();
  });

  it('完成路径：任务行写 SUCCEEDED，billingStatus=CONFIRMED 在事务提交之后才写', async () => {
    const { repo, tx, prisma } = makeTxRepo(1);
    const order: string[] = [];
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const r = await fn(tx);
      order.push('commit');
      return r;
    });
    prisma.generation_tasks.update.mockImplementation(async () => {
      order.push('recordBilling');
      return {};
    });

    await expect(
      repo.markGenerationCompletedAndConfirmHold(
        {
          generationId: 'gen-1',
          clipId: 'clip-1',
          externalStatus: 'succeeded',
          videoUrl: 'https://cdn/v.mp4',
          lastFrameUrl: null,
          durationSec: 5,
        },
        vi.fn(async () => ({ userId: 'user-1' })),
      ),
    ).resolves.toBe(true);

    expect((tx.generation_tasks.updateMany.mock.calls as any[])[0][0].data).toMatchObject({
      status: 'SUCCEEDED',
    });
    // recordBilling 独立于主事务，必须在提交**之后**——否则它失败会回滚已确认的扣费。
    expect(order).toEqual(['commit', 'recordBilling']);
    expect((prisma.generation_tasks.update.mock.calls as any[])[0][0].data).toMatchObject({
      billingStatus: 'CONFIRMED',
    });
  });

  it('任务行缺失（存量行）不阻塞视频收敛：任务 CAS 判负仍返回 true 并提交', async () => {
    const { repo, tx } = makeTxRepo(1);
    // 视频行 CAS 赢、任务行 CAS 输 —— 只可能是本特性上线前的存量行没有任务记录。
    tx.generation_tasks.updateMany.mockResolvedValueOnce({ count: 0 });
    const refundHold = vi.fn(async () => ({}));

    await expect(
      repo.markGenerationFailedAndRefund(
        {
          generationId: 'gen-1',
          clipId: 'clip-1',
          status: VideoGenStatus.failed,
          externalStatus: 'failed',
          error: 'boom',
          failure: pollFailure,
        },
        refundHold,
      ),
    ).resolves.toBe(true);

    // 退款与 clip 收敛照常发生：让观测侧的派生记录否决业务收敛，会把存量行永久卡死。
    expect(refundHold).toHaveBeenCalledTimes(1);
    expect(tx.video_clips.update).toHaveBeenCalled();
  });
});
