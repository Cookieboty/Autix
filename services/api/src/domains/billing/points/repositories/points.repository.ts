import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma/prisma.service';
import {
  PointGrantType,
  Prisma,
  type user_points,
  type point_grants,
  type points_records,
} from '../../../platform/prisma/generated';

@Injectable()
export class PointsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertBalance(userId: string): Promise<user_points> {
    return this.prisma.user_points.upsert({
      where: { userId },
      create: { userId, balance: 0, availableBalance: 0, totalBalance: 0 },
      update: {},
    });
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

  async findExpiredGrants(now = new Date()): Promise<point_grants[]> {
    return this.prisma.point_grants.findMany({
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
      create: {
        userId,
        balance: amount,
        availableBalance: amount,
        totalBalance: amount,
        [grantTypeField]: amount,
      },
      update: {
        balance: { increment: amount },
        availableBalance: { increment: amount },
        totalBalance: { increment: amount },
        [grantTypeField]: { increment: amount },
      },
    });
  }

  async createRecordWithinTx(
    tx: Prisma.TransactionClient,
    data: Prisma.points_recordsUncheckedCreateInput,
  ): Promise<points_records> {
    return tx.points_records.create({ data });
  }

  async updateGrantWithinTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.point_grantsUpdateInput,
  ): Promise<point_grants> {
    return tx.point_grants.update({ where: { id }, data });
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
