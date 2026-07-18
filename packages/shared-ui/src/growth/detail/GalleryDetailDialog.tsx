'use client';

import { useEffect } from 'react';
import { Bookmark, Download, Heart, ImageIcon, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { reportResourceView, type GalleryFeedItem } from '@autix/shared-store';
import { downloadImageFile } from '../generator/image/image-history-media';
import { DetailPanelButton, MediaDetailShell, type MediaDetailRow } from './MediaDetailShell';

export type GalleryInteraction = {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
};

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

/**
 * 广场作品详情弹窗 —— **首页画廊与生成器「广场」Tab 共用同一个**。
 *
 * 两处展示的本来就是同一种东西（gallery_posts 的已发布作品），此前却各有一个弹窗：
 * 首页吃 GalleryFeedItem，生成器先把 feed 映射成 ImageTemplate 再喂给另一个组件，
 * 于是两边的布局与可做的动作长期在漂。现在统一吃 GalleryFeedItem（服务端的真实形状），
 * 映射那层只留给瀑布流卡片用。
 *
 * 版式与历史详情完全一致（同一个 MediaDetailShell）：提示词模块 + 详情模块，
 * 底部两排动作。动作全部可选，给了 handler 才渲染。
 */
export function GalleryDetailDialog({
  item,
  onClose,
  interaction,
  onToggleLike,
  onToggleFavorite,
  onRecreate,
  onUseAsReference,
}: {
  item: GalleryFeedItem | null;
  onClose: () => void;
  /** 覆盖 feed 里的初始互动态（调用方做了乐观更新时传）。缺省则读 item 自身。 */
  interaction?: GalleryInteraction;
  onToggleLike?: (postId: string) => void;
  onToggleFavorite?: (postId: string) => void;
  /** 用这条作品的提示词重新生成（生成器就地填输入框；首页跳生成器预填）。 */
  onRecreate?: (item: GalleryFeedItem) => void;
  /** 把这张图作为参考图带进输入框。首页没有输入框，不传即不渲染。 */
  onUseAsReference?: (item: GalleryFeedItem) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  // 浏览量上报：详情可见即记一次 scope='detail'（喂 viewCount/pvCount/uvCount）。
  // 这是所有作品详情的唯一出口（首页/生成器/个人页弹窗、以及整页 GalleryPostView 都渲染本组件），
  // 打在这里即全覆盖。post.id 变化才重报，同一次打开只报一次。
  const postId = item?.post.id;
  useEffect(() => {
    if (postId) reportResourceView({ resourceType: 'GALLERY_POST', resourceId: postId, scope: 'detail' });
  }, [postId]);

  if (!item) return null;

  const { post, metrics } = item;
  const isVideo = post.kind === 'VIDEO';
  const media = isVideo
    ? post.mediaUrls[0] ?? post.coverImage
    : post.coverImage ?? post.mediaUrls[0];
  const authorName = item.author?.nickname || t('unknownAuthor');
  const dimensions = post.width && post.height ? `${post.width} × ${post.height}` : post.aspectRatio;
  const prompt = post.prompt ?? '';

  const liked = interaction?.liked ?? item.liked ?? false;
  const favorited = interaction?.favorited ?? item.favorited ?? false;
  const likeCount = interaction?.likeCount ?? metrics.likeCount;

  /**
   * 广场作品能展示的「参数」只有这些：feed 里没有 quality / resolution 之类的生成参数
   * （发布时没快照进 gallery_posts），所以不硬编一行「-」出来充数。分类按需求去掉。
   */
  const details: MediaDetailRow[] = [
    // 展示别名（Seedream 4.5），不展示厂商串（doubao-seedream-4-5）——后者仍在
    // post.model 里，只是不给人看。别名解析不到时才回退显示厂商串。
    { label: t('model'), value: post.modelName || post.model || t('auto') },
    { label: t('imageSize'), value: dimensions || '-' },
    ...(isVideo && post.durationSec
      ? [{ label: t('durationLabel'), value: `${post.durationSec}s` }]
      : []),
  ];

  return (
    <MediaDetailShell
      open
      onClose={onClose}
      mediaUrl={media ?? null}
      isVideo={isVideo}
      poster={post.coverImage}
      mediaAlt={prompt}
      author={{ name: authorName, avatarUrl: item.author?.avatar }}
      authorSubtitle={t('author')}
      prompt={prompt}
      details={details}
      footer={
        <div className="grid gap-2">
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            {onToggleLike ? (
              <DetailPanelButton
                aria-label={t('ariaLike')}
                aria-pressed={liked}
                onClick={() => onToggleLike(post.id)}
              >
                {/* 点赞是红心（荧光绿的实心爱心太扎眼，也不符合直觉）；收藏仍用强调色 */}
                <Heart className={`size-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                {formatMetric(likeCount)}
              </DetailPanelButton>
            ) : null}
            {onToggleFavorite ? (
              <DetailPanelButton
                square
                aria-label={t('ariaFavorite')}
                aria-pressed={favorited}
                onClick={() => onToggleFavorite(post.id)}
              >
                <Bookmark
                  className={`size-4 ${favorited ? 'fill-growth-accent text-growth-accent' : ''}`}
                />
              </DetailPanelButton>
            ) : null}
            {onRecreate ? (
              <DetailPanelButton primary onClick={() => onRecreate(item)}>
                <RefreshCw className="size-4" />
                {t('recreate')}
              </DetailPanelButton>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {onUseAsReference ? (
              <DetailPanelButton onClick={() => onUseAsReference(item)}>
                <ImageIcon className="size-4" />
                {t('reference')}
              </DetailPanelButton>
            ) : null}
            {media ? (
              <DetailPanelButton
                onClick={() => void downloadImageFile(media, `${post.id}.png`)}
              >
                <Download className="size-4" />
                {t('download')}
              </DetailPanelButton>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
