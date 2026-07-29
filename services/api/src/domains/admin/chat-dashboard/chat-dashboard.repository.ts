import { Injectable } from '@nestjs/common';
import { Prisma } from '../../platform/prisma/generated';
import { PrismaService } from '../../platform/prisma/prisma.service';

export interface DashboardDateRange {
  from: Date;
  to: Date;
}

export interface DashboardDisplayUser {
  id: string;
  status: string;
  nickname: string | null;
  realName: string | null;
  username: string;
}

const rangeWhere = (range: DashboardDateRange) => ({
  gte: range.from,
  lt: range.to,
});

@Injectable()
export class ChatDashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSystemCodeById(systemId: string): Promise<string | null> {
    const system = await this.prisma.system.findUnique({
      where: { id: systemId },
      select: { code: true },
    });
    return system?.code ?? null;
  }

  findUsersForDisplay(userIds: string[]): Promise<DashboardDisplayUser[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        status: true,
        nickname: true,
        realName: true,
        username: true,
      },
    });
  }

  countUsersForRiskDistribution() {
    return this.prisma.user.count({ where: { status: { not: 'DELETED' } } });
  }

  countGalleryPending() {
    return this.prisma.gallery_posts.count({ where: { status: 'PENDING' } });
  }

  countGalleryPendingReports() {
    return this.prisma.gallery_reports.count({ where: { status: 'PENDING' } });
  }

  async countTemplatePending() {
    const [image, video] = await Promise.all([
      this.prisma.image_templates.count({ where: { status: 'PENDING' } }),
      this.prisma.video_templates.count({ where: { status: 'PENDING' } }),
    ]);
    return { image, video };
  }

  countRegistrationPending(chatSystemId: string) {
    return this.prisma.systemRegistration.count({
      where: { systemId: chatSystemId, status: 'PENDING' },
    });
  }

  countFlaggedRiskUsers() {
    return this.prisma.user_risk_profiles.count({
      where: { level: { not: 'L0' }, user: { status: { not: 'DELETED' } } },
    });
  }

  countBatchJobsProcessing() {
    return this.prisma.batch_jobs.count({ where: { status: 'processing' } });
  }

  async groupGenerationByStatus(range: DashboardDateRange) {
    const rows = await this.prisma.generation_tasks.groupBy({
      by: ['status', 'kind'],
      where: { createdAt: rangeWhere(range) },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      status: row.status,
      kind: row.kind,
      count: row._count._all,
    }));
  }

  async aggregateGenerationDuration(range: DashboardDateRange) {
    const result = await this.prisma.generation_tasks.aggregate({
      where: {
        createdAt: rangeWhere(range),
        status: 'SUCCEEDED',
        durationMs: { not: null },
      },
      _avg: { durationMs: true },
    });
    return { avgMs: result._avg.durationMs };
  }

  async groupGenerationFailureReasons(range: DashboardDateRange, limit: number) {
    const rows = await this.prisma.generation_tasks.groupBy({
      by: ['errorStage', 'errorClass'],
      where: { createdAt: rangeWhere(range), status: 'FAILED' },
      _count: { _all: true },
    });
    return rows
      .map((row) => ({
        errorStage: row.errorStage,
        errorClass: row.errorClass,
        count: row._count._all,
      }))
      .sort((a, b) =>
        b.count - a.count ||
        (a.errorStage ?? '').localeCompare(b.errorStage ?? '') ||
        (a.errorClass ?? '').localeCompare(b.errorClass ?? ''),
      )
      .slice(0, limit);
  }

  async groupGenerationTopModels(range: DashboardDateRange, limit: number) {
    const rows = await this.prisma.generation_tasks.groupBy({
      by: ['provider', 'model', 'status'],
      where: { createdAt: rangeWhere(range) },
      _count: { _all: true },
    });
    const groups = new Map<
      string,
      { provider: string | null; model: string; count: number; succeeded: number; failed: number }
    >();
    for (const row of rows) {
      const key = `${row.provider ?? ''}\u0000${row.model}`;
      const item = groups.get(key) ?? {
        provider: row.provider,
        model: row.model,
        count: 0,
        succeeded: 0,
        failed: 0,
      };
      item.count += row._count._all;
      if (row.status === 'SUCCEEDED') item.succeeded += row._count._all;
      if (row.status === 'FAILED') item.failed += row._count._all;
      groups.set(key, item);
    }
    return [...groups.values()]
      .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model))
      .slice(0, limit);
  }

  sumGmvByCurrency(range: DashboardDateRange) {
    return this.prisma.$queryRaw<Array<{ currency: string; amount: unknown }>>(Prisma.sql`
      SELECT COALESCE("currency", 'UNKNOWN') AS "currency",
             SUM(COALESCE("paidAmount", "amount")) AS "amount"
      FROM "orders"
      WHERE "paidAt" >= ${range.from} AND "paidAt" < ${range.to}
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY "currency" ASC
    `);
  }

  countPaidOrders(range: DashboardDateRange) {
    return this.prisma.orders.count({ where: { paidAt: rangeWhere(range) } });
  }

  countPendingOrdersGlobal() {
    return this.prisma.orders.count({ where: { status: 'PENDING' } });
  }

  sumRefundedByCurrency(range: DashboardDateRange) {
    return this.prisma.$queryRaw<Array<{ currency: string; amount: unknown }>>(Prisma.sql`
      SELECT COALESCE("currency", 'UNKNOWN') AS "currency",
             SUM(COALESCE("refundAmount", "paidAmount", "amount")) AS "amount"
      FROM "orders"
      WHERE "refundedAt" >= ${range.from} AND "refundedAt" < ${range.to}
      GROUP BY COALESCE("currency", 'UNKNOWN')
      ORDER BY "currency" ASC
    `);
  }

  async sumPointsConsumed(range: DashboardDateRange) {
    const result = await this.prisma.points_records.aggregate({
      where: {
        type: 'CONSUME',
        status: 'CONFIRMED',
        source: 'TASK',
        createdAt: rangeWhere(range),
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  countActiveHoldsGlobal() {
    return this.prisma.point_holds.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    });
  }

  async groupTopPointsConsumers(range: DashboardDateRange, limit: number) {
    const rows = await this.prisma.points_records.groupBy({
      by: ['userId'],
      where: {
        type: 'CONSUME',
        status: 'CONFIRMED',
        source: 'TASK',
        createdAt: rangeWhere(range),
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });
    return rows.map((row) => ({ userId: row.userId, points: row._sum.amount ?? 0 }));
  }

  async countGalleryPublished(range: DashboardDateRange) {
    const rows = await this.prisma.gallery_posts.groupBy({
      by: ['kind'],
      where: { status: 'PUBLISHED', publishedAt: rangeWhere(range) },
      _count: { _all: true },
    });
    return {
      image: rows.find((row) => row.kind === 'IMAGE')?._count._all ?? 0,
      video: rows.find((row) => row.kind === 'VIDEO')?._count._all ?? 0,
    };
  }

  topGalleryHot(limit: number) {
    return this.prisma.$queryRaw<
      Array<{ id: string; title: string | null; kind: 'IMAGE' | 'VIDEO'; hotScore: number }>
    >(Prisma.sql`
      SELECT post."id", post."title", post."kind",
             COALESCE(metrics."hotScore", 0) AS "hotScore"
      FROM "gallery_posts" post
      LEFT JOIN "resource_metrics" metrics
        ON metrics."resourceType" = 'GALLERY_POST'
       AND metrics."resourceId" = post."id"
      WHERE post."status" = 'PUBLISHED'
      ORDER BY COALESCE(metrics."hotScore", 0) DESC,
               post."publishedAt" DESC NULLS LAST,
               post."id" ASC
      LIMIT ${limit}
    `);
  }

  async featuredSlotsCoverage(now: Date) {
    const base = { kind: 'RESOURCE' as const, isEnabled: true };
    const [enabledResourceSlots, activeResourceSlots] = await Promise.all([
      this.prisma.featured_slots.count({ where: base }),
      this.prisma.featured_slots.count({
        where: {
          ...base,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      }),
    ]);
    return { activeResourceSlots, enabledResourceSlots };
  }

  countActiveBoosts(now: Date) {
    return this.prisma.resource_boosts.count({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    });
  }

  countConversationsCreated(range: DashboardDateRange) {
    return this.prisma.conversations.count({ where: { createdAt: rangeWhere(range) } });
  }

  async groupRiskLevelDistribution() {
    const rows = await this.prisma.user_risk_profiles.groupBy({
      by: ['level'],
      where: { user: { status: { not: 'DELETED' } } },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.level, row._count._all])) as Partial<
      Record<'L0' | 'L1' | 'L2' | 'L3', number>
    >;
  }

  countEvaluatedHighRiskUsers(range: DashboardDateRange) {
    return this.prisma.user_risk_profiles.count({
      where: {
        evaluatedAt: rangeWhere(range),
        level: { in: ['L2', 'L3'] },
        user: { status: { not: 'DELETED' } },
      },
    });
  }

  countRiskEvents(range: DashboardDateRange) {
    return this.prisma.user_risk_events.count({
      where: { createdAt: rangeWhere(range), user: { status: { not: 'DELETED' } } },
    });
  }

  async groupTopRiskEventTypes(range: DashboardDateRange, limit: number) {
    const rows = await this.prisma.user_risk_events.groupBy({
      by: ['type'],
      where: { createdAt: rangeWhere(range), user: { status: { not: 'DELETED' } } },
      _count: { _all: true },
      _avg: { severity: true },
      orderBy: [{ _count: { type: 'desc' } }, { type: 'asc' }],
      take: limit,
    });
    return rows.map((row) => ({
      type: row.type,
      count: row._count._all,
      avgSeverity: row._avg.severity,
    }));
  }

  bucketRiskEventSeverity(range: DashboardDateRange) {
    return this.prisma.$queryRaw<Array<{ bucket: 'A' | 'B' | 'C' | 'D' | 'E'; count: number }>>(Prisma.sql`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT CASE
          WHEN event."severity" = 0 THEN 'A'
          WHEN event."severity" >= 1 AND event."severity" < 40 THEN 'B'
          WHEN event."severity" >= 40 AND event."severity" < 70 THEN 'C'
          WHEN event."severity" >= 70 AND event."severity" < 100 THEN 'D'
          ELSE 'E'
        END AS bucket
        FROM "user_risk_events" event
        INNER JOIN "users" usr ON usr."id" = event."userId"
        WHERE usr."status" <> 'DELETED'
          AND event."createdAt" >= ${range.from}
          AND event."createdAt" < ${range.to}
          AND event."severity" BETWEEN 0 AND 100
      ) grouped
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
  }

  listRecentHighSeverityEvents(range: DashboardDateRange, limit: number) {
    return this.prisma.user_risk_events.findMany({
      where: {
        severity: { gte: 70 },
        createdAt: rangeWhere(range),
        user: { status: { not: 'DELETED' } },
      },
      select: { id: true, userId: true, type: true, severity: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
