import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import type {
  ChatDashboardBillingSummary,
  ChatDashboardContentPulse,
  ChatDashboardGenerationHealth,
  ChatDashboardPendingInbox,
  ChatDashboardRangeQuery,
  ChatDashboardRiskSignals,
} from '@autix/domain/admin/chat-dashboard';
import { LRUCache } from 'lru-cache';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';
import {
  deltaPct,
  mergeCurrencyDelta,
  resolveRange,
  successRateDeltaPoints,
  type ResolvedDashboardRange,
} from './chat-dashboard.helpers';
import {
  buildResolvedRange,
  presentAmounts,
  toDisplayName,
} from './chat-dashboard.presenter';
import { ChatDashboardRepository } from './chat-dashboard.repository';

type GenerationStatusRow = Awaited<
  ReturnType<ChatDashboardRepository['groupGenerationByStatus']>
>[number];

const rate = (succeeded: number, failed: number) => {
  const denominator = succeeded + failed;
  return denominator === 0 ? null : succeeded / denominator;
};

@Injectable()
export class ChatDashboardService {
  private readonly rangeCache = new LRUCache<string, object>({
    max: 500,
    ttl: 30_000,
    allowStale: false,
  });

  private readonly snapshotCache = new LRUCache<string, object>({
    max: 500,
    ttl: 30_000,
    allowStale: false,
  });

  constructor(private readonly repo: ChatDashboardRepository) { }

