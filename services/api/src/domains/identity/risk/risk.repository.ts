import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  PointLedgerEventType,
  PointsSource,
  Prisma,
  RiskLevel,
  UserStatus,
} from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { GRANT_TYPE_BALANCE_FIELD } from '../../billing/points/points-grants.helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

const RISK_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  status: true,
  createdAt: true,
  signupIp: true,
  signupDeviceId: true,
} as const;

const INVITER_SELECT = { id: true, username: true, email: true } as const;

@Injectable()
export class RiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  listRiskProfiles(input: { level?: RiskLevel; skip: number; take: number }) {
    return this.prisma.user_risk_profiles.findMany({
      where: input.level ? { level: input.level } : undefined,
      include: { user: { select: RISK_USER_SELECT } },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      skip: input.skip,
      take: input.take,
    });
  }

  countRiskProfiles(input: { level?: RiskLevel }) {
    return this.prisma.user_risk_profiles.count({
      where: input.level ? { level: input.level } : undefined,
    });
  }

  getRiskProfile(userId: string) {
    return this.prisma.user_risk_profiles.findUnique({
      where: { userId },
      include: { user: { select: RISK_USER_SELECT } },
    });
  }

  /** 一次查询批量取这批用户各自的邀请人（inviteeUserId -> 邀请人 user）。 */
  async findInvitersFor(userIds: string[]): Promise<Map<string, unknown>> {
    if (userIds.length === 0) return new Map();
    const records = await this.prisma.invite_records.findMany({
      where: { inviteeUserId: { in: userIds } },
      select: { inviteeUserId: true, inviter: { select: INVITER_SELECT } },
    });
    return new Map(records.map((r) => [r.inviteeUserId, r.inviter]));
  }

  /** 一次 groupBy 批量取这批用户各自邀请了多少人。 */
  async countInviteesFor(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const grouped = await this.prisma.invite_records.groupBy({
      by: ['inviterUserId'],
      where: { inviterUserId: { in: userIds } },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.inviterUserId, g._count._all]));
  }

  async findInviter(userId: string) {
    const record = await this.prisma.invite_records.findUnique({
      where: { inviteeUserId: userId },
      select: { inviter: { select: INVITER_SELECT } },
    });
    return record?.inviter ?? null;
  }

  listInvitees(userId: string) {
    return this.prisma.invite_records.findMany({
      where: { inviterUserId: userId },
      select: {
        inviteeUserId: true,
        rewarded: true,
        createdAt: true,
        invitee: { select: RISK_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  listRiskEvents(userId: string, limit = 100) {
    return this.prisma.user_risk_events.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  upsertRiskProfile(userId: string, data: Prisma.user_risk_profilesUncheckedUpdateInput) {
    return this.prisma.user_risk_profiles.upsert({
      where: { userId },
      create: {
        userId,
        level: (data.level as RiskLevel) ?? 'L0',
        manualOverride: (data.manualOverride as boolean) ?? false,
        score: (data.score as number) ?? 0,
        evaluatedAt: (data.evaluatedAt as Date) ?? null,
        blockedAt: (data.blockedAt as Date) ?? null,
        blockedReason: (data.blockedReason as string) ?? null,
      },
      update: data,
    });
  }

  createRiskEvent(data: Prisma.user_risk_eventsUncheckedCreateInput) {
    return this.prisma.user_risk_events.create({ data });
  }

  setUserStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id: userId }, data: { status } });
  }

  // ===== R2: 自动评分 =====

  /** 聚合某用户的风险信号原始计数。 */
  async gatherUserSignals(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { signupIp: true, signupDeviceId: true },
    });
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const [sameIpUsers, sameDeviceUsers, inviteTotal, inviteBurst, paidOrders, refundedOrders] =
      await Promise.all([
        user?.signupIp
          ? this.prisma.user.count({ where: { signupIp: user.signupIp, id: { not: userId } } })
          : 0,
        user?.signupDeviceId
          ? this.prisma.user.count({
              where: { signupDeviceId: user.signupDeviceId, id: { not: userId } },
            })
          : 0,
        this.prisma.invite_records.count({ where: { inviterUserId: userId } }),
        this.prisma.invite_records.count({
          where: { inviterUserId: userId, createdAt: { gte: dayAgo } },
        }),
        this.prisma.orders.count({
          where: { userId, status: { in: [OrderStatus.PAID, OrderStatus.REFUNDED] } },
        }),
        this.prisma.orders.count({ where: { userId, status: OrderStatus.REFUNDED } }),
      ]);
    return { sameIpUsers, sameDeviceUsers, inviteTotal, inviteBurst, paidOrders, refundedOrders };
  }

  updateRiskScore(
    userId: string,
    data: { score: number; topSignals: string[]; evaluatedAt: Date },
  ) {
    return this.prisma.user_risk_profiles.update({ where: { userId }, data });
  }

  /** 待评估候选：近 24h 注册 + 当前已标记（level != L0）的用户。 */
  async listEvaluationCandidateIds(now = new Date()): Promise<string[]> {
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const [recent, flagged] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: dayAgo } },
        select: { id: true },
        take: 2000,
      }),
      this.prisma.user_risk_profiles.findMany({
        where: { level: { not: RiskLevel.L0 } },
        select: { userId: true },
        take: 2000,
      }),
    ]);
    return Array.from(new Set([...recent.map((r) => r.id), ...flagged.map((f) => f.userId)]));
  }

  // ===== R2 / FIX-13: 封号追回邀请奖励 =====

  /**
   * 追回"邀请人因邀请该（被封号）被邀请人而获得的邀请奖励"：
   * 找到 source=INVITATION 且 sourceId=inviteeUserId 的可用 grant，钳制扣减（不为负）。
   */
  async clawbackInviteRewardForInvitee(
    inviteeUserId: string,
  ): Promise<{ grants: number; clawedBack: number }> {
    return this.prisma.$transaction(async (tx) => {
      // 邀请奖励 grant：sourceEvent=campaign_bonus 且 sourceId=被邀请人 userId（区别于活动奖励的 sourceId=campaignId）。
      const grants = await tx.point_grants.findMany({
        where: {
          sourceEvent: PointLedgerEventType.campaign_bonus,
          sourceId: inviteeUserId,
          availableAmount: { gt: 0 },
        },
      });
      let clawedBack = 0;
      for (const grant of grants) {
        const userPoints = await tx.user_points.findUnique({ where: { userId: grant.userId } });
        const bucketField = GRANT_TYPE_BALANCE_FIELD[grant.grantType] as string;
        const bucketBalance = Number((userPoints as Record<string, unknown> | null)?.[bucketField] ?? 0);
        const safe = Math.max(
          0,
          Math.min(grant.availableAmount, Number(userPoints?.availableBalance ?? 0), bucketBalance),
        );
        if (safe <= 0) continue;
        await tx.point_grants.update({
          where: { id: grant.id },
          data: { availableAmount: { decrement: safe }, refundedAmount: { increment: safe } },
        });
        const updated = await tx.user_points.update({
          where: { userId: grant.userId },
          data: {
            balance: { decrement: safe },
            availableBalance: { decrement: safe },
            totalBalance: { decrement: safe },
            [bucketField]: { decrement: safe },
          },
        });
        await tx.points_records.create({
          data: {
            userId: grant.userId,
            type: 'CONSUME',
            amount: safe,
            source: PointsSource.INVITATION,
            sourceId: inviteeUserId,
            balance: updated.balance,
            remark: 'risk_clawback:invitee_blocked',
          },
        });
        clawedBack += safe;
      }
      return { grants: grants.length, clawedBack };
    });
  }
}
