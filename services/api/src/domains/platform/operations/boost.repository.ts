import { Injectable } from '@nestjs/common';
import { BoostReason, Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBoostData {
  resourceType: ResourceType;
  resourceId: string;
  boostScore: number;
  reason?: BoostReason;
  note?: string | null;
  startsAt?: Date;
  endsAt: Date;
  createdById: string;
}

export interface UpdateBoostData {
  boostScore?: number;
  reason?: BoostReason;
  note?: string | null;
  startsAt?: Date;
  endsAt?: Date;
}

/** 某资源当前生效加热的汇总：SUM(boostScore) + MAX(endsAt)（§十一）。 */
export interface ActiveBoostSum {
  resourceType: ResourceType;
  resourceId: string;
  boostScore: number;
  expiresAt: Date | null;
}

/**
 * 内容加热（resource_boosts）数据访问层。见 gallery-design.md §十一。
 * `sumActiveByResource` / `findMetricsWithPositiveBoost` / `upsertMetricBoost` /
 * `resetMetricBoost` 四个方法专供 `boost.service.ts#aggregateActiveBoosts` 幂等聚合使用。
 */
@Injectable()
export class BoostRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.resource_boosts.findUnique({ where: { id } });
  }

  list(opts: { resourceType?: ResourceType; query?: string } = {}) {
    const { resourceType, query } = opts;
    const where: Prisma.resource_boostsWhereInput = {
      ...(resourceType ? { resourceType } : {}),
      ...(query ? { resourceId: { contains: query, mode: 'insensitive' } } : {}),
    };
    return this.prisma.resource_boosts.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: CreateBoostData) {
    return this.prisma.resource_boosts.create({ data });
  }

  update(id: string, data: UpdateBoostData) {
    return this.prisma.resource_boosts.update({ where: { id }, data });
  }

  /** 撤销：仅置 isActive=false，历史记录保留供审计。 */
  revoke(id: string) {
    return this.prisma.resource_boosts.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * 当前生效（isActive && startsAt<=now<=endsAt）加热按资源分组求和。
   * 只返回"存在至少一条生效加热"的资源；无生效加热的资源不出现在结果里
   * （由调用方 `findMetricsWithPositiveBoost` 负责识别并清零）。
   */
  async sumActiveByResource(now: Date): Promise<ActiveBoostSum[]> {
    const rows = await this.prisma.resource_boosts.groupBy({
      by: ['resourceType', 'resourceId'],
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      _sum: { boostScore: true },
      _max: { endsAt: true },
    });
    return rows.map((row) => ({
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      boostScore: row._sum.boostScore ?? 0,
      expiresAt: row._max.endsAt ?? null,
    }));
  }

  /** 当前 metrics.boostScore>0 的资源清单，用于识别"加热已过期/被撤销"需要清零的资源。 */
  findMetricsWithPositiveBoost() {
    return this.prisma.resource_metrics.findMany({
      where: { boostScore: { gt: 0 } },
      select: { resourceType: true, resourceId: true },
    });
  }

  /** SET（非 INCR）resource_metrics.boostScore/boostExpiresAt；行不存在则建行。 */
  upsertMetricBoost(
    resourceType: ResourceType,
    resourceId: string,
    boostScore: number,
    boostExpiresAt: Date | null,
  ) {
    return this.prisma.resource_metrics.upsert({
      where: { resourceType_resourceId: { resourceType, resourceId } },
      create: { resourceType, resourceId, boostScore, boostExpiresAt },
      update: { boostScore, boostExpiresAt },
    });
  }

  /** 清零：资源已无生效加热时复位（updateMany 避免行不存在时报错）。 */
  resetMetricBoost(resourceType: ResourceType, resourceId: string) {
    return this.prisma.resource_metrics.updateMany({
      where: { resourceType, resourceId },
      data: { boostScore: 0, boostExpiresAt: null },
    });
  }
}
