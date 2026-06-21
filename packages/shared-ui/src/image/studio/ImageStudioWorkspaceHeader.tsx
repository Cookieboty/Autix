'use client';

import { ImageIcon, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../ui/button';

export function ImageStudioWorkspaceHeader({
  activeTemplateName,
  displayedTemplateName,
  onOpenSettings,
  onOpenInspiration,
  onOpenTemplateEditor,
}: {
  activeTemplateName?: string;
  displayedTemplateName?: string | null;
  onOpenSettings: () => void;
  onOpenInspiration: () => void;
  onOpenTemplateEditor?: () => void;
}) {
  const t = useTranslations('imageStudio');

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold">{t('header.title')}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {t('header.subtitle')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 lg:hidden" onClick={onOpenSettings}>
          <SlidersHorizontal className="size-3.5" />
          <span className="hidden sm:inline">{t('header.paramsButton')}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 xl:hidden"
          onClick={onOpenInspiration}
        >
          <ImageIcon className="size-3.5" />
          <span className="hidden sm:inline">{displayedTemplateName ?? t('inspiration.title')}</span>
        </Button>
        {activeTemplateName && onOpenTemplateEditor && (
          <Button variant="ghost" size="sm" onClick={onOpenTemplateEditor}>
            {t('header.variablesButton')}
          </Button>
        )}
      </div>
    </header>
  );
}
