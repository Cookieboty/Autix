'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  galleryActions,
  useAuthStore,
  useUiStore,
  type GalleryFeedItem,
} from '@autix/shared-store';
import { useRouter } from '../../navigation';
import { GALLERY_TAB_PATH } from '../generator/image/gallery-url';
import { buildGeneratorWorkbenchHref } from '../generator-workbench-href';
import { GalleryDetailDialog, type GalleryInteraction } from './GalleryDetailDialog';
import { GalleryDetailSkeleton } from './GalleryDetailSkeleton';

/**
 * 广场作品详情（路由 `/gallery/<id>`）——**只服务「刷新 / 外链 / 分享链接直接落地」**。
 *
 * 站内点开不走这里：那是本地弹窗 + history.pushState 改地址栏（useGalleryPostModal），
 * 数据直接用列表里的 feed item，零请求瞬开、页面不动。
 *
 * 这条路径没有列表缓存可用（别人分享的链接、翻页之外的作品），所以客户端拉一次
 * getDetail(id)；拉取期间显示骨架屏，与路由级 loading.tsx 用的是同一个。
 */
export function GalleryPostView({
  postId,
  onClose,
}: {
  postId: string;
  /** 关闭详情。缺省 → 跳广场 Tab（完整页的行为）。 */
  onClose?: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useUiStore((state) => state.openAuthModal);
  const [item, setItem] = useState<GalleryFeedItem | null>(null);
  const [interaction, setInteraction] = useState<GalleryInteraction | undefined>(undefined);

  const close = onClose ?? (() => router.push(GALLERY_TAB_PATH));

  useEffect(() => {
    let cancelled = false;
    galleryActions
      .getDetail(postId)
      .then((detail) => {
        if (cancelled) return;
        setItem({
          post: detail.post,
          author: detail.author,
          metrics: detail.metrics,
          liked: detail.viewer?.liked,
          favorited: detail.viewer?.favorited,
        });
      })
      .catch(() => {
        // 作品已下架/被删/id 非法 —— 用户多半是点了别人给的链接进来的，不弹错，回广场
        if (!cancelled) close();
      });
    return () => {
      cancelled = true;
    };
    // postId 变了才重拉；close 每次渲染都是新函数，不进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // 拉 getDetail 期间给骨架屏——之前直接 return null，表现是整页白屏
  if (!item) return <GalleryDetailSkeleton />;

  const current: GalleryInteraction = interaction ?? {
    liked: item.liked ?? false,
    favorited: item.favorited ?? false,
    likeCount: item.metrics.likeCount,
  };

  /** 点赞/收藏：后端 like/unlike、favorite/unfavorite 是幂等的两个接口，按当前态定方向。 */
  const toggleLike = () => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: GALLERY_TAB_PATH });
      return;
    }
    const liking = !current.liked;
    setInteraction({
      ...current,
      liked: liking,
      likeCount: Math.max(0, current.likeCount + (liking ? 1 : -1)),
    });
    const request = liking ? galleryActions.like(postId) : galleryActions.unlike(postId);
    void request
      .then((metrics) =>
        setInteraction((prev) => (prev ? { ...prev, likeCount: metrics.likeCount } : prev)),
      )
      .catch(() => setInteraction(current));
  };

  const toggleFavorite = () => {
    if (!isAuthenticated) {
      openAuthModal({ mode: 'entry', returnTo: GALLERY_TAB_PATH });
      return;
    }
    const favoriting = !current.favorited;
    setInteraction({ ...current, favorited: favoriting });
    const request = favoriting
      ? galleryActions.favorite(postId)
      : galleryActions.unfavorite(postId);
    void request.catch(() => setInteraction(current));
  };

  /**
   * Recreate：详情是独立路由，够不着生成器的输入框，所以跳过去预填
   * （/ai/image?prompt=...&model=...）。参考图同理够不着，这里不提供 —— 广场卡片
   * 悬浮态有「参考图」按钮，那里生成器就在同一棵树上。
   */
  const recreate = () => {
    const prompt = item.post.prompt ?? item.post.description ?? '';
    if (!prompt) return;
    router.push(
      buildGeneratorWorkbenchHref({
        kind: item.post.kind === 'VIDEO' ? 'video' : 'image',
        prompt,
        model: item.post.model,
      }),
    );
  };

  return (
    <GalleryDetailDialog
      item={item}
      onClose={close}
      interaction={current}
      onToggleLike={() => toggleLike()}
      onToggleFavorite={() => toggleFavorite()}
      onRecreate={() => recreate()}
    />
  );
}
