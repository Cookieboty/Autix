'use client';

import {
  ArrowUpRight,
  Copy,
  Download,
  EyeOff,
  FileX,
  Link2,
  RefreshCw,
  RotateCcw,
  Share2,
  Trash2,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ImageActionMenuItem } from './ImageActionMenu';
import type { PublicImageHistoryImage } from './public-image-generation';
import {
  copyImageToClipboard,
  copyTextToClipboard,
  downloadImageFile,
} from './image-history-media';
import type { GalleryPostActions } from './gallery-interaction-model';

/**
 * 「更多」下拉的菜单项。历史卡片悬浮态与详情弹窗共用同一份 —— 两处的下拉内容必须
 * 一致，否则用户会记不住哪个入口能做什么。
 *
 * **每一项只在调用方给了对应 handler 时才出现**：详情弹窗里 Recreate / 参考图 /
 * 下载已经是独立按钮，就不该在菜单里重复；历史卡片没有「打开详情」的其它入口，
 * 才需要 Open 这一项。
 *
 * 复制图片 / 复制链接收在「分享」二级菜单里（一级菜单只放动作，不放变体）。
 * 帖级动作（撤回/下架/重新提交/删帖）只在该次生成挂着广场帖时出现，出边由
 * galleryPostActions 按后端状态机给；「删除图片」在还有活帖时禁用（服务端会 409）。
 */
export function buildImageActionMenuItems({
  t,
  image,
  actions,
  posting,
  deletable,
  runPostAction,
  onDelete,
  onOpen,
  onRecreate,
  onUseAsReference,
  onPublish,
  shareUrl,
}: {
  t: (key: string) => string;
  image: PublicImageHistoryImage;
  actions: GalleryPostActions;
  posting: boolean;
  deletable: boolean;
  runPostAction: (action: 'withdraw' | 'unpublish' | 'republish' | 'removePost') => void;
  onDelete: () => void;
  onOpen?: () => void;
  onRecreate?: () => void;
  onUseAsReference?: (image: PublicImageHistoryImage) => void;
  onPublish?: () => void;
  /** 作品的站内可分享链接；只有已发布的作品才传，未传即不渲染「复制分享链接」。 */
  shareUrl?: string;
}): ImageActionMenuItem[] {
  const items: ImageActionMenuItem[] = [];

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

  if (onUseAsReference) {
    items.push({
      key: 'reference',
      label: t('reference'),
      icon: <ImageIcon className="size-4" />,
      onSelect: () => {
        onUseAsReference(image);
        toast.success(t('referenceAdded'));
      },
    });
  }

  // 分享：二级菜单收纳「复制」的几种变体
  items.push({
    key: 'share',
    label: t('share'),
    icon: <Share2 className="size-4" />,
    separatorBefore: items.length > 0,
    children: [
      /**
       * 作品分享链接（/gallery/<id>）——**只有已发布的作品才有**。
       * 未发布的生成记录是私人的，给出链接别人也打不开（feed 只返回 PUBLISHED）。
       *
       * 与「复制图片链接」是两回事：那个是 CDN 上的裸图 URL，这个是站内可浏览的作品页。
       */
      ...(shareUrl
        ? [
            {
              key: 'copyShareLink',
              label: t('copyShareLink'),
              icon: <Share2 className="size-4" />,
              onSelect: () => {
                void copyTextToClipboard(shareUrl).then((ok) =>
                  ok
                    ? toast.success(t('copiedShareLinkToast'))
                    : toast.error(t('copyFailedToast')),
                );
              },
            } satisfies ImageActionMenuItem,
          ]
        : []),
      {
        key: 'copyImageUrl',
        label: t('copyImageUrl'),
        icon: <Link2 className="size-4" />,
        onSelect: () => {
          void copyTextToClipboard(image.url).then((ok) =>
            ok ? toast.success(t('copiedUrlToast')) : toast.error(t('copyFailedToast')),
          );
        },
      },
      {
        key: 'copyImage',
        label: t('copyImage'),
        icon: <Copy className="size-4" />,
        onSelect: () => {
          void copyImageToClipboard(image.url).then((ok) =>
            ok ? toast.success(t('copiedImageToast')) : toast.error(t('copyFailedToast')),
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
      onSelect: onPublish,
    });
  }

  /**
   * 「下架」在用户眼里只有一件事：把作品从广场撤下来。但后端是两条不同的出边——
   * PENDING（审核中）走 withdraw（撤回投稿 → REMOVED），PUBLISHED（已发布）走
   * unpublish（下架 → UNPUBLISHED）。菜单里不暴露这个区别：同一个红色「下架」，
   * 由帖子当前状态决定实际打哪个接口。
   */
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
    onSelect: () => void downloadImageFile(image.url, `image-${image.index + 1}.png`),
  });

  items.push({
    key: 'delete',
    label: t('deleteImage'),
    icon: <Trash2 className="size-4" />,
    destructive: true,
    separatorBefore: true,
    // 还挂着活帖就删不掉（服务端 409）——禁用而不是让用户白点一次
    disabled: !deletable,
    onSelect: onDelete,
  });

  return items;
}
