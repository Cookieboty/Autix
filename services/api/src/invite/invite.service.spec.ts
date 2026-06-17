import { InviteService } from './invite.service';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../prisma/generated';

function makeService(overrides?: {
  record?: {
    inviterUserId: string;
    inviteeUserId: string;
    inviteCodeId: string;
    rewardPoints: number;
    rewarded: boolean;
  } | null;
  claimedCount?: number;
}) {
  const claimedCount = overrides?.claimedCount ?? 1;

  const tx = {
    invite_records: {
      updateMany: jest.fn(async () => ({ count: claimedCount })),
    },
  };

  const prisma = {
    invite_records: {
      findUnique: jest.fn(async () => overrides?.record ?? null),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };

  const pointsService = {
    grantPointsWithinTx: jest.fn<
      Promise<{ batchId: string }>,
      [unknown, string, Record<string, unknown>]
    >(async () => ({ batchId: 'batch-1' })),
  };

  const service = new InviteService(prisma as never, pointsService as never);
  return { service, prisma, pointsService, tx };
}

describe('InviteService.settleInvitationOnFirstGeneration', () => {
  it('returns null without side effects when no invite record exists', async () => {
    const { service, pointsService } = makeService({ record: null });

    const result = await service.settleInvitationOnFirstGeneration('user-1');

    expect(result).toBeNull();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('returns null without side effects when invite already rewarded', async () => {
    const { service, prisma, pointsService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: true,
      },
    });

    const result = await service.settleInvitationOnFirstGeneration('user-1');

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('grants GIFT points with usageScope excluding seedance_* on first settle', async () => {
    const { service, pointsService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
    });

    const result = await service.settleInvitationOnFirstGeneration('user-1');

    expect(result).not.toBeNull();
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledTimes(1);
    const [, userIdArg, payload] =
      pointsService.grantPointsWithinTx.mock.calls[0];
    expect(userIdArg).toBe('inviter-1');
    expect(payload).toEqual(
      expect.objectContaining({
        amount: 100,
        grantType: PointGrantType.GIFT,
        sourceEvent: PointLedgerEventType.campaign_bonus,
        source: PointsSource.INVITATION,
        sourceId: 'code-1',
        usageScope: { excludedTaskPrefixes: ['seedance_'] },
      }),
    );
  });

  it('is idempotent when updateMany claims 0 rows (concurrent settle)', async () => {
    const { service, pointsService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
      claimedCount: 0,
    });

    const result = await service.settleInvitationOnFirstGeneration('user-1');

    expect(result).not.toBeNull();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });
});

describe('InviteService.recordInvitation', () => {
  it('P3-1: rejects self-invitation (inviteeUserId === code.userId)', async () => {
    const prisma = {
      invite_codes: {
        findUnique: jest.fn(async () => ({ id: 'code-1', code: 'ABCD1234', userId: 'user-1' })),
      },
      invite_records: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as any;
    const pointsService = { grantPointsWithinTx: jest.fn() } as any;
    const service = new InviteService(prisma, pointsService);

    await expect(
      service.recordInvitation('ABCD1234', 'user-1'),
    ).rejects.toThrow('不能邀请自己');
    expect(prisma.invite_records.create).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });
});
