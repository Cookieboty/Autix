import { galleryActions } from '@autix/shared-store';
import {
  dedupeGenerationIds,
  summarizeSettled,
  type SettledSummary,
} from './gallery-interaction-model';
import type { PublicImageHistoryImage, PublicImageHistoryItem } from './public-image-generation';

export interface PublishSelection {
  item: PublicImageHistoryItem;
  image: PublicImageHistoryImage;
}

/**
 * 一键投稿到广场（FROM_GENERATION → PENDING，先审后发）。
 *
 * 原先这里挡着一个弹窗，让用户选分类 + 勾选是否公开参考图。两个字段都去掉了：
 * - 分类不传：只有管理端筛选用得到它，公开 feed 不按分类过滤，审核员会补。
 *   （旧弹窗的分类默认值是列表第一项「人像」，用户不动就全发成人像——比不填还脏。）
 * - allowPublicReference 固定 true：产品决定参考图随帖公开。注意后端默认是 false
 *   （fail-closed），公开与否完全由这里这个字段决定，改动它等于改动用户隐私默认值。
 *
 * 粒度是「一次生成」而非「一张图」：同一次生成勾中多张只发一条帖，故先按 generationId 去重。
 * 逐条独立提交，一条失败不影响其余。
 */
export async function publishSelectionsToGallery(
  selections: PublishSelection[],
): Promise<SettledSummary> {
  const generationIds = dedupeGenerationIds(selections);
  const titleOf = (generationId: string) => {
    const hit = selections.find(({ image }) => image.generationId === generationId);
    const text = hit?.image.prompt ?? hit?.item.prompt;
    return text?.slice(0, 60) || undefined;
  };

  const results = await Promise.allSettled(
    generationIds.map((generationId) =>
      galleryActions.publish({
        kind: 'IMAGE',
        title: titleOf(generationId),
        sourceType: 'FROM_GENERATION',
        imageGenerationId: generationId,
        allowPublicReference: true,
      }),
    ),
  );

  return summarizeSettled(results);
}
