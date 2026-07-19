import { galleryActions, type MaterialAsset } from '@autix/shared-store';

/**
 * 素材 → 广场投稿。
 *
 * 素材本身不带 generationId，但生成素材的 sourceId 是 `<generationId>::<下标>`
 * （见 api 侧 buildGenerationSourceId），据此反解即可复用广场的 FROM_GENERATION 投稿。
 *
 * 不复用 publishSelectionsToGallery：它吃的是 PublicImageHistoryItem/Image，
 * 为了调它得凭空捏一组假的历史对象，那比直接调 galleryActions.publish 更绕也更脆。
 */

/** 与 api 的 GENERATION_SOURCE_SEPARATOR 对齐。 */
const SOURCE_SEPARATOR = '::';

/** 非生成来源（上传/收藏/历史）的素材没有 generationId，返回 null。 */
export function generationIdFromAsset(asset: MaterialAsset): string | null {
  if (asset.librarySource !== 'GENERATION') return null;
  const sourceId = asset.sourceId;
  if (!sourceId) return null;
  const separatorAt = sourceId.lastIndexOf(SOURCE_SEPARATOR);
  if (separatorAt <= 0) return null;
  return sourceId.slice(0, separatorAt);
}

export interface AssetPublishPlan {
  /** 去重后可投稿的生成条目（一次生成多张图只投一次稿）。 */
  entries: Array<{ generationId: string; kind: 'IMAGE' | 'VIDEO'; title: string }>;
  /** 无法投稿的素材数（非生成来源，或既非图片也非视频）。 */
  skipped: number;
}

/** 素材类型 → 广场 kind；音频等暂无投稿入口，返回 null。 */
function galleryKindOf(type: MaterialAsset['type']): 'IMAGE' | 'VIDEO' | null {
  if (type === 'image') return 'IMAGE';
  if (type === 'video') return 'VIDEO';
  return null;
}

export function planAssetPublish(assets: MaterialAsset[]): AssetPublishPlan {
  const entries: AssetPublishPlan['entries'] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const asset of assets) {
    const kind = galleryKindOf(asset.type);
    const generationId = kind ? generationIdFromAsset(asset) : null;
    if (!kind || !generationId) {
      skipped += 1;
      continue;
    }
    if (!seen.has(generationId)) {
      seen.add(generationId);
      entries.push({ generationId, kind, title: asset.title.slice(0, 60) });
    }
  }

  return { entries, skipped };
}

export async function publishAssetsToGallery(assets: MaterialAsset[]) {
  const plan = planAssetPublish(assets);
  const results = await Promise.allSettled(
    plan.entries.map((entry) =>
      galleryActions.publish({
        kind: entry.kind,
        title: entry.title,
        sourceType: 'FROM_GENERATION',
        // 视频生成 id 落 videoGenerationId——服务端据此查 video_clip_generations
        // 派生 mediaUrls；图片仍走 imageGenerationId。
        ...(entry.kind === 'VIDEO'
          ? { videoGenerationId: entry.generationId }
          : { imageGenerationId: entry.generationId }),
        allowPublicReference: true,
      }),
    ),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded: results.length - failed, failed, skipped: plan.skipped };
}
