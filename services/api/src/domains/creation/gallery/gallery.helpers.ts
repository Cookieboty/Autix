import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { GalleryKind, GallerySource, GalleryStatus } from '@autix/domain';
import {
  GalleryStatus as PGStatus,
  Prisma,
} from '../../platform/prisma/generated';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

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
  // 作者自愿下架的作品，作者有权彻底删除。缺这条会导致 UNPUBLISHED 成为无法离开的终态，
  // 连带使其来源生成记录永远删不掉（见删除守卫）。不影响 HIDDEN 的防处罚绕过设计：
  // republish 依然只接受 UNPUBLISHED，HIDDEN 无法回到 PUBLISHED。
  'UNPUBLISHED->REMOVED': ['author'],
};

/** 校验状态机转移；非法转移 / 角色无权 → 400。 */
export function assertTransition(
  from: GalleryStatus,
  to: GalleryStatus,
  actor: GalleryActor,
): void {
  const allowed = TRANSITIONS[`${from}->${to}`];
  if (!allowed) {
    throw new I18nHttpException(
      HttpStatus.BAD_REQUEST,
      'creation.gallery.helpers.illegal_transition',
      { from, to },
    );
  }
  if (!allowed.includes(actor)) {
    throw new I18nHttpException(
      HttpStatus.BAD_REQUEST,
      'creation.gallery.helpers.transition_forbidden',
      { actor, from, to, roles: allowed.join('/') },
    );
  }
}

export interface GallerySourcePayload {
  kind: GalleryKind;
  sourceType: GallerySource;
  mediaUrls?: string[];
  /** 目前仅 ADMIN_CURATED 分支校验；见 BatchJobService.createAndProcess 是否透传。 */
  coverImage?: string | null;
  imageTemplateId?: string | null;
  videoTemplateId?: string | null;
  imageGenerationId?: string | null;
  videoGenerationId?: string | null;
}

/**
 * 纯字符串形态校验：是否为可解析的 http(s) URL（不判断是否站内，那是 isInStationMediaUrl 的事）。
 * 用 WHATWG `new URL()` 解析而非裸正则，语义偏"宽"：scheme 大小写不敏感（`HTTP://x` 合法）、
 * 自动剥离首尾空白/控制字符、`https:/x` 单斜杠会被规范化为 `https://x`。
 *
 * 这是导入侧（assertSource）与搬运 worker 侧（ResourceMigrationService.isUrl）**共用的唯一**
 * URL 合法性判定——历史上两侧曾各写一套（worker 用大小写敏感的 `/^https?:\/\/.+/`），导致
 * `HTTP://x/a.png` 这类值被导入放行、却被 worker 判定为不合法而永久卡在 PENDING。收敛于此，
 * 任何一侧要放宽/收紧判定，都只改这一处。
 */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
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
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.user_upload_no_refs',
        );
      }
      if (!p.mediaUrls || p.mediaUrls.length === 0) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.user_upload_requires_media',
        );
      }
      return;

    case 'FROM_GENERATION':
      if (hasTemplate) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.from_generation_no_template',
        );
      }
      if (!matchesKind(p.imageGenerationId, p.videoGenerationId)) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.from_generation_single_id',
        );
      }
      return;

    case 'FROM_TEMPLATE':
      if (hasGeneration) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.from_template_no_generation',
        );
      }
      if (!matchesKind(p.imageTemplateId, p.videoTemplateId)) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.from_template_single_id',
        );
      }
      return;

    // 管理端 JSON 导入：与 USER_UPLOAD 一样是"直接给媒体"，但允许外链
    // （由 mediaMigrated=false + 迁移 worker 兜底搬进站内）。
    case 'ADMIN_CURATED':
      if (hasTemplate || hasGeneration) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.admin_curated_no_refs',
        );
      }
      if (!p.mediaUrls || p.mediaUrls.length === 0) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.admin_curated_requires_media',
        );
      }
      // Fix 1a：非 URL 的媒体条目若在此放行，会被迁移 worker 的 isUrl 判定原样跳过
      // （不 push error），进而 errors.length===0 → mediaMigrated=true → 自动发布一条
      // 从未被搬运校验过的"媒体"。必须在导入这一步就拒绝，让管理员在 errorLog 里看见。
      if (p.mediaUrls.some((url) => !isHttpUrl(url))) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.admin_curated_media_http',
        );
      }
      if (p.coverImage != null && p.coverImage.trim() !== '' && !isHttpUrl(p.coverImage)) {
        throw new I18nHttpException(
          HttpStatus.BAD_REQUEST,
          'creation.gallery.helpers.admin_curated_cover_http',
        );
      }
      return;

    default:
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'creation.gallery.helpers.unknown_source_type',
        { sourceType: p.sourceType as string },
      );
  }
}

