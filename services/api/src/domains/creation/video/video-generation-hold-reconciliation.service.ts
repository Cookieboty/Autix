import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PointHoldStatus,
  VideoGenStatus,
  type Prisma,
} from '../../platform/prisma/generated';
import { PointsService } from '../../billing/points/points.service';
import { InviteService } from '../../billing/invite/invite.service';

@Injectable()
export class VideoGenerationHoldReconciliationService {
  private readonly logger = new Logger(
    VideoGenerationHoldReconciliationService.name,
  );

  constructor(
    private readonly pointsService: PointsService,
    private readonly inviteService: InviteService,
  ) {}

  async confirmGenerationHoldWithinTx(
    tx: Prisma.TransactionClient,
    generationId: string,
  ): Promise<{ userId: string }> {
    const hold = await this.findLatestHoldWithinTx(tx, generationId);
    if (!hold) {
      throw new BadRequestException('视频生成缺少积分冻结记录，不能完成资产入库');
    }
    if (hold.status === PointHoldStatus.REFUNDED) {
      throw new BadRequestException('视频生成冻结已退款，不能完成资产入库');
    }
    if (
      hold.status === PointHoldStatus.CONFIRMED ||
      hold.status === PointHoldStatus.PARTIALLY_REFUNDED
    ) {
      return { userId: hold.userId };
    }

    const result = await this.pointsService.confirmHoldWithinTx(tx, hold.id);
    if (
      !result.confirmed &&
      result.hold.status === PointHoldStatus.REFUNDED
    ) {
      throw new BadRequestException('视频生成冻结已退款，不能完成资产入库');
    }
    this.logger.log(
      `point hold confirmed: generation=${generationId} hold=${hold.id}`,
    );
    return { userId: result.hold.userId };
  }

  async refundGenerationHoldWithinTx(
    tx: Prisma.TransactionClient,
    generationId: string,
    reason: string,
  ) {
    const hold = await this.findLatestHoldWithinTx(tx, generationId);
    if (!hold) {
      this.logger.warn(
        `points refund skipped (no hold): generation=${generationId}`,
      );
      return null;
    }
    if (hold.status === PointHoldStatus.REFUNDED) {
      return { refunded: false, amount: 0, hold };
    }
    if (
      hold.status === PointHoldStatus.CONFIRMED ||
      hold.status === PointHoldStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException('视频生成积分已确认，不能按失败退款');
    }

    const result = await this.pointsService.refundHoldWithinTx(
      tx,
      hold.id,
      reason,
    );
    this.logger.log(
      `point hold refunded: generation=${generationId} hold=${hold.id} amount=${result.amount} balance=${result.balance} reason=${reason}`,
    );
    return result;
  }

  async reconcileTerminalHold(generation: {
    id: string;
    status: VideoGenStatus;
  }) {
    const hold = await this.pointsService.findPendingHoldByTask({
      taskId: generation.id,
    });
    if (!hold) return;
    if (generation.status === VideoGenStatus.completed) {
      const userId = await this.confirmPendingHold(generation.id);
      if (userId) this.settleVideoInvitation(userId);
      return;
    }
    if (
      generation.status === VideoGenStatus.failed ||
      generation.status === VideoGenStatus.expired
    ) {
      await this.refundPendingHold(
        generation.id,
        `终态对账: ${generation.status}`,
      );
    }
  }

  async safeRefund(generationId: string, reason: string) {
    try {
      await this.refundPendingHold(generationId, reason);
    } catch (err) {
      this.logger.error(
        `points refund failed: generation=${generationId} reason=${String(
          err instanceof Error ? err.message : err,
        )}`,
      );
    }
  }

  settleVideoInvitation(userId: string) {
    this.inviteService
      .settleInvitationOnFirstGeneration(userId)
      .catch((err) =>
        this.logger.warn(
          `settleInvitationOnFirstGeneration (video) failed: user=${userId} reason=${(err as Error).message}`,
        ),
      );
  }

  private async findLatestHoldWithinTx(
    tx: Prisma.TransactionClient,
    generationId: string,
  ) {
    return tx.point_holds.findFirst({
      where: { taskId: generationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async confirmPendingHold(
    generationId: string,
  ): Promise<string | null> {
    const hold = await this.pointsService.findPendingHoldByTask({
      taskId: generationId,
    });
    if (!hold) {
      this.logger.warn(
        `point hold confirm skipped (no pending hold): generation=${generationId}`,
      );
      return null;
    }
    const result = await this.pointsService.confirmHold(hold.id);
    if (
      !result.confirmed &&
      result.hold.status === PointHoldStatus.REFUNDED
    ) {
      throw new BadRequestException('视频生成冻结已退款，不能完成资产入库');
    }
    this.logger.log(
      `point hold confirmed: generation=${generationId} hold=${hold.id}`,
    );
    return result.hold.userId ?? hold.userId;
  }

  private async refundPendingHold(generationId: string, reason: string) {
    const hold = await this.pointsService.findPendingHoldByTask({
      taskId: generationId,
    });
    if (!hold) {
      this.logger.warn(
        `points refund skipped (no pending hold): generation=${generationId}`,
      );
      return null;
    }
    const result = await this.pointsService.refundHold(hold.id, reason);
    this.logger.log(
      `point hold refunded: generation=${generationId} hold=${hold.id} amount=${result.amount} balance=${result.balance} reason=${reason}`,
    );
    return result;
  }
}
