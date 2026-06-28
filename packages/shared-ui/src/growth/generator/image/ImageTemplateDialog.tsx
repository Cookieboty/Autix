'use client';

import { useEffect, useState } from 'react';
import { Copy, Image as ImageIcon, Info, Sparkles, WandSparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ImageTemplate } from '@autix/shared-store';
import { resolveTemplatePrompt } from '../../../image/studio/constants';
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
  const cover = template ? imageTemplateCover(template) : null;
  const prompt = template ? resolveTemplatePrompt(template) || template.prompt : '';

  useEffect(() => {
    if (!template) return;
    setCopied(false);
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
      <div className="relative z-10 grid min-h-0 w-full grid-cols-1 gap-4 p-4 md:grid-cols-[minmax(0,1fr)_390px] md:p-6">
        <div className="relative flex min-h-[52svh] items-center justify-center overflow-hidden rounded-md bg-secondary">
          {cover ? (
            <img
              src={cover}
              alt={template.title}
              className="max-h-[calc(100svh-3rem)] max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="grid size-40 place-items-center rounded-md bg-secondary text-foreground/36">
              <ImageIcon className="size-12" />
            </div>
          )}
        </div>

        <aside className="growth-dialog-shadow flex min-h-0 flex-col rounded-md border border-border bg-card/96 p-4">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-growth-accent text-background">
                <WandSparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-black">{template.title}</h2>
                <p className="truncate text-sm font-semibold text-foreground/45">{author}</p>
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

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="rounded-md bg-secondary p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                  <Sparkles className="size-4" />
                  {t('prompt')}
                </h3>
                <button
                  type="button"
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-bold text-foreground/72 hover:bg-secondary hover:text-foreground"
                  onClick={copyPrompt}
                >
                  <Copy className="size-3.5" />
                  {copied ? t('copied') : t('copyPrompt')}
                </button>
              </div>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-background/18 p-3 text-sm font-medium leading-6 text-foreground/62">
                {prompt || t('noPrompt')}
              </p>
            </section>

            <section className="rounded-md bg-secondary p-4">
              <h3 className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase text-foreground/50">
                <Info className="size-4" />
                {t('information')}
              </h3>
              <div className="divide-y divide-border text-sm">
                <TemplateInfoRow label={t('model')} value={template.modelHint || t('auto')} />
                <TemplateInfoRow label={t('category')} value={template.category || '-'} />
                <TemplateInfoRow label={t('usageCount')} value={String(template.useCount ?? 0)} />
              </div>
            </section>
          </div>

          <button
            type="button"
            className="growth-accent-glow-sm mt-5 inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-growth-accent px-4 text-base font-black text-background hover:bg-foreground"
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
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <span className="text-foreground/42">{label}</span>
      <span className="min-w-0 truncate text-right font-bold text-foreground/78">{value}</span>
    </div>
  );
}
