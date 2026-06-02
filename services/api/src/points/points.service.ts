import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsSource, Prisma } from '../prisma/generated';

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) { }

  async getBalance(userId: string) {
    return this.prisma.user_points.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    });
  }

  async getRecords(
    userId: string,
    query: { page?: number; pageSize?: number; source?: PointsSource },
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (query.source) where.source = query.source;

    const [items, total] = await Promise.all([
      this.prisma.points_records.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.points_records.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }

  async getPackages() {
    return this.prisma.points_packages.findMany({
      where: { isActive: true },
      orderBy: { sort: 'asc' },
    });
  }

  async getTaskCosts() {
    return this.prisma.task_point_costs.findMany({
      where: { isActive: true },
    });
  }

  async getPackageById(id: string) {
    return this.prisma.points_packages.findUnique({ where: { id } });
  }

  async addPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const points = await tx.user_points.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      });

      await tx.points_records.create({
        data: {
          userId,
          type: 'EARN',
          amount,
          source,
          sourceId,
          balance: points.balance,
          remark,
        },
      });

      return points.balance;
    });
  }

  async deductPoints(
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    return this.prisma.$transaction((tx) =>
      this.deductWithinTx(tx, userId, amount, source, sourceId, remark),
    );
  }

  /**
   * 原子扣减（必须在调用方的事务内执行，以便与其它写操作同生共死）。
   * 用带 `balance >= amount` 守卫的条件 update 表达并发安全：单条 UPDATE 持行锁并复检余额，
   * 杜绝 read→check→update 的竞态超扣。受影响行数为 0 即余额不足。
   */
  async deductWithinTx(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    source: PointsSource,
    sourceId?: string,
    remark?: string,
  ): Promise<number> {
    const res = await tx.user_points.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (res.count === 0) {
      throw new BadRequestException('积分余额不足');
    }

    const points = await tx.user_points.findUniqueOrThrow({ where: { userId } });

    await tx.points_records.create({
      data: {
        userId,
        type: 'CONSUME',
        amount,
        source,
        sourceId,
        balance: points.balance,
        remark,
      },
    });

    return points.balance;
  }

  /**
   * Plan-3: 按 sourceId（generation.id）反查最近一笔 CONSUME 流水，写一条对冲 EARN 实现"退款"。
   * 幂等：若已存在 sourceId 相同且 remark 以 'refund:' 开头的 EARN 记录，则跳过。
   * 不存在原 CONSUME 流水（如历史 generation 未走预扣路径）→ 直接 return null，由调用方记录 warn。
   */
  async refundByGenerationId(
    generationId: string,
    reason: string,
  ): Promise<{ refunded: boolean; amount: number; balance: number | null }> {
    return this.prisma.$transaction(async (tx) => {
      const consume = await tx.points_records.findFirst({
        where: {
          sourceId: generationId,
          type: 'CONSUME',
          source: PointsSource.TASK,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!consume) {
        return { refunded: false, amount: 0, balance: null };
      }

      const existingRefund = await tx.points_records.findFirst({
        where: {
          sourceId: generationId,
          type: 'EARN',
          source: PointsSource.TASK,
          remark: { startsWith: 'refund:' },
        },
      });
      if (existingRefund) {
        return { refunded: false, amount: 0, balance: null };
      }

      const points = await tx.user_points.upsert({
        where: { userId: consume.userId },
        create: { userId: consume.userId, balance: consume.amount },
        update: { balance: { increment: consume.amount } },
      });

      await tx.points_records.create({
        data: {
          userId: consume.userId,
          type: 'EARN',
          amount: consume.amount,
          source: PointsSource.TASK,
          sourceId: generationId,
          balance: points.balance,
          remark: `refund: ${reason}`,
        },
      });

      return { refunded: true, amount: consume.amount, balance: points.balance };
    });
  }
}
