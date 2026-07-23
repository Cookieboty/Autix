'use client';

import { Bookmark, Heart, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useResourceInteractions, type MetricResourceType } from '@autix/shared-store';
import { Button } from '../ui';

export interface InteractionActionsProps {
  type: MetricResourceType;
  id: string;
}

/**
 * 点赞 / 收藏 / 分享交互按钮，乐观更新走 useResourceInteractions（写入
 * useResourceMetrics 的缓存，失败自动回滚）。liked/favorited 是前端本地状态，
 * 后端当前不下发"当前用户是否已点赞/收藏"，仅用于驱动按钮的乐观态。
 */
export function InteractionActions({ type, id }: InteractionActionsProps) {
  const t = useTranslations('common');
  const {
    liked,
    favorited,
    toggleLike,
    toggleFavorite,
    share,
    isLiking,
    isFavoriting,
    isSharing,
  } = useResourceInteractions(type, id);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        className="cursor-pointer"
        disabled={isLiking}
        onClick={toggleLike}
        aria-pressed={liked}
      >
        <Heart
          className="w-4 h-4 mr-1"
          style={liked ? { fill: '#ef4444', color: '#ef4444' } : undefined}
        />
        {t('like')}
      </Button>
      <Button
        variant="ghost"
        className="cursor-pointer"
        disabled={isFavoriting}
        onClick={toggleFavorite}
        aria-pressed={favorited}
      >
        <Bookmark
          className="w-4 h-4 mr-1"
          style={favorited ? { fill: '#f59e0b', color: '#f59e0b' } : undefined}
        />
        {t('favorite')}
      </Button>
      <Button variant="ghost" className="cursor-pointer" disabled={isSharing} onClick={share}>
        <Share2 className="w-4 h-4 mr-1" />
        {t('share')}
      </Button>
    </div>
  );
}
