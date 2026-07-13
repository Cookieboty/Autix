'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bookmark, Check, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  materialHistoryKey,
  useMaterialHistoryStore,
  type MaterialHistoryItem,
  type MetricResourceType,
} from '@autix/shared-store';
import { Link } from '../navigation';
import { Button } from '../ui/button';

/** 能保存到素材库的资源类型——与后端 HISTORY_MAPPABLE_TYPES 对齐（见 materials.service.ts）。 */
const SAVEABLE_TYPES = new Set<MetricResourceType>(['IMAGE_TEMPLATE', 'VIDEO_TEMPLATE', 'GALLERY_POST']);

function historyItemHref(item: MaterialHistoryItem): string | null {
  if (item.resourceType === 'GALLERY_POST') return `/gallery/${item.resourceId}`;
  if (item.resourceType === 'IMAGE_TEMPLATE') return `/marketplace/image-templates/${item.resourceId}`;
  if (item.resourceType === 'VIDEO_TEMPLATE') return `/marketplace/video-templates/${item.resourceId}`;
  return null;
}

function formatViewedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Plan C Task 11/12：浏览历史面板——消费去重后的 `GET /materials/history`（非 material_assets
 * 里 librarySource=HISTORY 的已保存项，那些走普通网格）。接口只回 (resourceType,resourceId,
 * viewedAt) 三元组，没有标题/封面预览，故卡片只能展示类型 + 时间 + 跳转链接（已知类型）。
 */
export function MaterialHistoryPanel() {
  const t = useTranslations('materials');
  const locale = useLocale();
  const { items, loading, loadingMore, nextCursor, savedKeys, savingKeys, loadHistory, saveFromHistory } =
    useMaterialHistoryStore();

  useEffect(() => {
    void loadHistory({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (item: MaterialHistoryItem) => {
    try {
      await saveFromHistory(item.resourceType, item.resourceId);
      toast.success(t('historySaveSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historySaveFailed'));
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <Clock className="mb-3 size-10 text-muted-foreground" />
        <p className="text-sm font-medium">{t('historyEmptyTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('historyEmptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const key = materialHistoryKey(item.resourceType, item.resourceId);
          const saved = savedKeys.has(key);
          const saving = savingKeys.has(key);
          const saveable = SAVEABLE_TYPES.has(item.resourceType);
          const href = historyItemHref(item);
          const body = (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`resourceType.${item.resourceType}`)}
              </div>
              <div className="mt-1 truncate text-sm text-foreground/80">{item.resourceId}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatViewedAt(item.viewedAt, locale)}</div>
            </div>
          );
          return (
            <article
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              {href ? (
                <Link href={href} className="min-w-0 flex-1 hover:underline">
                  {body}
                </Link>
              ) : (
                body
              )}
              <Button
                type="button"
                variant={saved ? 'secondary' : 'outline'}
                size="sm"
                disabled={!saveable || saved || saving}
                onClick={() => void handleSave(item)}
                title={!saveable ? t('historyNotSaveable') : undefined}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saved ? (
                  <Check className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
                {saved ? t('historySaved') : t('historySaveToLibrary')}
              </Button>
            </article>
          );
        })}
      </div>
      {nextCursor ? (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" onClick={() => void loadHistory({ reset: false })} disabled={loadingMore}>
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('loadMore')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
