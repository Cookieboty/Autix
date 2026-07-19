import { InviteService } from './invite.service';
import { InviteRepository } from './invite.repository';
import { PointsSource } from '../../platform/prisma/generated';

function makeService(overrides?: {
  inviteCode?: { id: string; code: string; userId: string } | null;
  existingRecord?: Record<string, unknown> | null;
  record?: {
    id?: string;
    inviterUserId: string;
    inviteeUserId: string;
    inviteCodeId: string;
    rewardPoints: number;
    rewarded: boolean;
  } | null;
  claimedCount?: number;
  rewardedCount?: number;
  inviteSharingEnabled?: boolean;
  campaign?: Record<string, unknown> | null;
}) {
  const claimedCount = overrides?.claimedCount ?? 1;
  const rewardedCount = overrides?.rewardedCount ?? 0;
  const inviteSharingEnabled = overrides?.inviteSharingEnabled ?? true;
  const campaign = overrides?.campaign === undefined
    ? {
        id: 'campaign-1',
        code: 'INVITATION_REWARD',
        status: 'ACTIVE',
        startsAt: null,
        endsAt: null,
        rewardPointsExpression: { fixed: 100 },
        metadata: { maxRewardedInvitesPerInviter: 50, velocityThreshold: 20 },
      }
    : overrides.campaign;

  const tx = {
    invite_records: {
      updateMany: vi.fn(async () => ({ count: claimedCount })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'record-1',
        ...args.data,
      })),
    },
  };

  const prisma = {
    invite_codes: {
      findUnique: vi.fn(async () => overrides?.inviteCode ?? null),
      // findCodeByCode 用 findFirst 按 code 查（带 user.status 过滤），返回同一枚 code。
      findFirst: vi.fn(async () => overrides?.inviteCode ?? null),
    },
    invite_records: {
      findUnique: vi.fn(async () => overrides?.existingRecord ?? overrides?.record ?? null),
      count: vi.fn(async () => rewardedCount),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'record-1',
        ...args.data,
      })),
    },
    $transaction: vi.fn(async (cb: (transaction: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const systemSettingsService = {
    getBoolean: vi.fn(async () => inviteSharingEnabled),
  };
  const campaignRewardService = {
    findCampaignByCode: vi.fn(async () => campaign),
    grantCampaignRewardWithinTx: vi.fn(async () => ({ status: 'granted' })),
  };

  const service = new InviteService(
    new InviteRepository(prisma as never),
    systemSettingsService as never,
    campaignRewardService as never,
  );
  return { service, prisma, campaignRewardService, systemSettingsService, tx };
}

describe('InviteService.settlePendingInvitationReward', () => {
  it('returns null without side effects when no invite record exists', async () => {
    const { service, campaignRewardService } = makeService({ record: null });

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).toBeNull();
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });

  it('returns null without side effects when invite already rewarded', async () => {
    const { service, prisma, campaignRewardService } = makeService({
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
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });

  it('grants invite rewards through the campaign ledger using the invite snapshot', async () => {
    const { service, campaignRewardService, tx } = makeService({
      record: {
        id: 'record-1',
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
    });

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).not.toBeNull();
    expect(campaignRewardService.grantCampaignRewardWithinTx).toHaveBeenCalledTimes(1);
    expect(campaignRewardService.grantCampaignRewardWithinTx).toHaveBeenCalledWith(
      tx,
      'campaign-1',
      expect.objectContaining({
        userId: 'inviter-1',
        triggerKey: 'invite:user-1',
        triggerEventId: 'user-1',
        pointGrantSource: PointsSource.INVITATION,
        pointGrantSourceId: 'user-1',
        metadata: expect.objectContaining({
          inviteRecordId: 'record-1',
          rewardPointsSnapshot: 100,
        }),
      }),
      { pointsOverride: 100 },
    );
  });

  it('FIX-2: skips the grant when the inviter is at the per-inviter reward cap', async () => {
    const { service, prisma, campaignRewardService } = makeService({
      record: {
        inviterUserId: 'inviter-1',
        inviteeUserId: 'user-1',
        inviteCodeId: 'code-1',
        rewardPoints: 100,
        rewarded: false,
      },
      rewardedCount: 100000,
    });

    const result = await service.settlePendingInvitationReward('user-1');

    expect(result).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });

  it('is idempotent when updateMany claims 0 rows (concurrent settle)', async () => {
    const { service, campaignRewardService } = makeService({
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
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });

  it('returns null without side effects when invite sharing is disabled', async () => {
    const { service, prisma, campaignRewardService } = makeService({
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
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });
});

describe('InviteService.recordInvitation', () => {
  it('FIX-2: records an UNrewarded invitation without granting points at registration', async () => {
    const { service, prisma, campaignRewardService } = makeService({
      inviteCode: { id: 'code-1', code: 'ABCD1234', userId: 'inviter-1' },
      existingRecord: null,
    });

    const result = await service.recordInvitation('ABCD1234', 'invitee-1');

    expect(result).toEqual(
      expect.objectContaining({
        inviteCodeId: 'code-1',
        inviterUserId: 'inviter-1',
        inviteeUserId: 'invitee-1',
        rewardPoints: 100,
        rewarded: false,
      }),
    );
    expect(prisma.invite_records.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rewardPoints: 100, rewarded: false }),
    });
    // No reward at registration time — only on activation/approval (settle).
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('P3-1: rejects self-invitation (inviteeUserId === code.userId)', async () => {
    const { service, prisma, campaignRewardService } = makeService({
      inviteCode: { id: 'code-1', code: 'ABCD1234', userId: 'user-1' },
    });

    await expect(
      service.recordInvitation('ABCD1234', 'user-1'),
    ).rejects.toMatchObject({ i18nKey: 'invite.cannot_invite_self' });
    expect(prisma.invite_records.create).not.toHaveBeenCalled();
    expect(campaignRewardService.grantCampaignRewardWithinTx).not.toHaveBeenCalled();
  });

  it('does not record invitations when invite sharing is disabled', async () => {
    const { service, prisma } = makeService({ inviteSharingEnabled: false });

    const result = await service.recordInvitation('ABCD1234', 'user-1');

    expect(result).toBeNull();
    // recordInvitation 走 findCodeByCode → findFirst；断言 findUnique 恒真（它只在 findCodeByUser 里）。
    expect(prisma.invite_codes.findFirst).not.toHaveBeenCalled();
    expect(prisma.invite_records.create).not.toHaveBeenCalled();
  });
});
