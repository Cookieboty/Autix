'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Copy, ImageIcon, Info, Maximize2, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AuthorAvatar } from '../AuthorAvatar';

/** 折叠态 prompt 的最大高度（px）；超过则出现「See all」。 */
const PROMPT_COLLAPSED_HEIGHT = 104;

export type MediaDetailRow = { label: string; value: string };

/**
 * 媒体详情弹窗外壳 —— 历史详情、生成器广场 Tab、首页广场三处共用。
 *
 * 三处的**数据来源和可做的动作完全不同**（自己的生成记录 / 广场作品 / feed item），
 * 但外观必须是同一个：全屏黑底 + 当前图放大高斯模糊铺底、左图右面板、PROMPT 折叠卡、
 * DETAILS 折叠卡。所以这里只固化「长什么样」，把「有什么内容、能做什么」全部开成插槽：
 * details 给行、footer 给按钮、aboveePrompt 给指标条、mediaOverlay 给图片区浮层。
 *
 * 不这么抽的话，改一次视觉要同时动三个文件，早晚会漂。
 */
export function MediaDetailShell({
  open,
  onClose,
  mediaUrl,
  isVideo,
  poster,
  mediaAlt,
  author,
  authorSubtitle,
  prompt,
  details,
  footer,
  mediaOverlay,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  isVideo?: boolean;
  poster?: string | null;
  mediaAlt?: string;
  author: { name: string; avatarUrl?: string | null };
  /** 作者名下面那行小字（历史里是「作者」，广场里也是）。 */
  authorSubtitle: string;
  prompt: string;
  details: MediaDetailRow[];
  /** 面板底部动作区。 */
  footer?: ReactNode;
  /** 图片区里的浮层（历史详情的多图候选缩略图）。 */
  mediaOverlay?: ReactNode;
  ariaLabel?: string;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptOverflows, setPromptOverflows] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const mediaWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setPromptExpanded(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 「See all」只在 prompt 真的被截断时出现——不靠字数猜，直接量折叠态有没有溢出。
  useLayoutEffect(() => {
    const element = promptRef.current;
    if (!element) return;
    setPromptOverflows(element.scrollHeight > PROMPT_COLLAPSED_HEIGHT + 1);
  }, [prompt, open]);

  if (!open || typeof document === 'undefined') return null;

  const copyPrompt = () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  // 视频没有「放大模糊」的静帧可用，退回封面图
  const backdropUrl = isVideo ? poster ?? null : mediaUrl;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex bg-[#000c] text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || prompt || t('historyDetail')}
    >
      {/* 背景层：黑底 + 当前图放大高斯模糊 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 z-0 overflow-hidden bg-black">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full scale-105 object-cover opacity-50 blur-3xl"
            />
          ) : null}
        </div>
      </div>

      {/* 左：媒体区。点背景**不关闭** —— 详情里要拖拽/框选/长按看图，误触退出很恼人；
          退出只认右上角的关闭按钮和 Esc */}
      <div className="relative flex min-w-0 flex-1 items-center justify-center p-6">
        <div ref={mediaWrapRef} className="relative grid max-h-full place-items-center">
          {mediaUrl ? (
            isVideo ? (
              <video
                src={mediaUrl}
                poster={poster ?? undefined}
                controls
                playsInline
                className="max-h-[calc(100svh-3rem)] max-w-full object-contain"
              />
            ) : (
              /* 真实图片：不加圆角、不加阴影。外围辉光由背景层负责 */
              <img
                src={mediaUrl}
                alt={mediaAlt ?? prompt ?? ''}
                className="max-h-[calc(100svh-3rem)] max-w-full object-contain"
              />
            )
          ) : (
            <div className="grid size-40 place-items-center rounded-md bg-white/[0.06] text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        {mediaOverlay}

        {mediaUrl ? (
          <div className="absolute bottom-6 right-6 flex gap-1">
            <IconAction
              label={t('fullscreen')}
              onClick={() => void mediaWrapRef.current?.requestFullscreen?.()}
            >
              <Maximize2 className="size-4" />
            </IconAction>
          </div>
        ) : null}
      </div>

      {/* 右：信息面板 */}
      <aside className="relative m-3 flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-[rgba(35,38,42,0.75)] p-3 backdrop-blur-xl">
        <header className="flex items-center justify-between gap-3 px-1 pt-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <AuthorAvatar
              name={author.name}
              avatarUrl={author.avatarUrl}
              className="size-8"
              textClassName="text-xs"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{author.name}</p>
              <p className="truncate text-xs font-semibold text-foreground/42">{authorSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-foreground/50 transition hover:bg-white/[0.08] hover:text-foreground"
            aria-label={t('close')}
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        {/* PROMPT */}
        <section className="rounded-xl bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/42">
              <Sparkles className="size-3.5" />
              {t('prompt')}
            </h3>
            <button
              type="button"
              onClick={copyPrompt}
              className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md bg-white/[0.06] px-2 text-[11px] font-bold text-foreground/72 transition hover:bg-white/[0.12] hover:text-foreground"
            >
              <Copy className="size-3" />
              {copied ? t('copied') : t('copyPrompt')}
            </button>
          </div>
          <div className="relative">
            <p
              ref={promptRef}
              className={`whitespace-pre-wrap text-[13px] font-medium leading-5 text-foreground/62 ${
                promptExpanded ? 'max-h-64 overflow-y-auto' : 'overflow-hidden'
              }`}
              style={promptExpanded ? undefined : { maxHeight: PROMPT_COLLAPSED_HEIGHT }}
            >
              {prompt || t('noPrompt')}
            </p>
            {!promptExpanded && promptOverflows ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[rgba(38,41,45,0.98)] to-transparent" />
            ) : null}
          </div>
          {promptOverflows ? (
            <button
              type="button"
              onClick={() => setPromptExpanded((prev) => !prev)}
              className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-foreground/55 transition hover:text-foreground"
            >
              {promptExpanded ? t('seeLess') : t('seeAll')}
              <ChevronDown
                className={`size-3.5 transition-transform ${promptExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </section>

        {/* DETAILS */}
        {details.length > 0 ? (
          <section className="rounded-xl bg-white/[0.04] p-3">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              aria-expanded={detailsOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-2"
            >
              <h3 className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/42">
                <Info className="size-3.5" />
                {t('details')}
              </h3>
              <ChevronDown
                className={`size-4 text-foreground/42 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {detailsOpen ? (
              <dl className="mt-3 grid gap-1.5 text-[13px]">
                {details.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt className="text-foreground/42">{row.label}</dt>
                    <dd className="min-w-0 truncate text-right font-bold text-foreground/78">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ) : null}

        <div className="flex-1" />

        {footer}
      </aside>
    </div>,
    document.body,
  );
}

/** 面板底部的通用按钮（三处共用同一款外观）。 */
export function DetailPanelButton({
  children,
  onClick,
  square,
  primary,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
}: {
  children: ReactNode;
  onClick: () => void;
  square?: boolean;
  /** 主按钮（广场的「使用提示词」）：强调色实底。 */
  primary?: boolean;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
        primary
          ? 'growth-accent-glow-sm bg-growth-accent text-background hover:bg-growth-accent-hover'
          : 'border border-white/10 bg-white/[0.06] text-foreground/85 hover:bg-white/[0.12] hover:text-foreground'
      } ${square ? 'size-10' : 'px-3'}`}
    >
      {children}
    </button>
  );
}

function IconAction({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 cursor-pointer place-items-center rounded-lg bg-[rgba(35,38,42,0.75)] text-foreground/85 backdrop-blur-md transition hover:bg-[rgba(52,56,62,0.85)] hover:text-foreground"
    >
      {children}
    </button>
  );
}
