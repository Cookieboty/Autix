/**
 * /ai/image 广场互动的纯逻辑（无 React、无网络），单测覆盖。
 * 抽出来的四件事都是最容易写错的地方：
 * 1. 发布/删除的真实粒度是「一次生成」而非「一张图」——必须按 generationId 去重；
 * 2. 批量投稿要逐条独立、部分成功也要报准；
 * 3. 广场帖状态 → 可用动作（HIDDEN 绝不能给「重新提交」；REJECTED 不给「删帖」，因为广场已不可见，
 *    双按钮只会让用户在等价选项之间选择）；
 * 4. like/favorite 是幂等的 POST/DELETE，不是 toggle —— 必须按当前状态定方向。
 */

export type GalleryPostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'REMOVED'
  | 'UNPUBLISHED';

/**
 * 选中的是「图」，但服务端发布/删除的单位是「一次生成」（FROM_GENERATION 会把该次生成的
 * 全部图派生进同一条帖）。同一次生成勾 N 张只能发/删一次，否则就是 N 条重复请求。
 */
export function dedupeGenerationIds(
  selections: Array<{ image: { generationId?: string } }>,
): string[] {
  const seen = new Set<string>();
  for (const { image } of selections) {
    if (image.generationId) seen.add(image.generationId);
  }
  return [...seen];
}

export interface SettledSummary {
  succeeded: number;
  failed: number;
  firstError: unknown;
}

/** 逐条独立提交的结果汇总：一条失败不影响其余，且失败要报得出来。 */
export function summarizeSettled(results: Array<PromiseSettledResult<unknown>>): SettledSummary {
  let succeeded = 0;
  let failed = 0;
  let firstError: unknown;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded += 1;
    } else {
      failed += 1;
      if (firstError === undefined) firstError = result.reason;
    }
  }
  return { succeeded, failed, firstError };
}

export interface GalleryPostActions {
  canPublish: boolean;
  /** PENDING：撤回投稿（DELETE /gallery/:id → REMOVED）。 */
  canWithdraw: boolean;
  /** PUBLISHED：下架（POST /gallery/:id/unpublish → UNPUBLISHED）。 */
  canUnpublish: boolean;
  /** REJECTED / UNPUBLISHED：重新提交审核（POST /gallery/:id/republish）。 */
  canRepublish: boolean;
  /**
   * 删除广场帖本身（DELETE /gallery/:id → REMOVED）。
   * PUBLISHED 态刻意不给这个动作：后端其实允许作者直接 PUBLISHED→REMOVED，这里要求先下架
   * 再删是本组件的 UX 选择（让「从广场撤下」成为一个明确的、可反悔的独立动作），不是服务端强制。
   * REJECTED 也刻意不给：审核未过时广场对所有人已经不可见，「删帖」按钮对用户毫无观感差异，
   * 徒增决策负担；用户若想彻底放弃这条帖子，删生成记录时后端会级联清理。
   * 仍保留 UNPUBLISHED / HIDDEN：
   * - UNPUBLISHED 是作者已经把公开的帖子撤下、可能想彻底删掉这次投稿记录；
   * - HIDDEN 是管理员处罚下架，republish 会 400，用户唯一的清理出口就是删帖。
   */
  canRemovePost: boolean;
  /**
   * 删除生成记录本身。产品口径：作者随时可删自己的图/视频，若存在活帖则由后端级联下架
   * （gallery.removePost 走 assertTransition 校验角色）。因此这里所有非 REMOVED 状态一律为 true。
   */
  canDeleteGeneration: boolean;
}

const NO_POST: GalleryPostActions = {
  canPublish: true,
  canWithdraw: false,
  canUnpublish: false,
  canRepublish: false,
  canRemovePost: false,
  canDeleteGeneration: true,
};

/**
 * 广场帖状态 → 该历史卡片可用的动作。
 *
 * HIDDEN 是管理员处罚下架：后端 republish 只接受 UNPUBLISHED，对 HIDDEN 会 400。
 * 因此这里**绝不**给出 canRepublish —— 前端不得诱导用户去撞一个必然失败的按钮。
 *
 * canDeleteGeneration：作者随时可删自己的生成记录，即便挂着活帖也 OK（后端会级联下架），
 * 不再像旧口径那样在有活帖时禁用删除。
 */
export function galleryPostActions(status?: GalleryPostStatus): GalleryPostActions {
  if (!status || status === 'REMOVED') return NO_POST;

  switch (status) {
    case 'PENDING':
      return { ...NO_POST, canPublish: false, canWithdraw: true };
    case 'PUBLISHED':
      return { ...NO_POST, canPublish: false, canUnpublish: true };
    case 'REJECTED':
      // 审核被打回时广场对所有人已不可见，用户侧再暴露「删帖」并无 UX 意义
      // （既不改变可见性，也不释放什么资源），只保留「重新提交审核」这一条出边。
      // 想彻底不要这条帖子，直接删生成记录即可，后端会级联把帖子清掉。
      return {
        ...NO_POST,
        canPublish: false,
        canRepublish: true,
      };
    case 'UNPUBLISHED':
      return {
        ...NO_POST,
        canPublish: false,
        canRepublish: true,
        canRemovePost: true,
      };
    case 'HIDDEN':
      return {
        ...NO_POST,
        canPublish: false,
        canRemovePost: true,
      };
    default:
      // DRAFT：本页不产出草稿，兜底按「有活帖」处理其它动作，但不禁用删除。
      return { ...NO_POST, canPublish: false };
  }
}

/**
 * favorite/unfavorite 是幂等的 POST/DELETE，**不是 toggle**：调用方必须按当前状态定方向。
 * 写成「点一下就打反」在并发/重放下会把状态搞乱。like/unlike 同理。
 */
export function resolveFavoriteAction(favorited: boolean): 'favorite' | 'unfavorite' {
  return favorited ? 'unfavorite' : 'favorite';
}

export function resolveLikeAction(liked: boolean): 'like' | 'unlike' {
  return liked ? 'unlike' : 'like';
}
