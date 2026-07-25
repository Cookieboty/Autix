import { BadRequestException } from '@nestjs/common';
import {
  PointHoldStatus,
  VideoGenStatus,
} from '../../platform/prisma/generated';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';

function makeService(
  options: {
    latestHold?: Record<string, unknown> | null;
    pendingHold?: Record<string, unknown> | null;
  } = {},
) {
  const latestHold =
    options.latestHold === undefined
      ? {
          id: 'hold-1',
          userId: 'user-1',
          status: PointHoldStatus.PENDING,
        }
      : options.latestHold;
  const pendingHold =
    options.pendingHold === undefined
      ? {
          id: 'hold-1',
          userId: 'user-1',
          status: PointHoldStatus.PENDING,
        }
      : options.pendingHold;

  const tx = {
    point_holds: {
      findFirst: vi.fn(async () => latestHold),
    },
  };
  const pointsService = {
    findPendingHoldByTask: vi.fn(async () => pendingHold),
    confirmHold: vi.fn(async () => ({
      confirmed: true,
      hold: {
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.CONFIRMED,
      },
      balance: 3000,
    })),
    confirmHoldWithinTx: vi.fn(async () => ({
      confirmed: true,
      hold: {
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.CONFIRMED,
      },
      balance: 3000,
    })),
    refundHold: vi.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 4600,
    })),
    refundHoldWithinTx: vi.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 4600,
    })),
  };
  const service = new VideoGenerationHoldReconciliationService(
    pointsService as never,
  );

  return { service, tx, pointsService };
}

describe('VideoGenerationHoldReconciliationService', () => {
  it('confirms the latest hold inside the existing transaction', async () => {
    const { service, tx, pointsService } = makeService();

    await expect(
      service.confirmGenerationHoldWithinTx(tx as never, 'gen-1'),
    ).resolves.toEqual({ userId: 'user-1' });

    expect(tx.point_holds.findFirst).toHaveBeenCalledWith({
      where: { taskId: 'gen-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(pointsService.confirmHoldWithinTx).toHaveBeenCalledWith(
      tx,
      'hold-1',
    );
  });

  it('refuses to complete a generation whose hold was already refunded', async () => {
    const { service, tx, pointsService } = makeService({
      latestHold: {
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.REFUNDED,
      },
    });

    await expect(
      service.confirmGenerationHoldWithinTx(tx as never, 'gen-1'),
    ).rejects.toThrow(BadRequestException);
    expect(pointsService.confirmHoldWithinTx).not.toHaveBeenCalled();
  });

  it('refunds failed terminal generations during reconciliation', async () => {
    const { service, pointsService } = makeService();

    await service.reconcileTerminalHold({
      id: 'gen-1',
      status: VideoGenStatus.failed,
    });

    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      'Terminal reconciliation: failed',
    );
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
  });

  it('confirms completed terminal generations', async () => {
    const { service, pointsService } = makeService();

    await service.reconcileTerminalHold({
      id: 'gen-1',
      status: VideoGenStatus.completed,
    });

    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1');
  });
});
