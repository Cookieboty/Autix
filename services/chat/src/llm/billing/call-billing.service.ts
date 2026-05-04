import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export class InsufficientPointsError extends BadRequestException {
  constructor(required: number, available: number) {
    super(`积分余额不足：需要 ${required}，当前 ${available}`);
  }
}

@Injectable()
export class CallBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async hold(
    userId: string,
    points: number,
    meta: { runId?: string; runStepId?: string; modelConfigId?: string; modelName?: string },
  ): Promise<{ holdId: string; balance: number }> {
    const holdId = uuidv4();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user_points.findUnique({ where: { userId } });
      const available = current?.balance ?? 0;

      if (available < points) {
        throw new InsufficientPointsError(points, available);
      }

      const updated = await tx.user_points.update({
        where: { userId },
        data: { balance: { decrement: points } },
      });

      await tx.points_records.create({
        data: {
          userId,
          type: 'CONSUME',
          amount: points,
          source: 'AGENT_CALL',
          sourceId: meta.runStepId ?? meta.runId,
          balance: updated.balance,
          status: 'PENDING',
          holdId,
          remark: `AI 对话（${meta.modelName ?? 'AI 模型'}）`,
        },
      });

      return { holdId, balance: updated.balance };
    });
  }

  async confirm(holdId: string): Promise<void> {
    await this.prisma.points_records.updateMany({
      where: { holdId, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    });
  }

  async refund(holdId: string): Promise<void> {
    const records = await this.prisma.points_records.findMany({
      where: { holdId, status: 'PENDING' },
    });

    if (records.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        await tx.user_points.update({
          where: { userId: record.userId },
          data: { balance: { increment: record.amount } },
        });

        await tx.points_records.update({
          where: { id: record.id },
          data: { status: 'REFUNDED' },
        });
      }
    });
  }

  async refundAllPending(runId: string): Promise<void> {
    const records = await this.prisma.points_records.findMany({
      where: { sourceId: runId, status: 'PENDING', source: 'AGENT_CALL' },
    });

    if (records.length === 0) return;

    const holdIds = [...new Set(records.map((r) => r.holdId).filter(Boolean))] as string[];
    for (const holdId of holdIds) {
      await this.refund(holdId);
    }
  }
}
