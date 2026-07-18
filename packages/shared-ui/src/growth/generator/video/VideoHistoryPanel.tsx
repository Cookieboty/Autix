'use client';

import { useState } from 'react';
import { Clock3, Film, Image as ImageIcon, Loader2, PlayCircle, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { DirectVideoGenerationDto } from '@autix/shared-store';

export type PendingVideoGenerationCard = {
  id: string;
  title: string;
  prompt: string;
  model: string;
  coverUrl?: string | null;
};

interface VideoHistoryPanelProps {
  items: DirectVideoGenerationDto[];
  loading?: boolean;
  pending?: PendingVideoGenerationCard | null;
  onSelectItem: (item: DirectVideoGenerationDto) => void;
  /** 删除一条直连生成记录；进行中的记录服务端会拒绝（409），由调用方 toast 展示原因。 */
  onDelete: (id: string) => Promise<void>;
}

/** 直连生成状态机共六态：pending/queued/running/completed/failed/expired（见 VideoGenStatus）。 */
const PROCESSING_STATUSES = new Set(['pending', 'queued', 'running']);

type DisplayStatus = 'completed' | 'processing' | 'failed';

function getItemStatus(item: DirectVideoGenerationDto): DisplayStatus {
  if (item.status === 'completed' && item.videoUrl) return 'completed';
  if (PROCESSING_STATUSES.has(item.status)) return 'processing';
  // failed / expired（以及理论上不该出现的 completed-without-url）统一按失败展示。
  return 'failed';
}

function getItemCover(item: DirectVideoGenerationDto) {
  return item.thumbnailUrl ?? item.lastFrameUrl ?? item.materials.find((material) => material.url)?.url ?? null;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function VideoHistoryPanel({ items, loading, pending, onSelectItem, onDelete }: VideoHistoryPanelProps) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (deletingId) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (err) {
      // 进行中的记录服务端会返回 409（"任务进行中，无法删除"）——直接透传后端消息。
      // 注意：SDK 拦截器把后端 msg 挂在 error.msg 上，不是 error.message
      // （error.message 只是 axios 的通用 "Request failed with status code 409"）。
      const message = (err as { msg?: string })?.msg ?? (err instanceof Error ? err.message : t('generateFailed'));
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && items.length === 0 && !pending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0 && !pending) {
    return (
      <div className="growth-flow-border relative overflow-hidden rounded-[14px] border border-dashed border-border bg-secondary p-8 text-center">
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-20 opacity-20" />
        <div className="relative mx-auto grid size-12 place-items-center rounded-full border border-border bg-card text-foreground/48">
          <Film className="size-5" />
        </div>
        <h2 className="relative mt-3 text-sm font-black uppercase text-foreground">
          {t('emptyVideoHistory')}
        </h2>
        <p className="relative mx-auto mt-2 max-w-sm text-xs font-semibold leading-5 text-foreground/44">
          {t('emptyVideoHistoryHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pending ? <ProcessingVideoCard title={pending.title} prompt={pending.prompt} model={pending.model} coverUrl={pending.coverUrl ?? null} /> : null}
      {items.map((item) => {
        const cover = getItemCover(item);
        const status = getItemStatus(item);
        // 刷新页面后仍处于 pending/queued/running 的历史项：视觉与提交态一致，走"进行中"卡片，
        // 上游 VideoGeneratorStudio 会对其发起轮询，命中终态后卡片会自然切换为 completed/failed。
        if (status === 'processing') {
          return (
            <ProcessingVideoCard
              key={item.id}
              title={item.prompt}
              prompt={item.prompt}
              model={item.model}
              coverUrl={cover}
              onDelete={(event) => void handleDelete(event, item.id)}
              deleting={deletingId === item.id}
              deleteAriaLabel={t('ariaDelete')}
            />
          );
        }
        // 卡片外层刻意不是 <button>：内部还挂着"删除"这个真按钮，button 里嵌 button
        // 是 HTML 规范禁止的互动嵌套，Next.js 会以 hydration error 打出。用 div + role
        // 补齐语义，键盘可达性由 tabIndex + Enter/Space 兜底。
        const handleActivate = () => onSelectItem(item);
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={handleActivate}
            onKeyDown={(event) => {
              // 只拦截"确实是本卡片被激活"的场景：焦点若已经落在删除按钮上，
              // Enter/Space 应由那个按钮自己消费，不能被卡片重复触发一次预览。
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleActivate();
              }
            }}
            className="growth-generator-video-card group relative cursor-pointer overflow-hidden rounded-[14px] border border-border bg-background text-left transition duration-300 hover:-translate-y-0.5 hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
              {status === 'completed' && item.videoUrl ? (
                <video
                  src={item.videoUrl}
                  poster={cover ?? undefined}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.04]"
                  onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                  onMouseLeave={(event) => {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = 0;
                  }}
                />
              ) : cover ? (
                <img
                  src={cover}
                  alt={item.prompt}
                  className="h-full w-full object-cover opacity-88 transition duration-700 group-hover:scale-[1.04]"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-foreground/36">
                  <ImageIcon className="size-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/16 to-background/84" />
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/58 px-2 py-1 text-[10px] font-black uppercase text-foreground/82 backdrop-blur-md">
                <Sparkles className="size-3 text-growth-accent" />
                {t(`videoStatus.${status}`)}
              </div>
              {status === 'completed' ? (
                <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                  <span className="grid size-10 place-items-center rounded-full bg-foreground/88 text-background shadow-lg">
                    <PlayCircle className="size-5" />
                  </span>
                </span>
              ) : null}
              <button
                type="button"
                aria-label={t('ariaDelete')}
                onClick={(event) => void handleDelete(event, item.id)}
                disabled={deletingId === item.id}
                className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full bg-background/55 text-foreground opacity-0 backdrop-blur-md transition hover:bg-background/85 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className="line-clamp-2 text-base font-black leading-tight text-foreground">
                  {item.prompt}
                </h3>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-foreground/52">
                  <span className="truncate">{item.model}</span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Clock3 className="size-3" />
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProcessingVideoCard({
  title,
  prompt,
  model,
  coverUrl,
  onDelete,
  deleting,
  deleteAriaLabel,
}: {
  title: string;
  prompt: string;
  model: string;
  coverUrl?: string | null;
  /** 仅历史卡片提供；提交态（pendingGeneration）不带删除入口，避免误伤刚下单的任务。 */
  onDelete?: (event: React.MouseEvent) => void;
  deleting?: boolean;
  deleteAriaLabel?: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  return (
    <article
      className="growth-flow-border growth-generator-video-card group relative overflow-hidden rounded-[14px] border border-growth-accent/35 bg-background text-left growth-history-card-shadow"
      aria-live="polite"
      aria-label={t('generating')}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="h-full w-full object-cover opacity-40 blur-[1px] scale-[1.02]"
          />
        ) : null}
        <div className="absolute inset-0 growth-history-empty-bg" />
        <div className="growth-scan pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30" />
        <div className="absolute inset-3 rounded-[12px] border border-border/60 bg-background/20 backdrop-blur-sm" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/58 px-2 py-1 text-[10px] font-black uppercase text-foreground/82 backdrop-blur-md">
          <Sparkles className="size-3 text-growth-accent" />
          {t('videoStatus.processing')}
        </div>
        {onDelete ? (
          <button
            type="button"
            aria-label={deleteAriaLabel ?? t('ariaDelete')}
            onClick={onDelete}
            disabled={deleting}
            className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full bg-background/55 text-foreground opacity-0 backdrop-blur-md transition hover:bg-background/85 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
        <div className="absolute inset-x-0 top-[34%] flex flex-col items-center px-5 text-center">
          <span className="relative grid size-14 place-items-center rounded-full border border-growth-accent/40 bg-growth-accent/10 text-growth-accent growth-history-icon-glow">
            <span className="absolute inset-2 rounded-full border border-growth-accent/35 border-t-transparent animate-spin" />
            <Film className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-black uppercase leading-none text-foreground">
            {t('generating')}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-foreground/50">
            {prompt}
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="growth-clip-pulse h-1.5 rounded-full bg-growth-accent/70"
                style={{ animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
          <h3 className="line-clamp-1 text-base font-black leading-tight text-foreground">
            {title}
          </h3>
          <div className="mt-1 truncate text-[11px] font-bold text-foreground/48">
            {model}
          </div>
        </div>
      </div>
    </article>
  );
}
