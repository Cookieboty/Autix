import { InviteService } from './invite.service';
import { InviteRepository } from './invite.repository';
import {
  PointGrantType,
  PointLedgerEventType,
  PointsSource,
} from '../../platform/prisma/generated';

function makeService(overrides?: {
  record?: {
    inviterUserId: string;
    inviteeUserId: string;
    inviteCodeId: string;
    rewardPoints: number;
    rewarded: boolean;
  } | null;
  claimedCount?: number;
  inviteSharingEnabled?: boolean;
}) {
  const claimedCount = overrides?.claimedCount ?? 1;
  const inviteSharingEnabled = overrides?.inviteSharingEnabled ?? true;

  const tx = {
    invite_records: {
      updateMany: jest.fn(async () => ({ count: claimedCount })),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'record-1',
        ...args.data,
      })),
    },
  };

  const prisma = {
    invite_records: {
      findUnique: jest.fn(async () => overrides?.record ?? null),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'record-1',
        ...args.data,
      })),
    },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };

  const pointsService = {
    grantPointsWithinTx: jest.fn<
      Promise<{ batchId: string }>,
      [unknown, string, Record<string, unknown>]
    >(async () => ({ batchId: 'batch-1' })),
  };
  const systemSettingsService = {
    getBoolean: jest.fn(async () => inviteSharingEnabled),
  };

  const service = new InviteService(
    new InviteRepository(prisma as never),
    pointsService as never,
    systemSettingsService as never,
  );
  return { service, prisma, pointsService, systemSettingsService, tx };
}

describe('InviteService.settlePendingInvitationReward', () => {
  it('returns null without side effects when no invite record exists', async () => {
    const { service, pointsService } = makeService({ record: null });

    const result = await service.settlePendingInvitationReward('user-1');

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

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('grants GIFT points with usageScope excluding video_generation when backfilling a pending reward', async () => {
    const { service, pointsService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
    });

    const result = await service.settlePendingInvitationReward('user-1');

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
        sourceId: 'user-1',
        usageScope: { excludedTaskTypes: ['video_generation'] },
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

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).not.toBeNull();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('returns null without side effects when invite sharing is disabled', async () => {
    const { service, prisma, pointsService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
      inviteSharingEnabled: false,
    });

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).toBeNull();
    expect(prisma.invite_records.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });
});

describe('InviteService.recordInvitation', () => {
  it('records the invitation and grants 100 points after registration succeeds', async () => {
    const tx = {
      invite_records: {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'record-1',
          ...args.data,
        })),
      },
    };
    const prisma = {
      invite_codes: {
        findUnique: jest.fn(async () => ({ id: 'code-1', code: 'ABCD1234', userId: 'inviter-1' })),
      },
      invite_records: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any;
    const pointsService = {
      grantPointsWithinTx: jest.fn(async () => ({ batchId: 'batch-1' })),
    } as any;
    const systemSettingsService = { getBoolean: jest.fn(async () => true) } as any;
    const service = new InviteService(
      new InviteRepository(prisma),
      pointsService,
      systemSettingsService,
    );

    const result = await service.recordInvitation('ABCD1234', 'invitee-1');

    expect(result).toEqual(
      expect.objectContaining({
        inviteCodeId: 'code-1',
        inviterUserId: 'inviter-1',
        inviteeUserId: 'invitee-1',
        rewardPoints: 100,
        rewarded: true,
      }),
    );
    expect(tx.invite_records.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rewardPoints: 100,
        rewarded: true,
      }),
    });
    expect(pointsService.grantPointsWithinTx).toHaveBeenCalledWith(
      tx,
      'inviter-1',
      expect.objectContaining({
        amount: 100,
        grantType: PointGrantType.GIFT,
        sourceEvent: PointLedgerEventType.campaign_bonus,
        source: PointsSource.INVITATION,
        sourceId: 'invitee-1',
        usageScope: { excludedTaskTypes: ['video_generation'] },
      }),
    );
  });

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
    const systemSettingsService = { getBoolean: jest.fn(async () => true) } as any;
    const service = new InviteService(
      new InviteRepository(prisma),
      pointsService,
      systemSettingsService,
    );

    await expect(
      service.recordInvitation('ABCD1234', 'user-1'),
    ).rejects.toThrow('不能邀请自己');
    expect(prisma.invite_records.create).not.toHaveBeenCalled();
    expect(pointsService.grantPointsWithinTx).not.toHaveBeenCalled();
  });

  it('does not record invitations when invite sharing is disabled', async () => {
    const prisma = {
      invite_codes: {
        findUnique: jest.fn(),
      },
      invite_records: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as any;
    const pointsService = { grantPointsWithinTx: jest.fn() } as any;
    const systemSettingsService = { getBoolean: jest.fn(async () => false) } as any;
    const service = new InviteService(
      new InviteRepository(prisma),
      pointsService,
      systemSettingsService,
    );

    const result = await service.recordInvitation('ABCD1234', 'user-1');

    expect(result).toBeNull();
    expect(prisma.invite_codes.findUnique).not.toHaveBeenCalled();
    expect(prisma.invite_records.create).not.toHaveBeenCalled();
  });
});
