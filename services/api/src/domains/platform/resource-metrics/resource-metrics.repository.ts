import { Injectable } from '@nestjs/common';
import { Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

type CounterField =
  | 'likeCount'
  | 'favoriteCount'
  | 'shareCount'
  | 'referenceCount';

/**
 * I1：DECR 路径改为原子 SQL，列名必须来自本白名单——禁止把 `field` 参数（哪怕类型已收窄）
 * 直接拼进原始 SQL 字符串，任何新增计数器字段都必须显式在这里登记后才能被解出真实列名。
 */
const COUNTER_COLUMNS: Record<CounterField, string> = {
  likeCount: 'likeCount',
  favoriteCount: 'favoriteCount',
  shareCount: 'shareCount',
  referenceCount: 'referenceCount',
};

/**
 * 统一指标 / 互动体系的数据访问层（见 gallery-design.md §9）。
 * 读 resource_metrics 不建行；写路径（like/favorite/share/recordReference）
 * 全部在单个事务内完成"互动明细表写入 + 计数器 INCR/DECR + lastActivityAt 刷新"。
 */
@Injectable()
export class ResourceMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMetrics(resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_metrics.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } },
    });
  }

  /** 近期活跃资源（lastActivityAt >= since），供热度重算 cron 使用。 */
  findActiveSince(since: Date) {
    return this.prisma.resource_metrics.findMany({
      where: { lastActivityAt: { gte: since } },
    });
  }

  /** SET（非 INCR）hotScore + 刷新 hotScoreVersion，供热度重算幂等写回使用。 */
  setHotScore(
    resourceType: ResourceType,
    resourceId: string,
    hotScore: number,
    hotScoreVersion: string,
  ) {
    return this.prisma.resource_metrics.update({
      where: { resourceType_resourceId: { resourceType, resourceId } },
      data: { hotScore, hotScoreVersion },
    });
  }

  like(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.resource_likes.findUnique({
        where: {
          userId_resourceType_resourceId: { userId, resourceType, resourceId },
        },
      });
      if (!existing) {
        await tx.resource_likes.create({
          data: { userId, resourceType, resourceId },
        });
        await this.bumpCounter(tx, resourceType, resourceId, 'likeCount', 1);
      }
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  unlike(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.resource_likes.findUnique({
        where: {
          userId_resourceType_resourceId: { userId, resourceType, resourceId },
        },
      });
      if (existing) {
        await tx.resource_likes.delete({ where: { id: existing.id } });
        await this.bumpCounter(tx, resourceType, resourceId, 'likeCount', -1);
      }
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  favorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.resource_favorites.findUnique({
        where: {
          userId_resourceType_resourceId: { userId, resourceType, resourceId },
        },
      });
      if (!existing) {
        await tx.resource_favorites.create({
          data: { userId, resourceType, resourceId },
        });
        await this.bumpCounter(tx, resourceType, resourceId, 'favoriteCount', 1);
      }
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  unfavorite(userId: string, resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.resource_favorites.findUnique({
        where: {
          userId_resourceType_resourceId: { userId, resourceType, resourceId },
        },
      });
      if (existing) {
        await tx.resource_favorites.delete({ where: { id: existing.id } });
        await this.bumpCounter(tx, resourceType, resourceId, 'favoriteCount', -1);
      }
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  share(resourceType: ResourceType, resourceId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.bumpCounter(tx, resourceType, resourceId, 'shareCount', 1);
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  /** 供其它域调用：追加一条引用事件（resource_reference_events）并 INCR referenceCount。 */
  recordReference(
    resourceType: ResourceType,
    resourceId: string,
    refType: string,
    refUserId?: string,
    refPayload?: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.resource_reference_events.create({
        data: {
          resourceType,
          resourceId,
          refType,
          refUserId: refUserId ?? null,
          refPayload: refPayload ?? Prisma.JsonNull,
        },
      });
      await this.bumpCounter(tx, resourceType, resourceId, 'referenceCount', 1);
      return this.readMetrics(tx, resourceType, resourceId);
    });
  }

  private readMetrics(tx: Tx, resourceType: ResourceType, resourceId: string) {
    return tx.resource_metrics.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } },
    });
  }

  /**
   * INCR/DECR 单个计数器，并顺带把 lastActivityAt 刷新为 now。
   * - INCR：upsert，行不存在则以 1 建行，存在则原子 increment（无需先读）。
   * - DECR（I1）：改为原子 SQL `GREATEST(col - 1, 0)`，避免"先读后写"在并发点赞/取消下
   *   丢更新或漂移；若行本就不存在则是 no-op（没有可扣减的行本就正确，无需建行）。
   */
  private async bumpCounter(
    tx: Tx,
    resourceType: ResourceType,
    resourceId: string,
    field: CounterField,
    delta: 1 | -1,
  ) {
    const now = new Date();

    if (delta > 0) {
      const create: Prisma.resource_metricsUncheckedCreateInput = {
        resourceType,
        resourceId,
        lastActivityAt: now,
        [field]: 1,
      };
      const update: Prisma.resource_metricsUncheckedUpdateInput = {
        lastActivityAt: now,
        [field]: { increment: 1 },
      };
      await tx.resource_metrics.upsert({
        where: { resourceType_resourceId: { resourceType, resourceId } },
        create,
        update,
      });
      return;
    }

    const column = COUNTER_COLUMNS[field];
    if (!column) {
      // 理论上不可达（field 类型已被 CounterField 收窄），但显式白名单校验防御性拦截。
      throw new Error(`未知计数器字段: ${field}`);
    }
    await tx.$executeRaw`
      UPDATE "resource_metrics"
      SET ${Prisma.raw(`"${column}"`)} = GREATEST(${Prisma.raw(`"${column}"`)} - 1, 0),
          "lastActivityAt" = ${now},
          "updatedAt" = ${now}
      WHERE "resourceType" = ${resourceType}::"ResourceType" AND "resourceId" = ${resourceId}
    `;
  }
}
