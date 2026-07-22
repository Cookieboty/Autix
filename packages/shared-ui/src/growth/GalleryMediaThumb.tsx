'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { GalleryFeedItem } from '@autix/shared-store';
import { CdnImage, CdnVideo } from '../image';

const THUMB_SIZES = '(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw';

/**
 * 广场作品在瀑布流里的缩略媒体。首页、个人主页、视频广场墙三处共用。
 *
 * 抽出来是因为这三处此前各写了一份几乎相同的卡片，也就各自带着同两个毛病：
 *
 * 1. **视频被当图片渲染**：`cover = post.coverImage ?? post.mediaUrls[0]`，视频没有封面时
 *    就退化成 `<img src="....mp4">`，浏览器解不出来 —— 表现是整片空白。
 * 2. **悬浮不播放**：卡片上盖着一层 `absolute inset-0` 的点击热区，鼠标永远进不到
 *    `<video>` 元素，挂在它身上的 onMouseEnter 一次都不会触发。
 *
 * 所以这里把播放绑在**外层容器**（由调用方用 group-hover 的那一层触发），而不是
 * video 元素自身 —— 谁盖在上面都不影响。
 */
export function GalleryMediaThumb({
  item,
  index,
  className = '',
}: {
  item: GalleryFeedItem;
  /** 全局下标：决定首屏是否 eager 加载 */
  index: number;
  className?: string;
}) {
  const { post } = item;
  const isVideo = post.kind === 'VIDEO';
  const videoSrc = post.mediaUrls[0];
  const cover = post.coverImage ?? (isVideo ? null : post.mediaUrls[0]) ?? null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** 投稿快照里的画幅只是「请求值」，真实比例以视频元数据为准。 */
  const [ratio, setRatio] = useState<number | null>(null);

  if (isVideo && videoSrc) {
    return (
      <CdnVideo
        ref={videoRef}
        src={videoSrc}
        poster={cover}
        muted
        loop
        playsInline
        preload="metadata"
        className={`block w-full object-cover ${className}`}
        style={{ aspectRatio: String(ratio ?? parsePostRatio(post.aspectRatio) ?? 9 / 16) }}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth && videoHeight) setRatio(videoWidth / videoHeight);
        }}
      />
    );
  }

  if (cover) {
    return (
      <CdnImage
        src={cover}
        alt={post.title ?? ''}
        sizes={THUMB_SIZES}
        priority={index < 4}
        loading={index < 8 ? 'eager' : 'lazy'}
        className={`block h-auto w-full ${className}`}
      />
    );
  }

  return (
    <div className="grid aspect-[3/4] w-full place-items-center bg-secondary text-foreground/32">
      <ImageIcon className="size-10" />
    </div>
  );
}

/** "16:9" → 1.777…；解析不出返回 undefined。 */
export function parsePostRatio(label?: string | null): number | undefined {
  const match = label?.match(/(\d+)\s*[x:×]\s*(\d+)/i);
  if (!match) return undefined;
  const w = Number(match[1]);
  const h = Number(match[2]);
  return w > 0 && h > 0 ? w / h : undefined;
}

/**
 * 把「悬浮播放 / 移开暂停归零」绑到卡片**容器**上的事件对。
 *
 * 必须绑容器而不是 video 自身：卡片上通常盖着一层全尺寸的点击热区（进详情用），
 * 鼠标事件会被它吃掉，绑在 video 上的 handler 永远不触发。容器用事件冒泡拿得到。
 *
 * 用法：`<article {...galleryHoverPlayHandlers()}>`
 */
export function galleryHoverPlayHandlers() {
  const play = (event: { currentTarget: HTMLElement }) => {
    const video = event.currentTarget.querySelector('video');
    if (video) void video.play().catch(() => undefined);
  };
  const stop = (event: { currentTarget: HTMLElement }) => {
    const video = event.currentTarget.querySelector('video');
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };
  return { onMouseEnter: play, onMouseLeave: stop };
}
