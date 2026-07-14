'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Image as ImageIcon, Info, Sparkles, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageTemplate } from '@autix/shared-store';
import { resolveTemplatePrompt } from '../media-inputs';
import { imageTemplateCover } from '../generator-studio-helpers';

export function PublicImageTemplateDialog({
  template,
  onClose,
  onUsePrompt,
}: {
  template: ImageTemplate | null;
  onClose: () => void;
  onUsePrompt: (template: ImageTemplate) => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');
  const [copied, setCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const cover = template ? imageTemplateCover(template) : null;
  const prompt = template ? resolveTemplatePrompt(template) || template.prompt : '';

  useEffect(() => {
    if (!template) return;
    setCopied(false);
    setPromptExpanded(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, template]);

  if (!template) return null;

  const copyPrompt = () => {
    if (!prompt || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  const author = template.authorName || template.authorUrl || t('unknownAuthor');
  const authorInitial = author.trim()[0]?.toUpperCase() || 'A';

  return (
    <div
      className="fixed inset-0 z-[80] flex bg-background/82 text-foreground backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={template.title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('close')}
        onClick={onClose}
      />
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_400px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {cover ? (
            <img
              src={cover}
              alt={template.title}
              className="max-h-[calc(100svh-3rem)] max-w-full rounded-xl object-contain"
            />
          ) : (
            <div className="grid size-40 place-items-center rounded-xl bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="growth-dialog-shadow flex min-h-0 flex-col rounded-xl border border-border bg-card p-4">
          {/* 头部：作者 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-growth-accent text-sm font-black text-background">
                {template.authorUrl && template.authorName ? (
                  <img src={template.authorUrl} alt={author} className="h-full w-full object-cover" />
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

          <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {/* PROMPT */}
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/50">
                  <Sparkles className="size-3.5" />
                  {t('prompt')}
                </h3>
                <button
                  type="button"
                  className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                  onClick={copyPrompt}
                >
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyPrompt')}
                </button>
              </div>
              <p
                className={`whitespace-pre-wrap text-sm leading-6 text-foreground/70 ${
                  promptExpanded ? '' : 'line-clamp-4'
                }`}
              >
                {prompt || t('noPrompt')}
              </p>
              {prompt ? (
                <button
                  type="button"
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-border py-1.5 text-xs font-semibold text-foreground/55 transition hover:bg-secondary hover:text-foreground"
                  onClick={() => setPromptExpanded((value) => !value)}
                >
                  {promptExpanded ? 'Show less' : 'See all'}
                  <ChevronDown
                    className={`size-3.5 transition-transform ${promptExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : null}
            </section>

            <div className="h-px bg-border" />

            {/* INFORMATION */}
            <section>
              <h3 className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-foreground/50">
                <Info className="size-3.5" />
                {t('information')}
              </h3>
              <div className="mt-2 divide-y divide-border/60 text-sm">
                <TemplateInfoRow label={t('model')} value={template.modelHint || t('auto')} />
                <TemplateInfoRow label={t('category')} value={template.category || '-'} />
                <TemplateInfoRow label={t('usageCount')} value={String(template.useCount ?? 0)} />
              </div>
            </section>
          </div>

          <button
            type="button"
            className="growth-accent-glow-sm mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-growth-accent px-4 text-base font-black text-background transition hover:bg-growth-accent-hover"
            onClick={() => onUsePrompt(template)}
          >
            <WandSparkles className="size-5" />
            {t('usePrompt')}
          </button>
        </aside>
      </div>
    </div>
  );
}

function TemplateInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 py-2">
      <span className="text-foreground/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/82">{value}</span>
    </div>
  );
}
