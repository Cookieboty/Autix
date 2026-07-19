import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/app-logger';
import { PrismaService } from '../prisma/prisma.service';
import { CloudflareR2Service } from './cloudflare-r2.service';
import { hostname } from 'os';
import { randomUUID } from 'crypto';

/**
 * T10（spec §3.2 A'）：R2 对象删除的持久化补偿队列。
 *
 * 设计要点：
 * - **事务后 enqueue**：调用方在自己的业务事务提交后调用 [enqueue](#) 落一条 PENDING 记录；
 *   即便 worker 崩溃或 R2 一时抽风，对象也不会永久滞留。
 * - **worker claim**：`SELECT ... FOR UPDATE SKIP LOCKED` 一次抓一批，写入 lockedBy / lockedAt /
 *   leaseExpiresAt=now+leaseSec；lease 内被 worker 独占，过期后可被其它 worker 抢占。
 * - **HeadObject 先探测**：对象已不存在（404）等价于成功，直接标 COMPLETED。
 * - **归属二次校验**：调用方入队时传入 `ownerUserId`，worker 只在 storageKey 中确实包含
 *   该 userId 段或 ownerUserId 为 null（旧数据）时执行删除；防止误删共享对象。
 * - **尝试计数**：只有 claim 代表一次真实外部删除尝试并执行 attempts+1；失败收尾不重复计数。
 * - **分级退避**：失败后按 1min / 5min / 30min / 2h / 12h 安排下一次尝试；到
 *   maxAttempts 置 DEAD，等待人工介入。
 */
