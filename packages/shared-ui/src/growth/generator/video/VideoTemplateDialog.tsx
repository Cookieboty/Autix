'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { VideoInspirationTemplates } from '../../../video/workbench/dialogs/VideoInspirationTemplates';
import type { WorkbenchVideoTemplate } from '../../../video/workbench/constants';

export function PublicVideoTemplateDialog({
  open,
  templates,
  categories,
  loading,
  search,
  category,
  applyingId,
  onSearchChange,
  onCategoryChange,
  onApply,
  onClose,
}: {
  open: boolean;
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  loading: boolean;
  search: string;
  category: string;
  applyingId: string | null;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
  onClose: () => void;
}) {
  const t = useTranslations('publicGrowth.generator.studio');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[80] text-foreground">
      <div className="growth-sheet-shadow pointer-events-auto fixed inset-x-3 bottom-3 flex max-h-[calc(100svh-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-border bg-card/88 ring-1 ring-border/35 backdrop-blur-2xl md:inset-x-5 md:bottom-5 md:top-auto md:max-h-none lg:bottom-auto lg:left-auto lg:right-[max(356px,calc((100vw-1800px)/2+356px))] lg:top-[clamp(120px,20vh,180px)] lg:h-[min(640px,calc(100svh-clamp(120px,20vh,180px)-24px))] lg:w-[min(560px,calc(100vw-max(356px,calc((100vw-1800px)/2+356px))-24px))] xl:w-[min(600px,calc(100vw-max(356px,calc((100vw-1800px)/2+356px))-32px))]">
        <div className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-border bg-card/72 px-3 md:h-[58px]">
          <span className="text-sm font-bold">{t('chooseTemplate')}</span>
          <button
            type="button"
            aria-label={t('close')}
            onClick={onClose}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-foreground/70 transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <div className="growth-dialog-body-bg min-h-0 flex-1 overflow-y-auto p-3">
          <VideoInspirationTemplates
            templates={templates}
            categories={categories}
            loading={loading}
            search={search}
            category={category}
            applyingId={applyingId}
            onSearchChange={onSearchChange}
            onCategoryChange={onCategoryChange}
            onApply={onApply}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