// ── 站内来源写入守卫（Task 4.5：落实"所有资源来自站内"） ──────────────────
/**
 * 校验一个 URL 是否命中允许的站内存储域名（origin 精确匹配：protocol+host 相等，
 * 且 pathname 落在 base 的路径前缀内）。用 URL 解析而非裸字符串 `startsWith`，
 * 避免 `https://mycdn.com.evil.com/x.png` 这类前缀绕过（该串按字符串确实以
 * `https://mycdn.com` 开头，但 host 完全不同）。
 * 传入的 base 是 CloudflareR2Service.getPublicBaseUrl() 的返回值（唯一权威来源，
 * 见 system-settings `storage.r2PublicUrl` / env `DOMAIN`|`R2_PUBLIC_URL`）。
 */
export function isInStationMediaUrl(
  url: string,
  allowedBaseUrls: readonly (string | null | undefined)[],
): boolean {
  if (!url) return false;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  return allowedBaseUrls.some((base) => {
    if (!base) return false;
    let b: URL;
    try {
      b = new URL(base);
    } catch {
      return false;
    }
    if (target.protocol !== b.protocol || target.host !== b.host) return false;
    const basePath = b.pathname === '/' ? '' : b.pathname;
    return target.pathname.startsWith(basePath);
  });
}

/**
 * 校验一组 URL 全部命中站内存储域名；任意一个非站内即 400（fail-closed）。
 * gallery（USER_UPLOAD）/ materials.create / 管理端模板创建共用同一判定。
 */
export function assertInStationMediaUrls(
  urls: readonly string[],
  allowedBaseUrls: readonly (string | null | undefined)[],
  message = 'only media links stored on our platform are allowed',
): void {
  for (const url of urls) {
    if (!isInStationMediaUrl(url, allowedBaseUrls)) {
      throw new BadRequestException(message);
    }
  }
}

// ── 管理端广场列表：分页 + 筛选 ────────────────────────────────────────────

// 搬不动的作品会滞留 PENDING 不发布，代价远高于旧设计（旧设计放弃=带外链继续发布），
// 故给瞬时故障（503/超时）留重试余地。达上限后由 findPostsPendingMediaMigration 的
// attempts < maxAttempts 条件自然掉出队列 —— 这也是「搬运失败」筛选判定"已止损"的同一上限，
// 与 GalleryMediaMigrationService 共用同一常量，避免两处静默错位（worker 改了阈值、筛选却按旧值找）。
export const GALLERY_MEDIA_MIGRATION_MAX_ATTEMPTS = 3;

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
  /** 仅显示"搬运失败"（mediaMigrated=false 且已达重试上限、worker 已止损）的作品 */
  migrationFailed: boolean;
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
  migrationFailed?: unknown;
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
    migrationFailed: toBool(raw.migrationFailed),
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

  // 多个筛选各自往 AND 数组里 push 自己的条件，而不是整段赋值 where.AND ——
  // 直接赋值会让后写入的筛选把先写入的整个覆盖掉（两个筛选同时勾选时静默少过滤一个条件）。
  const and: Prisma.gallery_postsWhereInput[] = [];
  if (q.externalOnly && r2PublicBase) {
    and.push(
      { coverImage: { not: null } },
      { NOT: { coverImage: { startsWith: r2PublicBase } } },
    );
  }
  if (q.migrationFailed) {
    and.push(
      { mediaMigrated: false },
      { mediaMigrationAttempts: { gte: GALLERY_MEDIA_MIGRATION_MAX_ATTEMPTS } },
    );
  }
  if (and.length > 0) where.AND = and;

  return where;
}
