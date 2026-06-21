import type React from 'react';
import { Layers, LayoutTemplate, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../ui/button';
import { cn } from '../../../ui/utils';
import type { WorkbenchVideoTemplate } from '../constants';

export function VideoInspirationTemplates({
  templates,
  categories,
  loading,
  search,
  category,
  applyingId,
  onSearchChange,
  onCategoryChange,
  onApply,
}: {
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  loading: boolean;
  search: string;
  category: string;
  applyingId: string | null;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.templates');
  const hasActiveFilter = search.trim().length > 0 || category !== 'all';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <CategoryChip active={category === 'all'} onClick={() => onCategoryChange('all')}>
            {t('categoryAll')}
          </CategoryChip>
          {categories.map((item) => (
            <CategoryChip key={item} active={category === item} onClick={() => onCategoryChange(item)}>
              {item}
            </CategoryChip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          {t('loading')}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">{hasActiveFilter ? t('noMatch') : t('empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilter ? t('noMatchHint') : t('emptyHint')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <VideoTemplateCard
              key={template.templateKey}
              template={template}
              applying={applyingId === template.templateKey}
              onApply={() => onApply(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'h-8 shrink-0 rounded-md border px-3 text-xs transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function VideoTemplateCard({
  template,
  applying,
  onApply,
}: {
  template: WorkbenchVideoTemplate;
  applying: boolean;
  onApply: () => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.templates');
  const clipCount = template.templateKind === 'workflow' ? template.clips.length : 1;
  const defaultParams =
    template.templateKind === 'standard'
      ? ((template.defaultParams ?? {}) as Record<string, unknown>)
      : {};
  const duration = template.templateKind === 'standard'
    ? Number(defaultParams.duration ?? template.durationSec ?? 5)
    : null;
  const metaLabel =
    template.templateKind === 'workflow'
      ? t('workflowMeta', { count: clipCount })
      : t('standardMeta', { duration: Number.isFinite(duration) ? (duration as number) : 5 });
  const description =
    template.description ||
    (template.templateKind === 'workflow'
      ? t('workflowDescriptionFallback')
      : t('standardDescriptionFallback'));
  const kindLabel =
    template.templateKind === 'workflow' ? t('kindWorkflow') : t('kindStandard');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/45">
      <div className="aspect-video bg-muted">
        {template.coverImage ? (
          <img src={template.coverImage} alt={template.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Layers className="size-7 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{template.title}</p>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{template.category}</span>
          <span className="shrink-0">
            {metaLabel} · {t('useCount', { count: template.useCount ?? 0 })}
          </span>
        </div>
        <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={applying} onClick={onApply}>
          {applying ? <Loader2 className="size-3.5 animate-spin" /> : <LayoutTemplate className="size-3.5" />}
          {t('useTemplate')}
        </Button>
      </div>
    </div>
  );
}
