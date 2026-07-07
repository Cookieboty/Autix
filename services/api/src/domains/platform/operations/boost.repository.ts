import { Injectable } from '@nestjs/common';
import { BoostReason, Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { decayedBoostSum } from './boost.helpers';

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
   * P2：不再用 DB `groupBy` 做常量求和——改为逐条取出生效加热记录，交给纯函数
   * `decayedBoostSum` 按各自 age 做半衰期衰减后再分组求和，这样加热强度会随时间
   * 平滑回落而非恒定到期骤降。只返回"存在至少一条生效加热"的资源；无生效加热的
   * 资源不出现在结果里（由调用方 `findMetricsWithPositiveBoost` 负责识别并清零）。
   */
  async sumActiveByResource(now: Date): Promise<ActiveBoostSum[]> {
    const rows = await this.prisma.resource_boosts.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: {
        resourceType: true,
        resourceId: true,
        boostScore: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return decayedBoostSum(rows, now) as ActiveBoostSum[];
  }

  /** 当前 metrics.boostScore>0 的资源清单，用于识别"加热已过期/被撤销"需要清零的资源。 */
  findMetricsWithPositiveBoost() {
    return this.prisma.resource_metrics.findMany({
      where: { boostScore: { gt: 0 } },
      select: { resourceType: true, resourceId: true },
    });
  }

  /**
   * SET（非 INCR）resource_metrics.boostScore/boostExpiresAt；行不存在则建行。
   * I2：同时刷新 lastActivityAt，否则纯靠加热（无 PV/UV/互动）的资源会掉出
   * recomputeHotScores 的活跃窗口，加热永远不会体现到 hotScore 上。
   */
  upsertMetricBoost(
    resourceType: ResourceType,
    resourceId: string,
    boostScore: number,
    boostExpiresAt: Date | null,
  ) {
    const now = new Date();
    return this.prisma.resource_metrics.upsert({
      where: { resourceType_resourceId: { resourceType, resourceId } },
      create: { resourceType, resourceId, boostScore, boostExpiresAt, lastActivityAt: now },
      update: { boostScore, boostExpiresAt, lastActivityAt: now },
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
