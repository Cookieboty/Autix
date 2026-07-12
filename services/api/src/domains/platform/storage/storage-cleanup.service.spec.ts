import { StorageCleanupService } from './storage-cleanup.service';

type PrismaMock = {
  pending_uploads: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  storage_cleanup_tasks: {
    create: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

type R2Mock = {
  objectExists: jest.Mock;
  deleteObject: jest.Mock;
};

const NOW = new Date('2026-08-01T00:00:00.000Z');
const ACTIVE_LEASE = new Date('2026-08-01T00:05:00.000Z');

function deps() {
  const prisma: PrismaMock = {
    pending_uploads: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    storage_cleanup_tasks: {
      create: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: PrismaMock) => unknown) => fn(prisma));
  const r2: R2Mock = {
    objectExists: jest.fn(),
    deleteObject: jest.fn(),
  };
  const svc = new StorageCleanupService(prisma as never, r2 as never);
  return { prisma, r2, svc };
}

function workerIdOf(svc: StorageCleanupService): string {
  return (svc as unknown as { workerId: string }).workerId;
}

function claimedTask(svc: StorageCleanupService, overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    storageKey: 'avatars/u1/a.png',
    ownerUserId: 'u1',
    status: 'PROCESSING',
    attempts: 1,
    maxAttempts: 6,
    lockedBy: workerIdOf(svc),
    leaseExpiresAt: ACTIVE_LEASE,
    ...overrides,
  };
}

function sqlOf(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ').trim();
}

function updateForStatus(prisma: PrismaMock, status: string) {
  return prisma.storage_cleanup_tasks.updateMany.mock.calls.find((call) => call[0]?.data?.status === status)?.[0];
}