@Injectable()
export class StorageCleanupService {
  private readonly logger = new AppLogger(StorageCleanupService.name);
  private readonly workerId = `${hostname()}#${process.pid}#${randomUUID().slice(0, 8)}`;
  private readonly leaseSec = 5 * 60;
  private readonly retryBackoffSec = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60];

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: CloudflareR2Service,
  ) {}

  /**
   * 事务后调用：把一条 R2 对象删除请求落队列。
   * 幂等考量：调用方需自己控制不重复 enqueue（例如同事务内先查表或按 storageKey 短窗口去重）。
   */
  async enqueue(input: {
    storageKey: string;
    ownerUserId?: string | null;
    reason:
      | 'UPLOAD_EXPIRED'
      | 'AVATAR_REPLACED'
      | 'AVATAR_CLEARED'
      | 'AVATAR_ORIGINAL_REPLACED'
      | 'USER_DELETED'
      | 'ACCOUNT_DELETED'
      | 'ADMIN_AVATAR_REPLACED'
      | 'PENDING_UPLOAD_EXPIRED'
      | 'MANUAL';
    storageBucket?: string | null;
  }): Promise<void> {
    if (!input.storageKey) return;
    await this.prisma.storage_cleanup_tasks.create({
      data: {
        storageKey: input.storageKey,
        ownerUserId: input.ownerUserId ?? null,
        reason: input.reason,
        storageBucket: input.storageBucket ?? null,
      },
    });
  }

  /**
   * 抢占一批可执行任务：先恢复 lease 过期的 PROCESSING，再领取可执行 PENDING。
   * 恢复不增加 attempts；真正领取时在同一条 UPDATE 中 attempts+1。
   * 返回被本 worker 独占的任务 id 列表。
   */
  async claimBatch(now: Date, batchSize = 20): Promise<string[]> {
    const lease = new Date(now.getTime() + this.leaseSec * 1000);

    await this.prisma.$executeRaw`
      UPDATE "storage_cleanup_tasks"
      SET "status" = 'PENDING',
          "lockedBy" = NULL,
          "lockedAt" = NULL,
          "leaseExpiresAt" = NULL
      WHERE "status" = 'PROCESSING'
        AND "leaseExpiresAt" <= ${now}
    `;

    // 上次已经领取最后一次尝试后崩溃的任务不能永远滞留在 PENDING。
    await this.prisma.$executeRaw`
      UPDATE "storage_cleanup_tasks"
      SET "status" = 'DEAD',
          "completedAt" = ${now},
          "lastError" = COALESCE("lastError", 'worker lease expired after final attempt')
      WHERE "status" = 'PENDING'
        AND "attempts" >= "maxAttempts"
    `;

    // 状态、lease 和尝试计数属于同一个原子 claim。
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "storage_cleanup_tasks"
      SET "status" = 'PROCESSING',
          "attempts" = "attempts" + 1,
          "lockedBy" = ${this.workerId},
          "lockedAt" = ${now},
          "leaseExpiresAt" = ${lease}
      WHERE "id" IN (
        SELECT "id"
        FROM "storage_cleanup_tasks"
        WHERE "status" = 'PENDING'
          AND "nextRetryAt" <= ${now}
          AND "attempts" < "maxAttempts"
        ORDER BY "nextRetryAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"
    `;
    return rows.map((r) => r.id);
  }

  /**
   * 处理已抢占的一批任务：HeadObject → DeleteObject（归属校验通过）；异常按重试/DEAD 收敛。
   * 每条独立错误捕获，单条失败不影响其它。
   */
  async processBatch(ids: string[], now?: Date): Promise<{
    processed: number;
    completed: number;
    skipped: number;
    retried: number;
    dead: number;
  }> {
    let completed = 0;
    let skipped = 0;
    let retried = 0;
    let dead = 0;
    const clock = now ? () => now : () => new Date();
    for (const id of ids) {
      const outcome = await this.processOne(id, clock).catch((err) => {
        this.logger.error(`storage cleanup task ${id} unexpected crash`, err as Error);
        return 'retried' as const;
      });
      if (outcome === 'completed') completed += 1;
      else if (outcome === 'skipped') skipped += 1;
      else if (outcome === 'dead') dead += 1;
      else retried += 1;
    }
    return { processed: ids.length, completed, skipped, retried, dead };
  }

  /**
   * 单条任务：探测 → 归属校验 → 删除 → 状态收敛。
   * 返回四种终态之一：completed / skipped / retried / dead。
   */
  private async processOne(
    id: string,
    clock: () => Date,
  ): Promise<'completed' | 'skipped' | 'retried' | 'dead'> {
    const startedAt = clock();
    const task = await this.prisma.storage_cleanup_tasks.findUnique({ where: { id } });
    if (
      !task ||
      task.status !== 'PROCESSING' ||
      task.lockedBy !== this.workerId ||
      !task.leaseExpiresAt ||
      task.leaseExpiresAt.getTime() <= startedAt.getTime()
    ) {
      return 'skipped';
    }

    // 外部存储操作前续租并原子确认所有权；旧 worker 的 lockedBy 已被替换时 count=0。
    if (!(await this.renewLease(id, startedAt))) return 'skipped';

    // 归属二次校验：ownerUserId 存在时 key 必须以 <ownerUserId> 出现在路径段内；否则视为可疑数据
    if (task.ownerUserId && !this.keyBelongsToOwner(task.storageKey, task.ownerUserId)) {
      this.logger.warn(
        `storage cleanup task ${id} skipped: key "${task.storageKey}" does not belong to owner "${task.ownerUserId}"`,
      );
      const completedAt = clock();
      await this.prisma.storage_cleanup_tasks.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          lockedBy: this.workerId,
          leaseExpiresAt: { gt: completedAt },
        },
        data: {
          status: 'SKIPPED_STILL_REFERENCED',
          completedAt,
          lastError: 'ownerUserId mismatch: key does not embed owner segment',
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
        },
      });
      return 'skipped';
    }

    const referencedByUser = await this.prisma.user.findFirst({
      where: { avatarStorageKey: task.storageKey },
      select: { id: true },
    });
    if (referencedByUser) {
      const completedAt = clock();
      await this.prisma.storage_cleanup_tasks.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          lockedBy: this.workerId,
          leaseExpiresAt: { gt: completedAt },
        },
        data: {
          status: 'SKIPPED_STILL_REFERENCED',
          completedAt,
          lastError: `storage key is still referenced by user ${referencedByUser.id}`,
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
        },
      });
      return 'skipped';
    }

    try {
      const exists = await this.r2.objectExists(task.storageKey);
      if (exists) {
        // HeadObject 期间 lease 可能已被其它 worker 回收；DeleteObject 前必须再次确认。
        if (!(await this.renewLease(id, clock()))) return 'skipped';
        await this.r2.deleteObject(task.storageKey);
      }
      const completedAt = clock();
      const settled = await this.prisma.storage_cleanup_tasks.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          lockedBy: this.workerId,
          leaseExpiresAt: { gt: completedAt },
        },
        data: {
          status: 'COMPLETED',
          completedAt,
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
        },
      });
      return settled.count === 1 ? 'completed' : 'skipped';
    } catch (err) {
      return this.recordFailure(task.id, task.attempts, task.maxAttempts, err as Error, clock());
    }
  }

  private async renewLease(id: string, now: Date): Promise<boolean> {
    const leaseExpiresAt = new Date(now.getTime() + this.leaseSec * 1000);
    const renewed = await this.prisma.storage_cleanup_tasks.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        lockedBy: this.workerId,
        leaseExpiresAt: { gt: now },
      },
      data: { leaseExpiresAt },
    });
    return renewed.count === 1;
  }

  /** attempts 已由 claim 增加；未到顶 → PENDING + nextRetryAt；到顶 → DEAD。 */
  private async recordFailure(
    id: string,
    attempts: number,
    maxAttempts: number,
    err: Error,
    now: Date,
  ): Promise<'retried' | 'dead' | 'skipped'> {
    if (attempts >= maxAttempts) {
      const settled = await this.prisma.storage_cleanup_tasks.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          lockedBy: this.workerId,
          leaseExpiresAt: { gt: now },
        },
        data: {
          status: 'DEAD',
          lastError: err.message?.slice(0, 500) ?? String(err).slice(0, 500),
          completedAt: now,
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
        },
      });
      if (settled.count === 0) return 'skipped';
      this.logger.error(`storage cleanup task ${id} DEAD after ${attempts} attempts`, err);
      return 'dead';
    }
    const backoffIndex = Math.min(Math.max(attempts - 1, 0), this.retryBackoffSec.length - 1);
    const backoff = this.retryBackoffSec[backoffIndex];
    const nextRetryAt = new Date(now.getTime() + backoff * 1000);
    const settled = await this.prisma.storage_cleanup_tasks.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        lockedBy: this.workerId,
        leaseExpiresAt: { gt: now },
      },
      data: {
        status: 'PENDING',
        lastError: err.message?.slice(0, 500) ?? String(err).slice(0, 500),
        nextRetryAt,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
      },
    });
    return settled.count === 1 ? 'retried' : 'skipped';
  }

  /**
   * key 中必须以路径段形式包含 ownerUserId，避免子串误匹配（例如 "abc" 匹配 "abcd"）。
   * 允许形如 `foo/<userId>/xxx`, `foo/<userId>-xxx`, `<userId>/xxx`。
   */
  private keyBelongsToOwner(key: string, ownerUserId: string): boolean {
    if (!ownerUserId) return false;
    const segments = key.split(/[/_.-]/);
    return segments.includes(ownerUserId);
  }

  /**
   * T16: 扫描过期未消费的 pending_uploads reservation。
   *
   * 单轮 batch：
   * 1. 找 status=PENDING AND expiresAt<now 的 reservation（限 batchSize）
   * 2. 逐条：UPDATE 置 status=EXPIRED（避免下轮重复处理） + enqueue cleanup task(reason=PENDING_UPLOAD_EXPIRED)
   * 3. 实际 R2 对象删除由 cleanup worker 走 processBatch 完成，与其它 cleanup 路径统一
   *
   * 幂等：单条 UPDATE 用 optimistic-lock（WHERE status='PENDING'），并发多 worker 只有一个能成功
   * 状态转换后，其它 worker 的 count=0 直接跳过。
   */
  async expirePendingReservations(now: Date, batchSize = 50): Promise<{ expired: number; enqueued: number }> {
    const rows = await this.prisma.pending_uploads.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      take: batchSize,
      select: { id: true, storageKey: true, ownerUserId: true, storageBucket: true },
    });
    if (rows.length === 0) return { expired: 0, enqueued: 0 };

    let expired = 0;
    let enqueued = 0;
    for (const row of rows) {
      const committed = await this.prisma.$transaction(async (tx) => {
        // 状态转换和 outbox 必须原子提交；create 失败会回滚为 PENDING，下一轮继续扫描。
        const claimed = await tx.pending_uploads.updateMany({
          where: { id: row.id, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        if (claimed.count === 0) return false;
        await tx.storage_cleanup_tasks.create({
          data: {
            storageKey: row.storageKey,
            ownerUserId: row.ownerUserId,
            reason: 'PENDING_UPLOAD_EXPIRED',
            storageBucket: row.storageBucket,
          },
        });
        return true;
      });
      if (!committed) continue;
      expired += 1;
      enqueued += 1;
    }
    return { expired, enqueued };
  }
}
