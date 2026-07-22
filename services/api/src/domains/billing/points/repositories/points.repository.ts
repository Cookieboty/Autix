import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import {
  PointGrantType,
  PointHoldStatus,
  Prisma,
  type user_points,
  type point_grants,
  type point_holds,
  type point_hold_items,
  type points_records,
} from '../../../platform/prisma/generated';
import {
  buildConfirmHeldBalanceMutation,
  buildConfirmHeldGrantItemData,
  buildConsumeBalanceMutation,
  buildGrantBalanceCreateData,
  buildGrantBalanceUpdateData,
} from './points.repository.helpers';

type PointHoldWithItems = Prisma.point_holdsGetPayload<{
  include: { items: true };
}>;

@Injectable()
export class PointsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async runInTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  async upsertBalance(userId: string): Promise<user_points> {
    return this.prisma.user_points.upsert({
      where: { userId },
      create: { userId, balance: 0, availableBalance: 0, totalBalance: 0 },
      update: {},
    });
  }

  async findActivePackages() {
    return this.prisma.points_packages.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  }

  async findPackageById(id: string) {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  async findActiveGrants(userId: string): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: {
        userId,
        OR: [{ availableAmount: { gt: 0 } }, { frozenAmount: { gt: 0 } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAvailableGrants(
    userId: string,
    now = new Date(),
  ): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: {
        userId,
        availableAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAvailableGrantsWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    now = new Date(),
  ): Promise<point_grants[]> {
    return tx.point_grants.findMany({
      where: {
        userId,
        availableAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async consumeGrantWithinTx(
    tx: Prisma.TransactionClient,
    input: { grantId: string; amount: number; now?: Date },
  ): Promise<number> {
    const now = input.now ?? new Date();
    const updated = await tx.point_grants.updateMany({
      // FIX-11: 仅消费未过期的 grant，避免过期边界竞态下花掉已过期积分。
      where: {
        id: input.grantId,
        availableAmount: { gte: input.amount },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        availableAmount: { decrement: input.amount },
        consumedAmount: { increment: input.amount },
      },
    });
    return updated.count;
  }

  async findExpiredGrants(now = new Date()): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
      where: { expiresAt: { lte: now }, availableAmount: { gt: 0 } },
    });
  }

  async findExpiredGrantsWithinTx(
    tx: Prisma.TransactionClient,
    now = new Date(),
  ): Promise<point_grants[]> {
    return tx.point_grants.findMany({
      where: { expiresAt: { lte: now }, availableAmount: { gt: 0 } },
    });
  }

  async findRecords(
    where: Prisma.points_recordsWhereInput,
    options?: { skip?: number; take?: number },
  ): Promise<points_records[]> {
    return this.prisma.points_records.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  async countRecords(where: Prisma.points_recordsWhereInput): Promise<number> {
    return this.prisma.points_records.count({ where });
  }

  async createGrantWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_grantsUncheckedCreateInput,
  ): Promise<point_grants> {
    return tx.point_grants.create({ data });
  }

  async upsertBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    grantType: PointGrantType,
    amount: number,
    grantTypeField: keyof Prisma.user_pointsUpdateInput,
  ): Promise<user_points> {
    return tx.user_points.upsert({
      where: { userId },
      create: buildGrantBalanceCreateData(userId, amount, grantTypeField),
      update: buildGrantBalanceUpdateData(amount, grantTypeField),
    });
  }

  async createRecordWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.points_recordsUncheckedCreateInput,
  ): Promise<points_records> {
    return tx.points_records.create({ data });
  }

  async findPendingHoldByTask(input: {
    taskType?: string;
    taskId: string;
  }): Promise<point_holds | null> {
    return this.findPendingHoldByTaskWithinTx(this.prisma, input);
  }

  // FIX-10: 查找超时仍未结算的孤儿 hold（PENDING/PROCESSING 且创建早于 cutoff）。
  async findStaleHolds(cutoff: Date, limit = 200): Promise<point_holds[]> {
    return this.prisma.point_holds.findMany({
      where: {
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async countActiveHoldsByType(userId: string, taskType: string): Promise<number> {
    return this.countActiveHoldsByTypeWithinTx(this.prisma, userId, taskType);
  }

  async countActiveHoldsByTypeWithinTx(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    taskType: string,
  ): Promise<number> {
    return client.point_holds.count({
      where: {
        userId,
        taskType,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
    });
  }

  /**
   * 事务级 advisory lock，按 userId+taskType 串行化并发闸门临界区。xact 锁随事务
   * 提交/回滚自动释放；同 key 的并发事务会阻塞到前一个提交后再读计数，因此读到的
   * 活跃 hold 数不会漏算刚提交的那些。
   */
  async acquireHoldConcurrencyLockWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    taskType: string,
  ): Promise<void> {
    const key = `hold-concurrency:${taskType}:${userId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;
  }

  // FIX-9b: 事务内查找同任务的活跃 hold（PENDING/PROCESSING），用于创建前去重，
  // 避免重试/并发重复冻结；非事务版 findPendingHoldByTask 复用此实现。
  async findPendingHoldByTaskWithinTx(
    client: Prisma.TransactionClient | PrismaService,
    input: { taskType?: string; taskId: string },
  ): Promise<point_holds | null> {
    return client.point_holds.findFirst({
      where: {
        taskId: input.taskId,
        taskType: input.taskType,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findHoldById(holdId: string): Promise<point_holds | null> {
    return this.findHoldByIdWithinTx(this.prisma, holdId);
  }

  async findHoldByIdWithinTx(
    client: Prisma.TransactionClient | PrismaService,
    holdId: string,
  ): Promise<point_holds | null> {
    return client.point_holds.findUnique({ where: { id: holdId } });
  }

  /**
   * 批量核对 hold 状态（生成任务收敛 cron 用）：只选 id/status，避免拉整行
   * （pricingSnapshot 等大字段）。空数组直接短路，不打一次没有意义的 `IN ()` 查询。
   */
  async findHoldsByIds(ids: string[]): Promise<Array<{ id: string; status: PointHoldStatus }>> {
    if (ids.length === 0) return [];
    return this.prisma.point_holds.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
  }

  /**
   * 按任务 id 批量反查 hold（生成任务收敛 cron 的回退路径）。
   *
   * 存在意义：`generation_tasks.holdId` 有两类天然为 null 的行——Task 2 回填脚本
   * 产出的行（脚本从不写 holdId），以及图片侧 `start()` 与 `createHold()` 之间崩溃
   * 的行（holdId 要到首次 `recordBilling(HELD)` 才回填）。这两类行只能靠反向指针
   * `point_holds.taskId` 找到自己的 hold；spec §4.2 的统一 ID 决策保证
   * `point_holds.taskId == generation_tasks.id` 对图片与视频两侧都成立。
   *
   * 按 createdAt 升序返回：同一 taskId 理论上只有一个 hold（createHold 对活跃 hold
   * 做幂等去重），但"退款后重试"确实可能留下多行。调用方按顺序覆盖取最后一条，
   * 即最新的 hold —— 据一个已被新 hold 取代的旧 REFUNDED 收敛，会把仍可能成功的
   * 任务错标成 EXPIRED。
   *
   * 注意 taskType 未参与过滤（该字段是动态定价类型，取值发散），因此走不到
   * `@@index([taskType, taskId])`。可接受：调用方单轮最多传 500 个 id、每 10 分钟
   * 一次。若 point_holds 增长到该扫描成为瓶颈，应补一条 taskId 单列索引。
   */
  async findHoldsByTaskIds(
    taskIds: string[],
  ): Promise<Array<{ id: string; taskId: string | null; status: PointHoldStatus }>> {
    if (taskIds.length === 0) return [];
    return this.prisma.point_holds.findMany({
      where: { taskId: { in: taskIds } },
      select: { id: true, taskId: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createHoldWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_holdsUncheckedCreateInput,
  ): Promise<point_holds> {
    return tx.point_holds.create({ data });
  }

  async freezeGrantForHoldWithinTx(
    tx: Prisma.TransactionClient,
    input: { grantId: string; amount: number; now?: Date },
  ): Promise<number> {
    const now = input.now ?? new Date();
    const updated = await tx.point_grants.updateMany({
      // FIX-11: 仅冻结未过期的 grant。
      where: {
        id: input.grantId,
        availableAmount: { gte: input.amount },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        availableAmount: { decrement: input.amount },
        frozenAmount: { increment: input.amount },
      },
    });
    return updated.count;
  }

  async createHoldItemWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.point_hold_itemsUncheckedCreateInput,
  ): Promise<point_hold_items> {
    return tx.point_hold_items.create({ data });
  }

  async moveBalanceToFrozenWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<number> {
    const updated = await tx.user_points.updateMany({
      where: {
        userId,
        balance: { gte: amount },
        availableBalance: { gte: amount },
      },
      data: {
        balance: { decrement: amount },
        availableBalance: { decrement: amount },
        frozenBalance: { increment: amount },
      },
    });
    return updated.count;
  }

  async claimHoldForProcessingWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<number> {
    const claimed = await tx.point_holds.updateMany({
      where: {
        id: holdId,
        status: { in: [PointHoldStatus.PENDING, PointHoldStatus.PROCESSING] },
      },
      data: { status: PointHoldStatus.PROCESSING },
    });
    return claimed.count;
  }

  async findHoldWithItemsWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<PointHoldWithItems | null> {
    return tx.point_holds.findUnique({
      where: { id: holdId },
      include: { items: true },
    });
  }

  async confirmHeldGrantItemWithinTx(
    tx: Prisma.TransactionClient,
    item: Pick<point_hold_items, 'grantId' | 'amount'>,
    consumeAmount: number,
    refundAmount: number,
  ): Promise<number> {
    const updated = await tx.point_grants.updateMany({
      where: { id: item.grantId, frozenAmount: { gte: item.amount } },
      data: buildConfirmHeldGrantItemData(item, consumeAmount, refundAmount),
    });
    return updated.count;
  }

  async refundHeldGrantItemWithinTx(
    tx: Prisma.TransactionClient,
    item: Pick<point_hold_items, 'grantId' | 'amount'>,
  ): Promise<number> {
    const updated = await tx.point_grants.updateMany({
      where: { id: item.grantId, frozenAmount: { gte: item.amount } },
      data: {
        frozenAmount: { decrement: item.amount },
        availableAmount: { increment: item.amount },
      },
    });
    return updated.count;
  }

  async confirmHeldBalanceWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      estimatedAmount: number;
      confirmedAmount: number;
      refundAmount: number;
      consumedByType: ReadonlyMap<PointGrantType, number>;
    },
  ): Promise<number> {
    const { where, data } = buildConfirmHeldBalanceMutation(input);
    const updated = await tx.user_points.updateMany({ where, data });
    return updated.count;
  }

  async refundHeldBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<number> {
    const updated = await tx.user_points.updateMany({
      where: { userId, frozenBalance: { gte: amount } },
      data: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        frozenBalance: { decrement: amount },
      },
    });
    return updated.count;
  }

  async updateHoldWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_holdsUncheckedUpdateInput,
  ): Promise<point_holds> {
    return tx.point_holds.update({ where: { id }, data });
  }

  async updatePendingHoldRecordWithinTx(
    tx: Prisma.TransactionClient,
    holdId: string,
    data: Prisma.points_recordsUpdateManyMutationInput,
  ): Promise<number> {
    const updated = await tx.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data,
    });
    return updated.count;
  }

  async updateGrantWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_grantsUpdateInput,
  ): Promise<point_grants> {
    return tx.point_grants.update({ where: { id }, data });
  }

  async expireGrantWithinTx(
    tx: Prisma.TransactionClient,
    grant: Pick<point_grants, 'id' | 'availableAmount'>,
  ): Promise<point_grants> {
    return tx.point_grants.update({
      where: { id: grant.id },
      data: {
        expiredAmount: { increment: grant.availableAmount },
        availableAmount: 0,
      },
    });
  }

  async consumeBalanceWithinTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: number;
      consumedByType: ReadonlyMap<PointGrantType, number>;
    },
  ): Promise<number> {
    const { where, data } = buildConsumeBalanceMutation(input);
    const updated = await tx.user_points.updateMany({ where, data });
    return updated.count;
  }

  async updateBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    data: Prisma.user_pointsUpdateInput,
  ): Promise<user_points> {
    return tx.user_points.update({ where: { userId }, data });
  }

  async findBalanceWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<user_points> {
    return tx.user_points.findUniqueOrThrow({ where: { userId } });
  }
}
