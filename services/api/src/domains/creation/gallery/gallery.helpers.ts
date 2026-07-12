import { BadRequestException } from '@nestjs/common';
import type { GalleryKind, GallerySource, GalleryStatus } from '@autix/domain';
import {
  GalleryStatus as PGStatus,
  Prisma,
} from '../../platform/prisma/generated';

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
  // I5：作者可删除自己尚未发布的草稿/待审/被拒作品（DELETE /gallery/:id）。
  'DRAFT->REMOVED': ['author'],
  'PENDING->REMOVED': ['author'],
  'REJECTED->REMOVED': ['author'],
  // UNPUBLISHED：作者可自行下架已发布作品，也可重新提交进入审核；
  // 注意 republish 只接受 UNPUBLISHED，HIDDEN（被处罚下架）不在此表中 → 找不到转移项直接 400，
  // 防止作者绕开管理员处罚自行"重新发布"。'HIDDEN->PUBLISHED' 已在上方以 admin-only 定义（unhide）。
  'PUBLISHED->UNPUBLISHED': ['author'],
  'UNPUBLISHED->PENDING': ['author'],
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
      if (hasTemplate) {
        throw new BadRequestException('FROM_GENERATION 不允许携带模板引用');
      }
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

    default:
      throw new BadRequestException(`未知来源类型: ${p.sourceType as string}`);
  }
}

// ── 管理端广场列表：分页 + 筛选 ────────────────────────────────────────────
const ADMIN_STATUSES: GalleryStatus[] = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED', 'UNPUBLISHED'];
const ADMIN_KINDS: GalleryKind[] = ['IMAGE', 'VIDEO'];
const ADMIN_SOURCE_TYPES: GallerySource[] = [
  'USER_UPLOAD',
  'FROM_GENERATION',
  'FROM_TEMPLATE',
];

export const ADMIN_GALLERY_DEFAULT_PAGE_SIZE = 20;
export const ADMIN_GALLERY_MAX_PAGE_SIZE = 100;

export interface AdminGalleryQuery {
  status?: GalleryStatus;
  kind?: GalleryKind;
  category?: string;
  sourceType?: GallerySource;
  search?: string;
  /** 仅显示"非我域名"（coverImage 不在自有 R2）的作品 */
  externalOnly: boolean;
  page: number;
  pageSize: number;
}

function pickEnum<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 把原始 query 归一化为受控的分页/筛选参数（非法值回退默认，pageSize 夹 1..100）。 */
export function normalizeAdminGalleryQuery(raw: {
  status?: unknown;
  kind?: unknown;
  category?: unknown;
  sourceType?: unknown;
  search?: unknown;
  externalOnly?: unknown;
  page?: unknown;
  pageSize?: unknown;
}): AdminGalleryQuery {
  const category = typeof raw.category === 'string' ? raw.category.trim() : '';
  const search = typeof raw.search === 'string' ? raw.search.trim() : '';
  return {
    status: pickEnum(ADMIN_STATUSES, raw.status),
    kind: pickEnum(ADMIN_KINDS, raw.kind),
    category: category || undefined,
    sourceType: pickEnum(ADMIN_SOURCE_TYPES, raw.sourceType),
    search: search || undefined,
    externalOnly: toBool(raw.externalOnly),
    page: toPositiveInt(raw.page, 1),
    pageSize: Math.min(
      toPositiveInt(raw.pageSize, ADMIN_GALLERY_DEFAULT_PAGE_SIZE),
      ADMIN_GALLERY_MAX_PAGE_SIZE,
    ),
  };
}

/**
 * 由归一化后的筛选拼 Prisma where。
 * - 指定 status 精确过滤；未指定则排除 REMOVED（不展示已删除）。
 * - externalOnly 且 R2 公网域名已知：只留 coverImage 非空且不以该域名开头的作品（非我域名）。
 */
export function buildAdminGalleryWhere(
  q: AdminGalleryQuery,
  r2PublicBase: string | null,
): Prisma.gallery_postsWhereInput {
  const where: Prisma.gallery_postsWhereInput = {
    status: q.status ? (q.status as PGStatus) : { not: PGStatus.REMOVED },
  };
  if (q.kind) where.kind = q.kind as Prisma.gallery_postsWhereInput['kind'];
  if (q.category) where.category = q.category;
  if (q.sourceType) where.sourceType = q.sourceType as Prisma.gallery_postsWhereInput['sourceType'];
  if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
  if (q.externalOnly && r2PublicBase) {
    where.AND = [
      { coverImage: { not: null } },
      { NOT: { coverImage: { startsWith: r2PublicBase } } },
    ];
  }
  return where;
}
