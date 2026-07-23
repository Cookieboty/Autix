import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BoostReason, Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import { isMetricResourceType } from '../prisma/resource-type.helpers';
import { BoostRepository, UpdateBoostData } from './boost.repository';
import { isBoostActiveAt } from './boost.helpers';
import { ResourceVisibilityRepository } from './resource-visibility.repository';

/** 控制器传入的创建入参：日期为 ISO 字符串（DTO 层已用 @IsDateString 校验）。 */
export interface CreateBoostInput {
  boostScore: number;
  reason?: BoostReason;
  note?: string | null;
  startsAt?: string;
  endsAt: string;
}

export type UpdateBoostInput = Omit<UpdateBoostData, 'startsAt' | 'endsAt'> & {
  startsAt?: string;
  endsAt?: string;
};

function toDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

/**
 * 内容加热（Boost）应用服务（gallery-design.md §十一）。
 * 写路径（createBoost/updateBoost/revokeBoost）均写一条 admin_audit_logs。
 * `aggregateActiveBoosts` 是幂等聚合：把"当前生效加热 SUM"整体 SET 进
 * `resource_metrics.boostScore`（而非 INCR），重复调用结果一致；对已无生效
 * 加热但历史 boostScore>0 的资源清零。供 cron 调用。
 */
@Injectable()
export class BoostService {
  constructor(
    private readonly repo: BoostRepository,
    private readonly prisma: PrismaService,
    private readonly resourceVisibility: ResourceVisibilityRepository,
  ) {}

  async createBoost(
    actorId: string,
    resourceTypeRaw: string,
    resourceId: string,
    input: CreateBoostInput,
  ) {
    const resourceType = this.assertResourceType(resourceTypeRaw);
    await this.resourceVisibility.assertResourceVisible(resourceType, resourceId);

    const created = await this.repo.create({
      resourceType,
      resourceId,
      boostScore: input.boostScore,
      reason: input.reason,
      note: input.note ?? null,
      startsAt: toDate(input.startsAt),
      endsAt: new Date(input.endsAt),
      createdById: actorId,
    });

    await this.writeAudit('boost.create', actorId, created.id, { after: created });
    return created;
  }

  async updateBoost(actorId: string, id: string, input: UpdateBoostInput) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Boost record not found');
    }

    const updated = await this.repo.update(id, {
      ...input,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
    });

    await this.writeAudit('boost.update', actorId, id, {
      before: existing,
      after: updated,
    });
    return updated;
  }

  async revokeBoost(actorId: string, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Boost record not found');
    }

    const revoked = await this.repo.revoke(id);
    await this.writeAudit('boost.revoke', actorId, id, { before: existing });
    return revoked;
  }

  async listBoosts(opts: { resourceType?: ResourceType; query?: string } = {}) {
    const rows = await this.repo.list(opts);
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      isCurrentlyActive: isBoostActiveAt(row, now),
    }));
  }

  async aggregateActiveBoosts(now: Date = new Date()): Promise<void> {
    const sums = await this.repo.sumActiveByResource(now);
    const touched = new Set<string>();

    for (const sum of sums) {
      touched.add(`${sum.resourceType}:${sum.resourceId}`);
      await this.repo.upsertMetricBoost(
        sum.resourceType,
        sum.resourceId,
        sum.boostScore,
        sum.expiresAt,
      );
    }

    const positives = await this.repo.findMetricsWithPositiveBoost();
    for (const metric of positives) {
      const key = `${metric.resourceType}:${metric.resourceId}`;
      if (!touched.has(key)) {
        await this.repo.resetMetricBoost(metric.resourceType, metric.resourceId);
      }
    }
  }

  private assertResourceType(raw: string): ResourceType {
    if (!isMetricResourceType(raw as ResourceType)) {
      throw new BadRequestException(`Unsupported resource type: ${raw}`);
    }
    return raw as ResourceType;
  }

  private async writeAudit(
    action: string,
    actorId: string,
    targetId: string,
    payload: { before?: unknown; after?: unknown },
  ): Promise<void> {
    await this.prisma.admin_audit_logs.create({
      data: {
        action,
        actorId,
        payload: {
          targetType: 'resource_boost',
          targetId,
          ...payload,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
