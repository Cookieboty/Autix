'use client';

import { Download, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAuthStore, type MaterialAsset } from '@autix/shared-store';
import { MediaDetailShell, DetailPanelButton, type MediaDetailRow } from '../detail/MediaDetailShell';

/**
 * /asset 素材详情：复用 MediaDetailShell（与 /ai/image 历史详情、广场详情同一个外壳）。
 *
 * 不复用 PublicImageDetailDialog —— 那个把生成器的动作（重新生成 / 用作参考 / 发布到广场）
 * 和 PublicImageHistoryItem 的数据形状焊死了，素材库这边喂的是 MaterialAsset，
 * 且动作只有下载/删除。共用的是外壳，不是壳里的内容。
 */

function metaString(asset: MaterialAsset, key: string): string | null {
  const value = asset.metadata?.[key];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function AssetDetailDialog({
  asset,
  onClose,
  onDelete,
}: {
  /** null = 关闭。与历史详情一致：有没有 item 本身就是开关。 */
  asset: MaterialAsset | null;
  onClose: () => void;
  onDelete?: (asset: MaterialAsset) => void;
}) {
  const t = useTranslations('publicGrowth.assets');
  const format = useFormatter();
  const user = useAuthStore((s) => s.user);

  if (!asset) return null;

  const width = metaString(asset, 'width');
  const height = metaString(asset, 'height');
  const details: MediaDetailRow[] = [
    { label: t('detail.type'), value: t(`bucket.${asset.type === 'video' ? 'video' : 'image'}`) },
    ...(metaString(asset, 'modelUsed')
      ? [{ label: t('detail.model'), value: metaString(asset, 'modelUsed')! }]
      : []),
    ...(width && height ? [{ label: t('detail.size'), value: `${width}×${height}` }] : []),
    {
      label: t('detail.createdAt'),
      value: format.dateTime(new Date(asset.createdAt), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ];

  return (
    <MediaDetailShell
      open
      onClose={onClose}
      mediaUrl={asset.url}
      isVideo={asset.type === 'video'}
      poster={asset.thumbnailUrl}
      mediaAlt={asset.title}
      author={{ name: user?.realName || user?.username || '', avatarUrl: user?.avatar }}
      authorSubtitle={t('detail.author')}
      prompt={asset.title}
      details={details}
      ariaLabel={asset.title}
      footer={
        <div className="mt-4 flex gap-2">
          <DetailPanelButton
            onClick={() => {
              if (asset.url) window.open(asset.url, '_blank', 'noopener,noreferrer');
            }}
            primary
          >
            <Download className="size-4" />
            {t('detail.download')}
          </DetailPanelButton>
          {onDelete && (
            <DetailPanelButton square aria-label={t('detail.delete')} onClick={() => onDelete(asset)}>
              <Trash2 className="size-4" />
            </DetailPanelButton>
          )}
        </div>
      }
    />
  );
}