  private async assertChatSystem(user: AuthUser): Promise<string> {
    if (!user.currentSystemId) {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'auth.system.not_in_chat_system',
      );
    }
    const code = await this.repo.findSystemCodeById(user.currentSystemId);
    if (code !== 'chat') {
      throw new I18nHttpException(
        HttpStatus.FORBIDDEN,
        'auth.system.not_in_chat_system',
      );
    }
    return user.currentSystemId;
  }

  private async getOrSet<T extends object>(
    cache: LRUCache<string, object>,
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = cache.get(key) as T | undefined;
    if (cached !== undefined) return cached;
    const value = await loader();
    cache.set(key, value);
    return value;
  }

  private rangeKey(
    section: string,
    systemId: string,
    range: ResolvedDashboardRange,
  ) {
    return [
      'range',
      section,
      systemId,
      range.tz,
      range.window,
      range.from.toISOString(),
      range.to.toISOString(),
    ].join(':');
  }

  async pendingInbox(user: AuthUser): Promise<ChatDashboardPendingInbox> {
    const systemId = await this.assertChatSystem(user);
    const now = new Date();
    const snapshot = await this.getOrSet(
      this.snapshotCache,
      `snapshot:pending:${systemId}`,
      async () => {
        const [gallery, reports, templates, registrations, risk, batch] =
          await Promise.all([
            this.repo.countGalleryPending(),
            this.repo.countGalleryPendingReports(),
            this.repo.countTemplatePending(),
            this.repo.countRegistrationPending(systemId),
            this.repo.countFlaggedRiskUsers(),
            this.repo.countBatchJobsProcessing(),
          ]);
        return { gallery, reports, templates, registrations, risk, batch };
      },
    );

    return {
      galleryPendingCount: snapshot.gallery,
      galleryPendingReportCount: snapshot.reports,
      templatePendingCount: snapshot.templates.image + snapshot.templates.video,
      templatePendingImageCount: snapshot.templates.image,
      templatePendingVideoCount: snapshot.templates.video,
      registrationPendingCount: snapshot.registrations,
      riskFlaggedUserCount: snapshot.risk,
      batchJobProcessingCount: snapshot.batch,
      updatedAt: now.toISOString(),
    };
  }

  private summarizeGeneration(rows: GenerationStatusRow[]) {
    const count = (status: string, kind?: string) =>
      rows
        .filter((row) => row.status === status && (!kind || row.kind === kind))
        .reduce((sum, row) => sum + row.count, 0);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const succeeded = count('SUCCEEDED');
    const failed = count('FAILED');
    return {
      total,
      active: count('PENDING') + count('QUEUED'),
      succeeded,
      failed,
      expired: count('EXPIRED'),
      successRate: rate(succeeded, failed),
      failureRate: rate(failed, succeeded),
      byKind: (['IMAGE', 'VIDEO'] as const).map((kind) => {
        const kindSucceeded = count('SUCCEEDED', kind);
        const kindFailed = count('FAILED', kind);
        return {
          kind,
          total: rows
            .filter((row) => row.kind === kind)
            .reduce((sum, row) => sum + row.count, 0),
          failureRate: rate(kindFailed, kindSucceeded),
        };
      }),
    };
  }

  async generationHealth(
    user: AuthUser,
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardGenerationHealth> {
    const systemId = await this.assertChatSystem(user);
    const now = new Date();
    const resolved = resolveRange(query, now);
    const load = async () => {
      const currentRange = { from: resolved.from, to: resolved.to };
      const [current, duration, reasons, models, previous] = await Promise.all([
        this.repo.groupGenerationByStatus(currentRange),
        this.repo.aggregateGenerationDuration(currentRange),
        this.repo.groupGenerationFailureReasons(currentRange, 10),
        this.repo.groupGenerationTopModels(currentRange, 10),
        this.repo.groupGenerationByStatus(resolved.prev),
      ]);
      return { current, duration, reasons, models, previous };
    };
    const data =
      query.window === 'custom'
        ? await load()
        : await this.getOrSet(
          this.rangeCache,
          this.rangeKey('generation', systemId, resolved),
          load,
        );
    const current = this.summarizeGeneration(data.current);
    const previous = this.summarizeGeneration(data.previous);

    return {
      range: buildResolvedRange(resolved),
      totals: {
        total: current.total,
        active: current.active,
        succeeded: current.succeeded,
        failed: current.failed,
        expired: current.expired,
      },
      successRate: current.successRate,
      failureRate: current.failureRate,
      avgDurationMs: data.duration.avgMs,
      byKind: current.byKind,
      topFailureReasons: data.reasons,
      topModels: data.models.map((model) => ({
        provider: model.provider,
        model: model.model,
        count: model.count,
        failureRate: rate(model.failed, model.succeeded),
      })),
      compareToPrev: {
        totalDeltaPct: deltaPct(current.total, previous.total),
        successRateDeltaPoints: successRateDeltaPoints(
          current.successRate,
          previous.successRate,
        ),
      },
    };
  }

  async billingSummary(
    user: AuthUser,
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardBillingSummary> {
    const systemId = await this.assertChatSystem(user);
    const now = new Date();
    const resolved = resolveRange(query, now);
    const loadRange = async () => {
      const currentRange = { from: resolved.from, to: resolved.to };
      const [gmv, paid, refunded, points, consumers, prevGmv, prevPaid, prevPoints] =
        await Promise.all([
          this.repo.sumGmvByCurrency(currentRange),
          this.repo.countPaidOrders(currentRange),
          this.repo.sumRefundedByCurrency(currentRange),
          this.repo.sumPointsConsumed(currentRange),
          this.repo.groupTopPointsConsumers(currentRange, 10),
          this.repo.sumGmvByCurrency(resolved.prev),
          this.repo.countPaidOrders(resolved.prev),
          this.repo.sumPointsConsumed(resolved.prev),
        ]);
      return { gmv, paid, refunded, points, consumers, prevGmv, prevPaid, prevPoints };
    };
    const rangeData =
      query.window === 'custom'
        ? await loadRange()
        : await this.getOrSet(
          this.rangeCache,
          this.rangeKey('billing', systemId, resolved),
          loadRange,
        );
    const snapshot = await this.getOrSet(
      this.snapshotCache,
      `snapshot:billing:${systemId}`,
      async () => {
        const [pendingOrdersCount, activeHoldsCount] = await Promise.all([
          this.repo.countPendingOrdersGlobal(),
          this.repo.countActiveHoldsGlobal(),
        ]);
        return { pendingOrdersCount, activeHoldsCount };
      },
    );
    const users = await this.repo.findUsersForDisplay(
      [...new Set(rangeData.consumers.map((item) => item.userId))],
    );
    const userMap = new Map(users.map((item) => [item.id, item] as const));
    const gmv = presentAmounts(rangeData.gmv);
    const prevGmv = presentAmounts(rangeData.prevGmv);

    return {
      range: buildResolvedRange(resolved),
      gmv,
      paidOrdersCount: rangeData.paid,
      pendingOrdersCount: snapshot.pendingOrdersCount,
      refunded: presentAmounts(rangeData.refunded),
      pointsConsumed: rangeData.points,
      activeHoldsCount: snapshot.activeHoldsCount,
      topPointsConsumers: rangeData.consumers.map((item) => ({
        userId: item.userId,
        displayName: toDisplayName(userMap.get(item.userId)),
        points: item.points,
      })),
      compareToPrev: {
        gmvDeltaPctByCurrency: mergeCurrencyDelta(gmv, prevGmv),
        paidOrdersDeltaPct: deltaPct(rangeData.paid, rangeData.prevPaid),
        pointsConsumedDeltaPct: deltaPct(rangeData.points, rangeData.prevPoints),
      },
    };
  }

  async contentPulse(
    user: AuthUser,
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardContentPulse> {
    const systemId = await this.assertChatSystem(user);
    const now = new Date();
    const resolved = resolveRange(query, now);
    const loadRange = async () => {
      const currentRange = { from: resolved.from, to: resolved.to };
      const [published, conversations, prevPublished, prevConversations] =
        await Promise.all([
          this.repo.countGalleryPublished(currentRange),
          this.repo.countConversationsCreated(currentRange),
          this.repo.countGalleryPublished(resolved.prev),
          this.repo.countConversationsCreated(resolved.prev),
        ]);
      return { published, conversations, prevPublished, prevConversations };
    };
    const rangeData =
      query.window === 'custom'
        ? await loadRange()
        : await this.getOrSet(
          this.rangeCache,
          this.rangeKey('content', systemId, resolved),
          loadRange,
        );
    const snapshot = await this.getOrSet(
      this.snapshotCache,
      `snapshot:content:${systemId}`,
      async () => {
        const [hot, slots, activeBoosts] = await Promise.all([
          this.repo.topGalleryHot(10),
          this.repo.featuredSlotsCoverage(now),
          this.repo.countActiveBoosts(now),
        ]);
        return { hot, slots, activeBoosts };
      },
    );
    const publishedTotal = rangeData.published.image + rangeData.published.video;
    const prevPublishedTotal =
      rangeData.prevPublished.image + rangeData.prevPublished.video;

    return {
      range: buildResolvedRange(resolved),
      galleryPublished: {
        total: publishedTotal,
        image: rangeData.published.image,
        video: rangeData.published.video,
      },
      galleryHotTop10: snapshot.hot.map((item) => ({
        ...item,
        hotScore: Number(item.hotScore),
      })),
      featuredSlotsCoverage: snapshot.slots,
      activeBoosts: snapshot.activeBoosts,
      conversationsCreated: rangeData.conversations,
      compareToPrev: {
        galleryPublishedDeltaPct: deltaPct(publishedTotal, prevPublishedTotal),
        conversationsCreatedDeltaPct: deltaPct(
          rangeData.conversations,
          rangeData.prevConversations,
        ),
      },
    };
  }

  async riskSignals(
    user: AuthUser,
    query: ChatDashboardRangeQuery,
  ): Promise<ChatDashboardRiskSignals> {
    const systemId = await this.assertChatSystem(user);
    const now = new Date();
    const resolved = resolveRange(query, now);
    const loadRange = async () => {
      const currentRange = { from: resolved.from, to: resolved.to };
      const [evaluated, events, topTypes, buckets, recent, prevEvaluated, prevEvents] =
        await Promise.all([
          this.repo.countEvaluatedHighRiskUsers(currentRange),
          this.repo.countRiskEvents(currentRange),
          this.repo.groupTopRiskEventTypes(currentRange, 10),
          this.repo.bucketRiskEventSeverity(currentRange),
          this.repo.listRecentHighSeverityEvents(currentRange, 10),
          this.repo.countEvaluatedHighRiskUsers(resolved.prev),
          this.repo.countRiskEvents(resolved.prev),
        ]);
      return { evaluated, events, topTypes, buckets, recent, prevEvaluated, prevEvents };
    };
    const rangeData =
      query.window === 'custom'
        ? await loadRange()
        : await this.getOrSet(
          this.rangeCache,
          this.rangeKey('risk', systemId, resolved),
          loadRange,
        );
    const levelDistribution = await this.getOrSet(
      this.snapshotCache,
      `snapshot:risk:${systemId}`,
      async () => {
        const [userCount, grouped] = await Promise.all([
          this.repo.countUsersForRiskDistribution(),
          this.repo.groupRiskLevelDistribution(),
        ]);
        const L1 = grouped.L1 ?? 0;
        const L2 = grouped.L2 ?? 0;
        const L3 = grouped.L3 ?? 0;
        const explicitL0 = grouped.L0 ?? 0;
        const profileCount = explicitL0 + L1 + L2 + L3;
        return { L0: explicitL0 + Math.max(0, userCount - profileCount), L1, L2, L3 };
      },
    );
    const users = await this.repo.findUsersForDisplay(
      [...new Set(rangeData.recent.map((item) => item.userId))],
    );
    const userMap = new Map(users.map((item) => [item.id, item] as const));
    const bucketMap = new Map(rangeData.buckets.map((item) => [item.bucket, item.count]));

    return {
      range: buildResolvedRange(resolved),
      levelDistribution,
      evaluatedHighRiskUsersCount: rangeData.evaluated,
      eventCount: rangeData.events,
      topEventTypes: rangeData.topTypes,
      severityBuckets: (['A', 'B', 'C', 'D', 'E'] as const).map((bucket) => ({
        bucket,
        count: bucketMap.get(bucket) ?? 0,
      })),
      recentHighSeverityEvents: rangeData.recent.map((item) => ({
        id: item.id,
        userId: item.userId,
        displayName: toDisplayName(userMap.get(item.userId)),
        type: item.type,
        severity: item.severity,
        createdAt: item.createdAt.toISOString(),
      })),
      compareToPrev: {
        eventCountDeltaPct: deltaPct(rangeData.events, rangeData.prevEvents),
        evaluatedHighRiskUsersDeltaPct: deltaPct(
          rangeData.evaluated,
          rangeData.prevEvaluated,
        ),
      },
    };
  }
}
