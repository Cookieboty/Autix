import type { FeaturedSlot, MetricResourceType } from '@autix/domain';
import type { featured_slots as FeaturedSlotRow } from '../prisma/generated';

/** Prisma 行 → 领域类型：Date 转 ISO 字符串，resourceType 字面量对齐（见 domain/gallery/types.ts 注释）。 */
export function toDomainFeaturedSlot(row: FeaturedSlotRow): FeaturedSlot {
  return {
    id: row.id,
    placement: row.placement,
    kind: row.kind,
    resourceType: (row.resourceType as MetricResourceType | null) ?? null,
    resourceId: row.resourceId,
    overrideTitle: row.overrideTitle,
    overrideDescription: row.overrideDescription,
    overrideCoverImage: row.overrideCoverImage,
    overrideCoverVideo: row.overrideCoverVideo,
    overrideCtaText: row.overrideCtaText,
    overrideCtaHref: row.overrideCtaHref,
    position: row.position,
    isEnabled: row.isEnabled,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  };
}
