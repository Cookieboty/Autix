'use client';

import { useEffect, useState } from 'react';
import { Copy, Image as ImageIcon, Info, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GalleryFeedItem } from '@autix/shared-store';

function formatMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-black text-foreground">{formatMetric(value)}</span>
      <span className="text-[11px] font-semibold text-foreground/45">{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 py-2">
      <span className="text-foreground/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/82">{value}</span>
    </div>
  );
}

/** 广场作品详情弹窗（首页画廊点击打开）：数据直接来自 feed item，无需再拉详情接口。广场无标题。 */
export function PublicGalleryDetailDialog({
  item,
  onClose,
}: {
  item: GalleryFeedItem | null;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    setCopied(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const { post, metrics } = item;
  const isVideo = post.kind === 'VIDEO';
  const media = isVideo ? post.mediaUrls[0] ?? post.coverImage : post.coverImage ?? post.mediaUrls[0];
  const author = post.authorSnapshot?.displayName || t('unknownAuthor');
  const authorInitial = author.trim()[0]?.toUpperCase() || 'A';
  const dimensions = post.width && post.height ? `${post.width} × ${post.height}` : post.aspectRatio;

  const copyPrompt = () => {
    if (!post.prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(post.prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex bg-background/82 text-foreground backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={post.prompt ?? 'gallery detail'}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_400px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {media ? (
            isVideo ? (
              <video
                src={media}
                poster={post.coverImage ?? undefined}
                controls
                playsInline
                className="max-h-[calc(100svh-3rem)] max-w-full rounded-xl object-contain"
              />
            ) : (
              <img
                src={media}
                alt=""
                className="max-h-[calc(100svh-3rem)] max-w-full rounded-xl object-contain"
              />
            )
          ) : (
            <div className="grid size-40 place-items-center rounded-xl bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="growth-dialog-shadow flex min-h-0 flex-col rounded-xl border border-border bg-card p-4">
          {/* 作者 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-growth-accent text-sm font-black text-background">
                {post.authorSnapshot?.avatarUrl ? (
                  <img
                    src={post.authorSnapshot.avatarUrl}
                    alt={author}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  authorInitial
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-foreground">{author}</div>
                <div className="text-xs text-foreground/45">{t('author')}</div>
              </div>
            </div>
            <button
              type="button"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-foreground/50 hover:bg-secondary hover:text-foreground"
              aria-label={t('close')}
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>

          {/* 指标：PV / UV / 点赞 / 收藏 / 二创 */}
          <div className="mt-4 grid grid-cols-5 gap-2 rounded-lg border border-border/60 bg-secondary/40 py-3">
            <StatCell label="PV" value={metrics.pvCount} />
            <StatCell label="UV" value={metrics.uvCount} />
            <StatCell label={t('likes')} value={metrics.likeCount} />
            <StatCell label={t('favorites')} value={metrics.favoriteCount} />
            <StatCell label={t('remixes')} value={metrics.referenceCount} />
          </div>

          <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {/* 提示词 */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/50">
                  <Sparkles className="size-3.5" />
                  {t('prompt')}
                </h3>
                {post.prompt ? (
                  <button
                    type="button"
                    className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                    onClick={copyPrompt}
                  >
                    <Copy className="size-3.5" />
                    {copied ? t('copied') : t('copyPrompt')}
                  </button>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/70">
                {post.prompt || t('noPrompt')}
              </p>
            </section>

            <div className="h-px bg-border" />

            {/* 信息：模型 / 尺寸 / 分类 */}
            <section>
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/50">
                <Info className="size-3.5" />
                {t('information')}
              </h3>
              <div className="mt-2 divide-y divide-border/60 text-sm">
                <InfoRow label={t('model')} value={post.model || t('auto')} />
                <InfoRow label={t('dimensions')} value={dimensions || '-'} />
                {post.category ? <InfoRow label={t('category')} value={post.category} /> : null}
              </div>
            </section>

            {post.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
