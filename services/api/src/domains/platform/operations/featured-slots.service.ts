import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FeaturedSlot,
  MetricResourceType,
  ResolvedFeaturedSlot,
} from '@autix/domain';
import { FeaturedSlotKind, Prisma, ResourceType } from '../prisma/generated';
import { PrismaService } from '../prisma/prisma.service';
import {
  FeaturedSlotsRepository,
  UpdateFeaturedSlotData,
} from './featured-slots.repository';
import { assertFeaturedSlot, resolveSlot } from './featured-slots.helpers';
import { toDomainFeaturedSlot } from './featured-slots.mapper';

/** 控制器传入的创建入参：日期为 ISO 字符串（DTO 层已用 @IsDateString 校验）。 */
export interface CreateFeaturedSlotInput {
  placement: string;
  kind: FeaturedSlotKind;
  resourceType?: ResourceType | null;
  resourceId?: string | null;
  overrideTitle?: string | null;
  overrideDescription?: string | null;
  overrideCoverImage?: string | null;
  overrideCoverVideo?: string | null;
  overrideCtaText?: string | null;
  overrideCtaHref?: string | null;
  position?: number;
  isEnabled?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type UpdateFeaturedSlotInput = Omit<
  UpdateFeaturedSlotData,
  'startsAt' | 'endsAt'
> & {
  startsAt?: string | null;
  endsAt?: string | null;
};

export interface FeaturedSlotCandidate {
  id: string;
  title: string;
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/**
 * 运营位（Featured Slots）应用服务（gallery-design.md §5.5 / §十）。
 * 前台读路径：getResolvedByPlacement，只取 enabled + 排期命中的槽位并 resolveSlot。
 * 后台写路径：均先 assertFeaturedSlot 校验来源约束，再落库并写一条 admin_audit_logs。
 */
@Injectable()
export class FeaturedSlotsService {
  constructor(
    private readonly repo: FeaturedSlotsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** 前台：解析出 placement 下当前应展示的运营位（仅 enabled + 命中排期窗口）。 */
  async getResolvedByPlacement(
    placement: string,
  ): Promise<ResolvedFeaturedSlot[]> {
    const rows = await this.repo.listByPlacement(placement, {
      enabledOnly: true,
      now: new Date(),
    });
    return rows.map((row) => {
      const slot = toDomainFeaturedSlot(row);
      // TODO(P6): fetch source title/cover for RESOURCE slots（跨域读取模板/广场作品详情）
      const source = undefined;
      return resolveSlot(slot, source);
    });
  }

  /** 后台：某 placement 下的全部运营位（含禁用）。 */
  async listAdmin(placement: string): Promise<FeaturedSlot[]> {
    const rows = await this.repo.listAllByPlacement(placement);
    return rows.map(toDomainFeaturedSlot);
  }

  async createSlot(
    actorId: string,
    input: CreateFeaturedSlotInput,
  ): Promise<FeaturedSlot> {
    assertFeaturedSlot({
      kind: input.kind,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
    });

    let position = input.position;
    if (position === undefined) {
      const existing = await this.repo.listAllByPlacement(input.placement);
      position = existing.length;
    }

    const created = await this.repo.create({
      ...input,
      position,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
      createdById: actorId,
    });

    await this.writeAudit('featured.create', actorId, created.id, {
      after: created,
    });
    return toDomainFeaturedSlot(created);
  }

  async updateSlot(
    actorId: string,
    id: string,
    input: UpdateFeaturedSlotInput,
  ): Promise<FeaturedSlot> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('运营位不存在');
    }

    assertFeaturedSlot({
      kind: input.kind ?? existing.kind,
      resourceType:
        input.resourceType !== undefined
          ? input.resourceType
          : existing.resourceType,
      resourceId:
        input.resourceId !== undefined ? input.resourceId : existing.resourceId,
    });

    const updated = await this.repo.update(id, {
      ...input,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
    });
    await this.writeAudit('featured.update', actorId, id, {
      before: existing,
      after: updated,
    });
    return toDomainFeaturedSlot(updated);
  }

  async deleteSlot(actorId: string, id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('运营位不存在');
    }
    await this.repo.delete(id);
    await this.writeAudit('featured.delete', actorId, id, {
      before: existing,
    });
  }

  async reorder(
    actorId: string,
    placement: string,
    orderedIds: string[],
  ): Promise<FeaturedSlot[]> {
    const before = await this.repo.listAllByPlacement(placement);
    await this.repo.reorder(placement, orderedIds);
    const after = await this.repo.listAllByPlacement(placement);

    await this.writeAudit('featured.reorder', actorId, placement, {
      before: before.map((s) => s.id),
      after: after.map((s) => s.id),
    });
    return after.map(toDomainFeaturedSlot);
  }

  async searchCandidates(
    resourceType: MetricResourceType,
    query: string,
  ): Promise<FeaturedSlotCandidate[]> {
    const q = (query ?? '').trim();
    switch (resourceType) {
      case 'IMAGE_TEMPLATE':
        return this.repo.searchImageTemplateCandidates(q);
      case 'VIDEO_TEMPLATE':
        return this.repo.searchVideoTemplateCandidates(q);
      case 'GALLERY_POST': {
        const rows = await this.repo.searchGalleryPostCandidates(q);
        return rows.map((r) => ({ id: r.id, title: r.title ?? '(无标题)' }));
      }
      default:
        return [];
    }
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
          targetType: 'featured_slot',
          targetId,
          ...payload,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