describe('StorageCleanupService', () => {
  describe('enqueue', () => {
    it('落一条 PENDING 记录，带 ownerUserId + reason', async () => {
      const { prisma, svc } = deps();
      await svc.enqueue({ storageKey: 'avatars/u1/a.png', ownerUserId: 'u1', reason: 'AVATAR_REPLACED' });
      expect(prisma.storage_cleanup_tasks.create).toHaveBeenCalledWith({
        data: {
          storageKey: 'avatars/u1/a.png',
          ownerUserId: 'u1',
          reason: 'AVATAR_REPLACED',
          storageBucket: null,
        },
      });
    });

    it('storageKey 为空时静默跳过', async () => {
      const { prisma, svc } = deps();
      await svc.enqueue({ storageKey: '', ownerUserId: 'u1', reason: 'MANUAL' });
      expect(prisma.storage_cleanup_tasks.create).not.toHaveBeenCalled();
    });
  });

  describe('claimBatch', () => {
    it('先恢复过期 lease 且不计数，再以单条 UPDATE 原子领取并 attempts+1', async () => {
      const { prisma, svc } = deps();
      prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      const ids = await svc.claimBatch(NOW, 10);

      expect(ids).toEqual(['a', 'b']);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

      const recoverySql = sqlOf(prisma.$executeRaw.mock.calls[0]);
      expect(recoverySql).toContain(`SET "status" = 'PENDING'`);
      expect(recoverySql).toContain(`"leaseExpiresAt" <= ?`);
      expect(recoverySql).not.toContain(`SET "attempts"`);

      const exhaustedSql = sqlOf(prisma.$executeRaw.mock.calls[1]);
      expect(exhaustedSql).toContain(`SET "status" = 'DEAD'`);
      expect(exhaustedSql).toContain(`"attempts" >= "maxAttempts"`);

      const claimSql = sqlOf(prisma.$queryRaw.mock.calls[0]);
      expect(claimSql).toContain(`"attempts" = "attempts" + 1`);
      expect(claimSql).toContain(`WHERE "status" = 'PENDING'`);
      expect(claimSql).toContain(`"attempts" < "maxAttempts"`);
      expect(claimSql).toContain('FOR UPDATE SKIP LOCKED');
      expect(claimSql).not.toContain(`"status" = 'PROCESSING' AND "leaseExpiresAt"`);
    });

    it('空结果时返回空数组', async () => {
      const { prisma, svc } = deps();
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(svc.claimBatch(NOW)).resolves.toEqual([]);
    });
  });

  describe('expirePendingReservations', () => {
    it('marks the reservation expired and writes cleanup outbox in one transaction', async () => {
      const { prisma, svc } = deps();
      prisma.pending_uploads.findMany.mockResolvedValueOnce([{
        id: 'upload-1',
        storageKey: 'avatars/u1/pending.png',
        ownerUserId: 'u1',
        storageBucket: null,
      }]);

      await expect(svc.expirePendingReservations(NOW)).resolves.toEqual({ expired: 1, enqueued: 1 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.pending_uploads.updateMany).toHaveBeenCalledWith({
        where: { id: 'upload-1', status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.storage_cleanup_tasks.create).toHaveBeenCalledWith({
        data: {
          storageKey: 'avatars/u1/pending.png',
          ownerUserId: 'u1',
          reason: 'PENDING_UPLOAD_EXPIRED',
          storageBucket: null,
        },
      });
    });

    it('propagates outbox failure so the database transaction can roll back EXPIRED', async () => {
      const { prisma, svc } = deps();
      prisma.pending_uploads.findMany.mockResolvedValueOnce([{
        id: 'upload-1',
        storageKey: 'avatars/u1/pending.png',
        ownerUserId: 'u1',
        storageBucket: null,
      }]);
      prisma.storage_cleanup_tasks.create.mockRejectedValueOnce(new Error('db unavailable'));

      await expect(svc.expirePendingReservations(NOW)).rejects.toThrow('db unavailable');
    });
  });

  describe('processBatch -> processOne', () => {
    it('对象存在 -> 续租、HeadObject、再次续租、DeleteObject -> COMPLETED', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc));
      r2.objectExists.mockResolvedValue(true);
      r2.deleteObject.mockResolvedValue(undefined);

      const result = await svc.processBatch(['task-1'], NOW);

      expect(r2.deleteObject).toHaveBeenCalledWith('avatars/u1/a.png');
      expect(prisma.storage_cleanup_tasks.updateMany).toHaveBeenCalledTimes(3);
      expect(updateForStatus(prisma, 'COMPLETED')).toEqual({
        where: {
          id: 'task-1',
          status: 'PROCESSING',
          lockedBy: workerIdOf(svc),
          leaseExpiresAt: { gt: NOW },
        },
        data: {
          status: 'COMPLETED',
          completedAt: NOW,
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
        },
      });
      expect(result).toEqual({ processed: 1, completed: 1, skipped: 0, retried: 0, dead: 0 });
    });

    it('对象已 404 -> 不调用 DeleteObject 也置 COMPLETED', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc));
      r2.objectExists.mockResolvedValue(false);

      const result = await svc.processBatch(['task-1'], NOW);

      expect(r2.deleteObject).not.toHaveBeenCalled();
      expect(updateForStatus(prisma, 'COMPLETED')).toBeDefined();
      expect(result.completed).toBe(1);
    });

    it('ownerUserId 与 storageKey 段不匹配 -> SKIPPED_STILL_REFERENCED，不删对象', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(
        claimedTask(svc, { storageKey: 'shared/logo.png', ownerUserId: 'attacker' }),
      );

      const result = await svc.processBatch(['task-1'], NOW);

      expect(r2.objectExists).not.toHaveBeenCalled();
      expect(r2.deleteObject).not.toHaveBeenCalled();
      expect(updateForStatus(prisma, 'SKIPPED_STILL_REFERENCED')).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ lastError: expect.stringContaining('ownerUserId mismatch') }),
        }),
      );
      expect(result.skipped).toBe(1);
    });

    it('ownerUserId 为空 -> 跳过归属校验，正常删除', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(
        claimedTask(svc, { storageKey: 'legacy/x.png', ownerUserId: null }),
      );
      r2.objectExists.mockResolvedValue(true);
      r2.deleteObject.mockResolvedValue(undefined);

      const result = await svc.processBatch(['task-1'], NOW);

      expect(r2.deleteObject).toHaveBeenCalledWith('legacy/x.png');
      expect(result.completed).toBe(1);
    });

    it('storageKey 仍被用户头像引用 -> SKIPPED_STILL_REFERENCED，不删对象', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc));
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

      const result = await svc.processBatch(['task-1'], NOW);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { avatarStorageKey: 'avatars/u1/a.png' },
        select: { id: true },
      });
      expect(r2.objectExists).not.toHaveBeenCalled();
      expect(r2.deleteObject).not.toHaveBeenCalled();
      expect(updateForStatus(prisma, 'SKIPPED_STILL_REFERENCED')).toBeDefined();
      expect(result.skipped).toBe(1);
    });

    it('非本 worker 的任务 -> skipped，不碰 R2 或状态', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc, { lockedBy: 'other-worker' }));

      const result = await svc.processBatch(['task-1'], NOW);

      expect(prisma.storage_cleanup_tasks.updateMany).not.toHaveBeenCalled();
      expect(r2.objectExists).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('lease 已过期 -> skipped，不碰 R2 或状态', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(
        claimedTask(svc, { leaseExpiresAt: new Date(NOW.getTime() - 1) }),
      );

      const result = await svc.processBatch(['task-1'], NOW);

      expect(prisma.storage_cleanup_tasks.updateMany).not.toHaveBeenCalled();
      expect(r2.objectExists).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('HeadObject 期间 lease 被其它 worker 抢走 -> 不执行 DeleteObject', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc));
      prisma.storage_cleanup_tasks.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      r2.objectExists.mockResolvedValue(true);

      const result = await svc.processBatch(['task-1'], NOW);

      expect(r2.deleteObject).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('HeadObject 抛错 -> 不重复增加 attempts，PENDING + 确定性 nextRetryAt', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc, { attempts: 2 }));
      r2.objectExists.mockRejectedValue(new Error('network flaky'));

      const result = await svc.processBatch(['task-1'], NOW);
      const retryUpdate = updateForStatus(prisma, 'PENDING');

      expect(retryUpdate.data).not.toHaveProperty('attempts');
      expect(retryUpdate).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            lastError: 'network flaky',
            nextRetryAt: new Date('2026-08-01T00:05:00.000Z'),
            lockedBy: null,
            lockedAt: null,
            leaseExpiresAt: null,
          }),
        }),
      );
      expect(result.retried).toBe(1);
    });

    it('本次 claim 后 attempts 已达到 maxAttempts -> DEAD，失败收尾不再加一', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(
        claimedTask(svc, { attempts: 6, maxAttempts: 6 }),
      );
      r2.objectExists.mockRejectedValue(new Error('permission denied'));

      const result = await svc.processBatch(['task-1'], NOW);
      const deadUpdate = updateForStatus(prisma, 'DEAD');

      expect(deadUpdate.data).not.toHaveProperty('attempts');
      expect(deadUpdate).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DEAD',
            lastError: 'permission denied',
            completedAt: NOW,
          }),
        }),
      );
      expect(result.dead).toBe(1);
    });

    it('失败收尾时 lease 已丢失 -> skipped，不覆盖新 worker 状态', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(claimedTask(svc));
      prisma.storage_cleanup_tasks.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      r2.objectExists.mockRejectedValue(new Error('network flaky'));

      const result = await svc.processBatch(['task-1'], NOW);

      expect(result.skipped).toBe(1);
      expect(result.retried).toBe(0);
    });

    it('findUnique 返回 null -> skipped，不动 R2', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique.mockResolvedValue(null);

      const result = await svc.processBatch(['missing'], NOW);

      expect(prisma.storage_cleanup_tasks.updateMany).not.toHaveBeenCalled();
      expect(r2.objectExists).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('批处理中单条失败不影响其它任务', async () => {
      const { prisma, r2, svc } = deps();
      prisma.storage_cleanup_tasks.findUnique
        .mockResolvedValueOnce(claimedTask(svc, { id: 'a' }))
        .mockResolvedValueOnce(claimedTask(svc, { id: 'b', storageKey: 'avatars/u2/b.png', ownerUserId: 'u2' }));
      r2.objectExists.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('boom'));
      r2.deleteObject.mockResolvedValue(undefined);

      const result = await svc.processBatch(['a', 'b'], NOW);

      expect(result).toEqual({ processed: 2, completed: 1, skipped: 0, retried: 1, dead: 0 });
    });
  });
});
