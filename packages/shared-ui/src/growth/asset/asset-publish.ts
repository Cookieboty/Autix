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
  /** 去重后可投稿的生成 id（一次生成多张图只投一次稿）。 */
  generationIds: string[];
  /** 标题按生成 id 取该次生成任意一张的 title。 */
  titleOf: Map<string, string>;
  /** 无法投稿的素材数（非生成来源，或是视频——广场投稿这里只走 IMAGE）。 */
  skipped: number;
}

export function planAssetPublish(assets: MaterialAsset[]): AssetPublishPlan {
  const generationIds: string[] = [];
  const titleOf = new Map<string, string>();
  let skipped = 0;

  for (const asset of assets) {
    const generationId = asset.type === 'image' ? generationIdFromAsset(asset) : null;
    if (!generationId) {
      skipped += 1;
      continue;
    }
    if (!titleOf.has(generationId)) {
      titleOf.set(generationId, asset.title.slice(0, 60));
      generationIds.push(generationId);
    }
  }

  return { generationIds, titleOf, skipped };
}

export async function publishAssetsToGallery(assets: MaterialAsset[]) {
  const plan = planAssetPublish(assets);
  const results = await Promise.allSettled(
    plan.generationIds.map((generationId) =>
      galleryActions.publish({
        kind: 'IMAGE',
        title: plan.titleOf.get(generationId),
        sourceType: 'FROM_GENERATION',
        imageGenerationId: generationId,
        allowPublicReference: true,
      }),
    ),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { succeeded: results.length - failed, failed, skipped: plan.skipped };
}
