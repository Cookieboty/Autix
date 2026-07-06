import { BadRequestException } from '@nestjs/common';
import type { GalleryKind, GallerySource, GalleryStatus } from '@autix/domain';

export type GalleryActor = 'author' | 'admin' | 'system';

/** 合法状态转移 → 允许的触发角色（见 gallery-design.md §5.1.1）。 */
const TRANSITIONS: Record<string, GalleryActor[]> = {
  'DRAFT->PENDING': ['author'],
  'PENDING->REJECTED': ['system', 'admin'],
  'PENDING->PUBLISHED': ['admin'],
  'REJECTED->PENDING': ['author'],
  'PUBLISHED->HIDDEN': ['system', 'admin'],
  'HIDDEN->PUBLISHED': ['admin'],
  'PUBLISHED->REMOVED': ['author', 'admin'],
  'HIDDEN->REMOVED': ['author', 'admin'],
};

/** 校验状态机转移；非法转移 / 角色无权 → 400。 */
export function assertTransition(
  from: GalleryStatus,
  to: GalleryStatus,
  actor: GalleryActor,
): void {
  const allowed = TRANSITIONS[`${from}->${to}`];
  if (!allowed) {
    throw new BadRequestException(`非法状态转移: ${from} → ${to}`);
  }
  if (!allowed.includes(actor)) {
    throw new BadRequestException(
      `角色 ${actor} 无权执行 ${from} → ${to}（需 ${allowed.join('/')}）`,
    );
  }
}

export interface GallerySourcePayload {
  kind: GalleryKind;
  sourceType: GallerySource;
  mediaUrls?: string[];
  imageTemplateId?: string | null;
  videoTemplateId?: string | null;
  imageGenerationId?: string | null;
  videoGenerationId?: string | null;
}

/**
 * 校验投稿来源字段与 sourceType 的对应关系（见 §6.4）。纯字段校验；
 * `FROM_GENERATION` 的 generation.userId === authorId 归属校验在 service 层做（需查库）。
 */
export function assertSource(
  p: GallerySourcePayload,
  actor: GalleryActor,
): void {
  const hasTemplate = !!(p.imageTemplateId || p.videoTemplateId);
  const hasGeneration = !!(p.imageGenerationId || p.videoGenerationId);
  const matchesKind = (image?: string | null, video?: string | null) =>
    p.kind === 'IMAGE' ? !!image && !video : !!video && !image;

  switch (p.sourceType) {
    case 'USER_UPLOAD':
      if (hasTemplate || hasGeneration) {
        throw new BadRequestException('USER_UPLOAD 不允许携带模板/生成引用');
      }
      if (!p.mediaUrls || p.mediaUrls.length === 0) {
        throw new BadRequestException('USER_UPLOAD 必须提供 mediaUrls');
      }
      return;

    case 'FROM_GENERATION':
      if (!matchesKind(p.imageGenerationId, p.videoGenerationId)) {
        throw new BadRequestException(
          'FROM_GENERATION 需提供与 kind 一致的单一 generationId',
        );
      }
      return;

    case 'FROM_TEMPLATE':
      if (hasGeneration) {
        throw new BadRequestException('FROM_TEMPLATE 不允许携带生成引用');
      }
      if (!matchesKind(p.imageTemplateId, p.videoTemplateId)) {
        throw new BadRequestException(
          'FROM_TEMPLATE 需提供与 kind 一致的单一 templateId',
        );
      }
      return;

    case 'ADMIN_CURATED':
      if (actor !== 'admin') {
        throw new BadRequestException('ADMIN_CURATED 仅管理员可创建');
      }
      return;
  }
}
