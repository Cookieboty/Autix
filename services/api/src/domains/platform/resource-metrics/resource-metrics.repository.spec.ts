import { ResourceType } from '../prisma/generated';
import { ResourceMetricsRepository } from './resource-metrics.repository';

/**
 * Plan C Task 5：download 同步事务计数。
 * 镜像 recordReference 的事务结构——单个 $transaction 内
 * `resource_download_events.create` + `downloadCount` INCR + 读回 metrics。
 * 与 like/favorite 不同：下载不去重，每次调用都必须真实插入事件 + 真实自增
 * （不吞 P2002、不做 tryCreateUnique 幂等短路）。
 */
function createPrismaMock() {
  const metricsRow = {
    resourceType: ResourceType.GALLERY_POST,
    resourceId: 'post-1',
    downloadCount: 0,
  };

  const tx = {
    resource_download_events: {
      create: vi.fn().mockResolvedValue({ id: 'dl-1' }),
    },
    resource_metrics: {
      upsert: vi.fn().mockImplementation(() => {
        metricsRow.downloadCount += 1;
        return Promise.resolve({ ...metricsRow });
      }),
      findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...metricsRow })),
    },
  };

  return {
    tx,
    metricsRow,
    prisma: {
      $transaction: vi.fn((fn: (transaction: typeof tx) => unknown) => fn(tx)),
    },
  };
}

describe('ResourceMetricsRepository.recordDownload', () => {
  it('同一事务插事件 + downloadCount+1', async () => {
    const { prisma, tx } = createPrismaMock();
    const repo = new ResourceMetricsRepository(prisma as never);

    const before = await tx.resource_metrics.findUnique();
    expect(before.downloadCount).toBe(0);

    const after = await repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.resource_download_events.create).toHaveBeenCalledWith({
      data: { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-1', userId: 'user-1' },
    });
    expect(tx.resource_metrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resourceType_resourceId: { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-1' },
        },
        update: expect.objectContaining({ downloadCount: { increment: 1 } }),
        create: expect.objectContaining({ downloadCount: 1 }),
      }),
    );
    expect(after?.downloadCount).toBe(1);
  });

  it('事件插入先于计数器 INCR（在同一事务回调内顺序执行）', async () => {
    const { prisma, tx } = createPrismaMock();
    const repo = new ResourceMetricsRepository(prisma as never);
    const order: string[] = [];
    tx.resource_download_events.create.mockImplementation(() => {
      order.push('event');
      return Promise.resolve({ id: 'dl-1' });
    });
    tx.resource_metrics.upsert.mockImplementation(() => {
      order.push('bump');
      return Promise.resolve({});
    });

    await repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1');

    expect(order).toEqual(['event', 'bump']);
  });

  it('不做幂等去重：同一用户重复下载同一资源，每次都新插事件 + 真实自增', async () => {
    const { prisma, tx, metricsRow } = createPrismaMock();
    const repo = new ResourceMetricsRepository(prisma as never);

    await repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1');
    await repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1');
    await repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1');

    expect(tx.resource_download_events.create).toHaveBeenCalledTimes(3);
    expect(tx.resource_metrics.upsert).toHaveBeenCalledTimes(3);
    expect(metricsRow.downloadCount).toBe(3);
  });

  it('P2002（理论上不该发生，因为无唯一约束）也不会被静默吞掉——异常照常向上抛', async () => {
    const { prisma, tx } = createPrismaMock();
    const repo = new ResourceMetricsRepository(prisma as never);
    tx.resource_download_events.create.mockRejectedValueOnce(new Error('unexpected db error'));

    await expect(
      repo.recordDownload(ResourceType.GALLERY_POST, 'post-1', 'user-1'),
    ).rejects.toThrow('unexpected db error');
    expect(tx.resource_metrics.upsert).not.toHaveBeenCalled();
  });
});

/**
 * Step 4：cron 聚合不参与 downloadCount。
 * ResourceMetricsCron 两个任务（aggregateAndRecompute / dailyReconciliation，见
 * resource-metrics.cron.ts）都只调用 pipelineService.aggregateDaily()（写
 * pvCount/uvCount/viewCount/lastActivityAt，见 resource-view.pipeline.ts）和
 * service.recomputeHotScores()（经 setHotScore 只 SET hotScore/hotScoreVersion）。
 * 起一个完整的 cron 集成测试需要真实拉起 pipeline + DB，超出本任务范围；这里改为
 * 对 cron 实际调用的写路径（setHotScore）做白名单断言——它是 recomputeHotScores 唯一
 * 的写方法，只要它的 update payload 里没有 downloadCount，cron 就结构性地碰不到它。
 */
describe('ResourceMetricsRepository.setHotScore — cron 聚合不参与 downloadCount', () => {
  it('update 数据白名单仅 hotScore/hotScoreVersion，不包含 downloadCount', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { resource_metrics: { update } };
    const repo = new ResourceMetricsRepository(prisma as never);

    await repo.setHotScore(ResourceType.GALLERY_POST, 'post-1', 42, 'v1');

    expect(update).toHaveBeenCalledWith({
      where: {
        resourceType_resourceId: { resourceType: ResourceType.GALLERY_POST, resourceId: 'post-1' },
      },
      data: { hotScore: 42, hotScoreVersion: 'v1' },
    });
    expect(Object.keys(update.mock.calls[0][0].data)).not.toContain('downloadCount');
  });
});
