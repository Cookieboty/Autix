import { BadRequestException } from '@nestjs/common';
import type { FeaturedSlot, ResolvedFeaturedSlot } from '@autix/domain';

/** 来源资源在运营位展示所需的字段（模板/广场作品解析后传入）。 */
export interface FeaturedSlotSource {
  title?: string | null;
  description?: string | null;
  coverImage?: string | null;
  coverVideo?: string | null;
  href?: string | null;
}

/**
 * 合并运营位与来源资源为展示单元：`override ?? source.field`（§十）。
 * CUSTOM 时 source 为空，全部取 override；**永不写回原资源**。
 */
export function resolveSlot(
  slot: FeaturedSlot,
  source?: FeaturedSlotSource | null,
): ResolvedFeaturedSlot {
  const s = source ?? {};
  return {
    id: slot.id,
    kind: slot.kind,
    title: slot.overrideTitle ?? s.title ?? null,
    description: slot.overrideDescription ?? s.description ?? null,
    coverImage: slot.overrideCoverImage ?? s.coverImage ?? null,
    coverVideo: slot.overrideCoverVideo ?? s.coverVideo ?? null,
    ctaText: slot.overrideCtaText ?? null,
    ctaHref: slot.overrideCtaHref ?? s.href ?? null,
  };
}

/** 校验运营位来源约束（§5.5）：RESOURCE 必须有 type+id；CUSTOM 必须都空。 */
export function assertFeaturedSlot(
  slot: Pick<FeaturedSlot, 'kind' | 'resourceType' | 'resourceId'>,
): void {
  if (slot.kind === 'RESOURCE') {
    if (!slot.resourceType || !slot.resourceId) {
      throw new BadRequestException(
        'kind=RESOURCE must provide resourceType + resourceId',
      );
    }
    return;
  }
  // CUSTOM
  if (slot.resourceType || slot.resourceId) {
    throw new BadRequestException('kind=CUSTOM must not carry resourceType/resourceId');
  }
}
