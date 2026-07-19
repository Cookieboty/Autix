'use client';

import {
  ArrowUpRight,
  Download,
  EyeOff,
  FileX,
  Link2,
  RefreshCw,
  RotateCcw,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DirectVideoGenerationDto } from '@autix/shared-store';
import type { ImageActionMenuItem } from '../image/ImageActionMenu';
import { copyTextToClipboard, downloadImageFile } from '../image/image-history-media';
import type { GalleryPostActions } from '../image/gallery-interaction-model';

/**
 * 视频历史卡片 / 详情弹窗的「更多」菜单项，与 buildImageActionMenuItems 同一契约：
 * 每一项只在调用方给了对应 handler 时才出现，两个入口的内容因此保持一致。
 *
 * 与图片侧的差异只有两处，都是媒体类型决定的：
 * - 没有「复制图片」——剪贴板只收 image/*，塞不进视频；只留「复制链接」。
 * - 下载走 .mp4 文件名（downloadImageFile 本身与类型无关，就是 fetch→blob→a[download]）。
 */
export function buildVideoActionMenuItems({
  t,
  item,
  actions,
  posting,
  deletable,
  runPostAction,
  onDelete,
  onOpen,
  onRecreate,
  onPublish,
  shareUrl,
}: {
  t: (key: string) => string;
  item: DirectVideoGenerationDto;
  actions: GalleryPostActions;
  posting: boolean;
  deletable: boolean;
  runPostAction: (action: 'withdraw' | 'unpublish' | 'republish' | 'removePost') => void;
  onDelete: () => void;
  onOpen?: () => void;
  onRecreate?: () => void;
  onPublish?: () => void;
  /** 作品的站内可分享链接；只有已发布的作品才传。 */
  shareUrl?: string;
}): ImageActionMenuItem[] {
  const items: ImageActionMenuItem[] = [];
  const videoUrl = item.videoUrl;

  if (onOpen) {
    items.push({
      key: 'open',
      label: t('open'),
      icon: <ArrowUpRight className="size-4" />,
      onSelect: onOpen,
    });
  }

  if (onRecreate) {
    items.push({
      key: 'recreate',
      label: t('recreate'),
      icon: <RefreshCw className="size-4" />,
      onSelect: onRecreate,
    });
  }

  items.push({
    key: 'share',
    label: t('share'),
    icon: <Share2 className="size-4" />,
    separatorBefore: items.length > 0,
    children: [
      ...(shareUrl
        ? [
            {
              key: 'copyShareLink',
              label: t('copyShareLink'),
              icon: <Share2 className="size-4" />,
              onSelect: () => {
                void copyTextToClipboard(shareUrl).then((ok) =>
                  ok ? toast.success(t('copiedShareLinkToast')) : toast.error(t('copyFailedToast')),
                );
              },
            } satisfies ImageActionMenuItem,
          ]
        : []),
      {
        key: 'copyVideoUrl',
        label: t('copyVideoUrl'),
        icon: <Link2 className="size-4" />,
        // 未完成的生成没有 videoUrl，复制出来是个空串
        disabled: !videoUrl,
        onSelect: () => {
          if (!videoUrl) return;
          void copyTextToClipboard(videoUrl).then((ok) =>
            ok ? toast.success(t('copiedUrlToast')) : toast.error(t('copyFailedToast')),
          );
        },
      },
    ],
  });

  if (onPublish && actions.canPublish) {
    items.push({
      key: 'publish',
      label: t('publish'),
      icon: <Upload className="size-4" />,
      // 只有出片了才谈得上投稿
      disabled: !videoUrl,
      onSelect: onPublish,
    });
  }

  // 「下架」对用户是一件事，后端是两条出边（PENDING→withdraw，PUBLISHED→unpublish），
  // 由帖子当前状态决定打哪个接口 —— 与图片侧同一处理。
  if (actions.canWithdraw || actions.canUnpublish) {
    items.push({
      key: 'unpublish',
      label: t('unpublishPost'),
      icon: <EyeOff className="size-4" />,
      destructive: true,
      disabled: posting,
      onSelect: () => runPostAction(actions.canWithdraw ? 'withdraw' : 'unpublish'),
    });
  }
  if (actions.canRepublish) {
    items.push({
      key: 'republish',
      label: t('republishPost'),
      icon: <RotateCcw className="size-4" />,
      disabled: posting,
      onSelect: () => runPostAction('republish'),
    });
  }
  if (actions.canRemovePost) {
    items.push({
      key: 'removePost',
      label: t('removePost'),
      icon: <FileX className="size-4" />,
      destructive: true,
      disabled: posting,
      onSelect: () => runPostAction('removePost'),
    });
  }

  items.push({
    key: 'download',
    label: t('download'),
    icon: <Download className="size-4" />,
    disabled: !videoUrl,
    onSelect: () => {
      if (videoUrl) void downloadImageFile(videoUrl, `video-${item.id}.mp4`);
    },
  });

  items.push({
    key: 'delete',
    label: t('deleteVideo'),
    icon: <Trash2 className="size-4" />,
    destructive: true,
    separatorBefore: true,
    // 还挂着活帖就删不掉（服务端 409）——禁用而不是让用户白点一次
    disabled: !deletable,
    onSelect: onDelete,
  });

  return items;
}
