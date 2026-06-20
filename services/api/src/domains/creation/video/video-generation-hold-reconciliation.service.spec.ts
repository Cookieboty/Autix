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
      findFirst: jest.fn(async () => latestHold),
    },
  };
  const pointsService = {
    findPendingHoldByTask: jest.fn(async () => pendingHold),
    confirmHold: jest.fn(async () => ({
      confirmed: true,
      hold: {
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.CONFIRMED,
      },
      balance: 3000,
    })),
    confirmHoldWithinTx: jest.fn(async () => ({
      confirmed: true,
      hold: {
        id: 'hold-1',
        userId: 'user-1',
        status: PointHoldStatus.CONFIRMED,
      },
      balance: 3000,
    })),
    refundHold: jest.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 4600,
    })),
    refundHoldWithinTx: jest.fn(async () => ({
      refunded: true,
      amount: 1600,
      balance: 4600,
    })),
  };
  const inviteService = {
    settleInvitationOnFirstGeneration: jest.fn(async () => null),
  };
  const service = new VideoGenerationHoldReconciliationService(
    pointsService as never,
    inviteService as never,
  );

  return { service, tx, pointsService, inviteService };
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
    const { service, pointsService, inviteService } = makeService();

    await service.reconcileTerminalHold({
      id: 'gen-1',
      status: VideoGenStatus.failed,
    });

    expect(pointsService.refundHold).toHaveBeenCalledWith(
      'hold-1',
      '终态对账: failed',
    );
    expect(pointsService.confirmHold).not.toHaveBeenCalled();
    expect(
      inviteService.settleInvitationOnFirstGeneration,
    ).not.toHaveBeenCalled();
  });

  it('confirms completed terminal generations and settles invitation rewards', async () => {
    const { service, pointsService, inviteService } = makeService();

    await service.reconcileTerminalHold({
      id: 'gen-1',
      status: VideoGenStatus.completed,
    });

    expect(pointsService.confirmHold).toHaveBeenCalledWith('hold-1');
    expect(inviteService.settleInvitationOnFirstGeneration).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
