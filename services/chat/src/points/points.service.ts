import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsSource } from '../prisma/generated';

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user_points.findUnique({ where: { userId } });
      if (!current || current.balance < amount) {
        throw new BadRequestException('积分余额不足');
      }

      const points = await tx.user_points.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

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
    });
  }
}
