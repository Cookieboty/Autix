import { galleryActions, type DirectVideoGenerationDto } from '@autix/shared-store';
import {
  summarizeSettled,
  type SettledSummary,
} from '../image/gallery-interaction-model';

/**
 * /ai/video 历史的纯逻辑（无 React、无 DOM），与 image 侧的 gallery-interaction-model 对称。
 *
 * 广场帖状态机（galleryPostActions）与图片完全共用 —— 后端是同一张 gallery_posts、
 * 同一套出边，视频没有任何特殊规则，复制一份只会漂。
 */

/** 直连生成状态机共六态：pending/queued/running/completed/failed/expired（见 VideoGenStatus）。 */
const PROCESSING_STATUSES = new Set(['pending', 'queued', 'running']);

export type VideoDisplayStatus = 'completed' | 'processing' | 'failed';

export function videoDisplayStatus(item: DirectVideoGenerationDto): VideoDisplayStatus {
  if (item.status === 'completed' && item.videoUrl) return 'completed';
  if (PROCESSING_STATUSES.has(item.status)) return 'processing';
  // failed / expired（以及理论上不该出现的 completed-without-url）统一按失败展示。
  return 'failed';
}

/**
 * 封面。thumbnailUrl / lastFrameUrl 都是服务端转存到 R2 的图（见后端
 * persistProviderImage）；两者皆无时退到输入素材，仍无则由调用方渲染占位。
 */
export function videoCover(item: DirectVideoGenerationDto): string | null {
  return (
    item.thumbnailUrl ??
    item.lastFrameUrl ??
    item.materials.find((material) => material.url)?.url ??
    null
  );
}

/** 参数里的画幅比 "16:9" → 1.777…；解析不出返回 undefined，由调用方决定占位比例。 */
export function parseRatioLabel(label: unknown): number | undefined {
  if (typeof label !== 'string') return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/i.exec(label.trim());
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return undefined;
  return width / height;
}

/** 视频还没加载出元数据时的占位比例：优先本次生成选择的 ratio，兜底 16:9。 */
export const DEFAULT_VIDEO_RATIO = 16 / 9;

export function videoSettingsRatio(item: DirectVideoGenerationDto): number {
  const options = item.options as { ratio?: unknown } | undefined;
  return parseRatioLabel(options?.ratio) ?? DEFAULT_VIDEO_RATIO;
}

/**
 * 一键投稿到广场（FROM_GENERATION → PENDING，先审后发）。
 *
 * 与图片侧的 publishSelectionsToGallery 同一契约，只是换成 kind='VIDEO' +
 * videoGenerationId：服务端据此查 video_clip_generations 派生 mediaUrls 与封面。
 * allowPublicReference 固定 true（产品决定参考图随帖公开，后端默认 fail-closed）。
 *
 * 视频一次生成只有一个产物，不存在图片那种「同一次生成勾多张」的去重问题，
 * 但仍按 id 去重以防调用方重复传入。
 */
export async function publishVideosToGallery(
  items: DirectVideoGenerationDto[],
): Promise<SettledSummary> {
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  const results = await Promise.allSettled(
    unique.map((item) =>
      galleryActions.publish({
        kind: 'VIDEO',
        title: item.prompt.slice(0, 60) || undefined,
        sourceType: 'FROM_GENERATION',
        videoGenerationId: item.id,
        allowPublicReference: true,
      }),
    ),
  );

  return summarizeSettled(results);
}
