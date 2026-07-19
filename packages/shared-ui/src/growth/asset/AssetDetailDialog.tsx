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
  /**
   * 用户上传的素材没有提示词，title 是**文件名**。顶着「PROMPT」的标题展示文件名
   * 是在说谎，所以上传素材不渲染那张卡，改把文件名放进 DETAILS 里的「文件名」一行。
   * 生成素材的 title 本来就是提示词（见 buildGenerationMaterialRows），照旧。
   */
  const isGenerated = asset.librarySource === 'GENERATION';
  // 类型行要认全三种；原来写的是 video ? video : image，音频会被标成「图片」。
  const typeKey = asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image';
  const details: MediaDetailRow[] = [
    { label: t('detail.type'), value: t(`bucket.${typeKey}`) },
    ...(isGenerated ? [] : [{ label: t('detail.fileName'), value: asset.title }]),
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
      isAudio={asset.type === 'audio'}
      poster={asset.thumbnailUrl}
      mediaAlt={asset.title}
      author={{ name: user?.realName || user?.username || '', avatarUrl: user?.avatar }}
      authorSubtitle={isGenerated ? t('detail.author') : t('detail.uploader')}
      // 上传素材传空串 → PROMPT 卡整张不渲染（文件名已挪进 DETAILS）
      prompt={isGenerated ? asset.title : ''}
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
