import { VideoGenStatus } from '../../platform/prisma/generated';
import { VideoGenerationRepository } from './video-generation.repository';

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
    };
    const prisma = {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      material_assets: { createMany: vi.fn(async () => ({ count: 1 })) },
    };
    const repo = new VideoGenerationRepository(prisma as any);
    return { repo, tx, prisma };
  }

  const failedInput = {
    generationId: 'gen-1',
    clipId: 'clip-1',
    status: VideoGenStatus.failed,
    externalStatus: 'failed',
    error: 'boom',
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
        { generationId: 'gen-1', clipId: 'clip-1', error: 'boom' },
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
        { generationId: 'gen-1', clipId: 'clip-1', error: 'boom' },
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
