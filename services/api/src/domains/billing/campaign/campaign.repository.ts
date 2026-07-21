import { Injectable } from '@nestjs/common';
import {
  CampaignStatus,
  CampaignType,
  PointGrantType,
  PointLedgerEventType,
  Prisma,
  VideoGenStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import {
  DEFAULT_REWARD_USAGE_SCOPE,
  HOME_QUEST_CODE_PREFIX,
  type FixedCampaignDefinition,
} from './campaign-reward.helpers';

@Injectable()
export class CampaignRepository {
  constructor(private readonly prisma: PrismaService) { }

  listActiveCampaigns(where: Prisma.campaignsWhereInput) {
    return this.prisma.campaigns.findMany({
      where,
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listCampaigns(where: Prisma.campaignsWhereInput) {
    return this.prisma.campaigns.findMany({ where });
  }

  async ensureFixedCampaigns(definitions: readonly FixedCampaignDefinition[]) {
    await Promise.all(
      definitions.map((def) =>
        this.prisma.campaigns.upsert({
          where: { code: def.code },
          // 内置活动的 metadata 由代码权威定义（hrefPath / modelMatchers /
          // completionKind 等内置字段绝不允许运营在 admin 里改，否则一旦漂移，
          // 首页任务的跳转参数与完成态判定就会失效）。因此 upsert 每次都用最新
          // 定义覆盖 metadata；status / rewardPoints / 时间窗口等运营字段仍由
          // admin 控制，故不动。
          update: { metadata: def.metadata },
          create: {
            code: def.code,
            name: def.name,
            description: def.description,
            type: def.type,
            status: def.status,
            rewardGrantType: PointGrantType.GIFT,
            rewardSourceEvent: PointLedgerEventType.campaign_bonus,
            rewardPointsExpression: { fixed: def.rewardPoints },
            rewardExpiresInDays: def.rewardExpiresInDays,
            rewardUsageScope: def.rewardUsageScope ?? DEFAULT_REWARD_USAGE_SCOPE,
            metadata: def.metadata,
          },
        }),
      ),
    );
  }

  listHomeQuestCampaigns() {
    return this.prisma.campaigns.findMany({
      where: {
        status: { not: CampaignStatus.ARCHIVED },
        type: CampaignType.QUEST,
        code: { startsWith: HOME_QUEST_CODE_PREFIX },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
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

  findCampaignByCode(code: string) {
    return this.prisma.campaigns.findUnique({ where: { code } });
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

  findCampaign(id: string) {
    return this.prisma.campaigns.findUnique({ where: { id } });
  }

  updateCampaign(id: string, data: Prisma.campaignsUpdateInput) {
    return this.prisma.campaigns.update({ where: { id }, data });
  }

  // FIX-14: 校验 generationId 是否为属于该用户的真实生成记录（图片 / 视频）。
  async generationBelongsToUser(userId: string, generationId: string): Promise<boolean> {
    const [image, clip] = await Promise.all([
      this.prisma.image_generations.count({ where: { id: generationId, userId } }),
      this.prisma.video_clip_generations.count({ where: { id: generationId, userId } }),
    ]);
    return image + clip > 0;
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

  findRewardsByTriggerKeys(userId: string, triggerKeys: string[]) {
    if (triggerKeys.length === 0) return Promise.resolve([]);
    return this.prisma.campaign_rewards.findMany({
      where: { userId, triggerKey: { in: triggerKeys } },
    });
  }

  async hasCompletedImageGenerationByModel(
    userId: string,
    modelMatchers: string[],
  ): Promise<boolean> {
    const where: Prisma.image_generationsWhereInput = {
      userId,
      status: 'completed',
      generatedImages: { isEmpty: false },
    };
    const modelWhere = modelMatchersToImageModelWhere(modelMatchers);
    if (modelWhere.length > 0) where.OR = modelWhere;
    const count = await this.prisma.image_generations.count({ where });
    return count > 0;
  }

  async hasCompletedVideoGenerationByModel(
    userId: string,
    modelMatchers: string[],
  ): Promise<boolean> {
    const clipModelWhere = modelMatchersToClipModelWhere(modelMatchers);
    const clipVideoWhere: Prisma.video_clip_generationsWhereInput = {
      userId,
      status: VideoGenStatus.completed,
      videoUrl: { not: null },
    };
    if (clipModelWhere.length > 0) clipVideoWhere.OR = clipModelWhere;

    // 只查 clip 表：第一代 video_generations 已删除（它从未产出过 completed 行，
    // 那条 OR 分支恒为 0，删掉不改变任何判定结果）。
    const clipVideo = await this.prisma.video_clip_generations.count({ where: clipVideoWhere });
    return clipVideo > 0;
  }

  runRewardTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  // FIX-12: 对活动行加 FOR UPDATE 锁，串行化同一活动的并发发奖，
  // 使后续 per-user/每日封顶的聚合读取看到已提交的并发发放结果（原子封顶）。
  async lockCampaignInTx(tx: Prisma.TransactionClient, campaignId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${campaignId} FOR UPDATE`;
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

function modelMatchersToImageModelWhere(
  modelMatchers: string[],
): Prisma.image_generationsWhereInput[] {
  return modelMatchers
    .map((matcher) => matcher.trim())
    .filter(Boolean)
    .map((matcher) => {
      if (matcher.startsWith('=')) {
        return { modelUsed: { equals: matcher.slice(1), mode: 'insensitive' as const } };
      }
      return { modelUsed: { contains: matcher, mode: 'insensitive' as const } };
    });
}

function modelMatchersToClipModelWhere(
  modelMatchers: string[],
): Prisma.video_clip_generationsWhereInput[] {
  return modelMatchers
    .map((matcher) => matcher.trim())
    .filter(Boolean)
    .map((matcher) => {
      if (matcher.startsWith('=')) {
        return { model: { equals: matcher.slice(1), mode: 'insensitive' as const } };
      }
      return { model: { contains: matcher, mode: 'insensitive' as const } };
    });
}
