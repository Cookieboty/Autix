import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActiveCampaigns(where: Prisma.campaignsWhereInput) {
    return this.prisma.campaigns.findMany({
      where,
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listCampaigns(where: Prisma.campaignsWhereInput) {
    return this.prisma.campaigns.findMany({ where });
  }

  findProgressRows(userId: string, activeCampaignWhere: Prisma.campaignsWhereInput) {
    return Promise.all([
      this.listActiveCampaigns(activeCampaignWhere),
      this.prisma.user_activity_streaks.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.campaign_rewards.findMany({
        where: { userId },
        include: { campaign: true },
        orderBy: { grantedAt: 'desc' },
        take: 30,
      }),
      this.prisma.invite_records.findMany({
        where: { inviterUserId: userId, rewarded: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
  }

  listAdminCampaigns() {
    return this.prisma.campaigns.findMany({
      include: { _count: { select: { rewards: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listCampaignRewards(campaignId: string, take: number) {
    return this.prisma.campaign_rewards.findMany({
      where: { campaignId },
      include: { user: { select: { id: true, username: true, email: true, realName: true } } },
      orderBy: { grantedAt: 'desc' },
      take,
    });
  }

  createCampaign(data: Prisma.campaignsCreateInput) {
    return this.prisma.campaigns.create({ data });
  }

  updateCampaign(id: string, data: Prisma.campaignsUpdateInput) {
    return this.prisma.campaigns.update({ where: { id }, data });
  }

  findStreak(userId: string, streakType: string) {
    return this.prisma.user_activity_streaks.findUnique({
      where: {
        userId_streakType: { userId, streakType },
      },
    });
  }

  createStreak(data: Prisma.user_activity_streaksUncheckedCreateInput) {
    return this.prisma.user_activity_streaks.create({ data });
  }

  updateStreak(
    userId: string,
    streakType: string,
    data: Prisma.user_activity_streaksUncheckedUpdateInput,
  ) {
    return this.prisma.user_activity_streaks.update({
      where: {
        userId_streakType: { userId, streakType },
      },
      data,
    });
  }

  findRewardByTrigger(campaignId: string, triggerKey: string) {
    return this.prisma.campaign_rewards.findFirst({
      where: { campaignId, triggerKey },
    });
  }

  runRewardTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  findCampaignInTx(tx: Prisma.TransactionClient, campaignId: string) {
    return tx.campaigns.findUnique({ where: { id: campaignId } });
  }

  findRewardByTriggerInTx(
    tx: Prisma.TransactionClient,
    campaignId: string,
    triggerKey: string,
  ) {
    return tx.campaign_rewards.findUnique({
      where: {
        campaignId_triggerKey: {
          campaignId,
          triggerKey,
        },
      },
    });
  }

  aggregateRewardPointsInTx(
    tx: Prisma.TransactionClient,
    where: Prisma.campaign_rewardsWhereInput,
  ) {
    return tx.campaign_rewards.aggregate({
      where,
      _sum: { pointsGranted: true },
    });
  }

  createRewardInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.campaign_rewardsUncheckedCreateInput,
  ) {
    return tx.campaign_rewards.create({ data });
  }

  guardedIncrementUsedBudgetInTx(
    tx: Prisma.TransactionClient,
    campaignId: string,
    remainingBudget: number | null,
    points: number,
  ) {
    return tx.campaigns.updateMany({
      where: {
        id: campaignId,
        ...(remainingBudget != null ? { usedBudget: { lte: remainingBudget } } : {}),
      },
      data: { usedBudget: { increment: points } },
    });
  }

  attachPointGrantInTx(tx: Prisma.TransactionClient, rewardId: string, pointGrantId: string) {
    return tx.campaign_rewards.update({
      where: { id: rewardId },
      data: { pointGrantId },
    });
  }
}
