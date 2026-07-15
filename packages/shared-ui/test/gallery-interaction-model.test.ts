import {
  dedupeGenerationIds,
  galleryPostActions,
  resolveFavoriteAction,
  resolveLikeAction,
  summarizeSettled,
} from '../src/growth/generator/image/gallery-interaction-model';

describe('dedupeGenerationIds', () => {
  it('同一次生成勾多张，只产出一个 generationId', () => {
    const ids = dedupeGenerationIds([
      { image: { generationId: 'gen-1' } },
      { image: { generationId: 'gen-1' } },
      { image: { generationId: 'gen-2' } },
    ]);
    expect(ids).toEqual(['gen-1', 'gen-2']);
  });

  it('丢弃没有 generationId 的项', () => {
    expect(dedupeGenerationIds([{ image: {} }, { image: { generationId: 'gen-1' } }])).toEqual([
      'gen-1',
    ]);
  });
});

describe('summarizeSettled', () => {
  it('部分成功时分别计数，并保留第一个错误', () => {
    const err = new Error('boom');
    const summary = summarizeSettled([
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: err },
      { status: 'fulfilled', value: 2 },
    ]);
    expect(summary).toEqual({ succeeded: 2, failed: 1, firstError: err });
  });

  it('全部成功时 firstError 为 undefined', () => {
    const summary = summarizeSettled([{ status: 'fulfilled', value: 1 }]);
    expect(summary.failed).toBe(0);
    expect(summary.firstError).toBeUndefined();
  });
});

describe('galleryPostActions', () => {
  it('没有广场帖：可发布、可删除生成记录', () => {
    const actions = galleryPostActions(undefined);
    expect(actions.canPublish).toBe(true);
    expect(actions.canDeleteGeneration).toBe(true);
  });

  it('PENDING：可撤回，不可删除生成记录', () => {
    const actions = galleryPostActions('PENDING');
    expect(actions.canWithdraw).toBe(true);
    expect(actions.canDeleteGeneration).toBe(false);
    expect(actions.canPublish).toBe(false);
  });

  it('PUBLISHED：可下架，不可直接删帖', () => {
    const actions = galleryPostActions('PUBLISHED');
    expect(actions.canUnpublish).toBe(true);
    expect(actions.canRemovePost).toBe(false);
    expect(actions.canDeleteGeneration).toBe(false);
  });

  it('UNPUBLISHED：可重新提交、可删帖', () => {
    const actions = galleryPostActions('UNPUBLISHED');
    expect(actions.canRepublish).toBe(true);
    expect(actions.canRemovePost).toBe(true);
  });

  it('HIDDEN：只能删帖，绝不给「重新提交」（后端会 400，防绕过管理员处罚）', () => {
    const actions = galleryPostActions('HIDDEN');
    expect(actions.canRepublish).toBe(false);
    expect(actions.canRemovePost).toBe(true);
  });

  it('REJECTED：可重新提交、可删帖', () => {
    const actions = galleryPostActions('REJECTED');
    expect(actions.canRepublish).toBe(true);
    expect(actions.canRemovePost).toBe(true);
  });
});

describe('resolveFavoriteAction / resolveLikeAction —— 幂等方向，不是 toggle', () => {
  it('已收藏 → 调 unfavorite；未收藏 → 调 favorite', () => {
    expect(resolveFavoriteAction(true)).toBe('unfavorite');
    expect(resolveFavoriteAction(false)).toBe('favorite');
  });

  it('已点赞 → 调 unlike；未点赞 → 调 like', () => {
    expect(resolveLikeAction(true)).toBe('unlike');
    expect(resolveLikeAction(false)).toBe('like');
  });
});
