import type React from 'react';
import {
  FolderOpen,
  History,
  ImageIcon,
  Layers,
  LayoutTemplate,
  Loader2,
  Music2,
  Plus,
  Search,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialAssetType } from '@autix/shared-store';
import type { VideoProject } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import { VideoHistoryProjectCard } from '../../VideoHistoryProjectCard';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { cn } from '../../../ui/utils';
import {
  MATERIAL_TARGET_VALUES,
  canUseMaterialAsTarget,
  defaultMaterialTargetForType,
  roleLabel,
  type MaterialTargetLabelMessages,
  type VideoInspirationTab,
  type VideoMaterialTarget,
  type WorkbenchVideoTemplate,
} from '../constants';

export function VideoInspirationSheet({
  open,
  onOpenChange,
  tab,
  onTabChange,
  templates,
  categories,
  templatesLoading,
  templateSearch,
  templateCategory,
  applyingId,
  onTemplateSearchChange,
  onTemplateCategoryChange,
  onApply,
  historyProjects,
  onSelectProject,
  materials,
  materialsLoading,
  materialSearch,
  materialType,
  materialTarget,
  onMaterialSearchChange,
  onMaterialTypeChange,
  onMaterialTargetChange,
  onUseMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: VideoInspirationTab;
  onTabChange: (tab: VideoInspirationTab) => void;
  templates: WorkbenchVideoTemplate[];
  categories: string[];
  templatesLoading: boolean;
  templateSearch: string;
  templateCategory: string;
  applyingId: string | null;
  onTemplateSearchChange: (search: string) => void;
  onTemplateCategoryChange: (category: string) => void;
  onApply: (template: WorkbenchVideoTemplate) => void;
  historyProjects: VideoProject[];
  onSelectProject: (projectId: string) => void;
  materials: MaterialAsset[];
  materialsLoading: boolean;
  materialSearch: string;
  materialType: MaterialAssetType | 'all';
  materialTarget: VideoMaterialTarget;
  onMaterialSearchChange: (search: string) => void;
  onMaterialTypeChange: (type: MaterialAssetType | 'all') => void;
  onMaterialTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet');
  const tTargets = useTranslations('videoWorkbench.materialTargets');
  const targetMessages: MaterialTargetLabelMessages = {
    firstFrame: tTargets('firstFrame'),
    lastFrame: tTargets('lastFrame'),
    referenceImage: tTargets('referenceImage'),
    referenceVideo: tTargets('referenceVideo'),
    referenceAudio: tTargets('referenceAudio'),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(94vw,560px)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="size-4 text-primary" />
            {t('title')}
          </SheetTitle>
          <SheetDescription className="sr-only">{t('description')}</SheetDescription>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
            <InspirationTabButton active={tab === 'history'} icon={<History className="size-3.5" />} onClick={() => onTabChange('history')}>
              {t('tabs.history')}
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'materials'} icon={<FolderOpen className="size-3.5" />} onClick={() => onTabChange('materials')}>
              {t('tabs.materials')}
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'templates'} icon={<LayoutTemplate className="size-3.5" />} onClick={() => onTabChange('templates')}>
              {t('tabs.templates')}
            </InspirationTabButton>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'templates' ? (
            <VideoInspirationTemplates
              templates={templates}
              categories={categories}
              loading={templatesLoading}
              search={templateSearch}
              category={templateCategory}
              applyingId={applyingId}
              onSearchChange={onTemplateSearchChange}
              onCategoryChange={onTemplateCategoryChange}
              onApply={onApply}
            />
          ) : tab === 'history' ? (
            <VideoInspirationHistory projects={historyProjects} onSelectProject={onSelectProject} />
          ) : (
            <VideoInspirationMaterials
              materials={materials}
              loading={materialsLoading}
              search={materialSearch}
              type={materialType}
              target={materialTarget}
              onSearchChange={onMaterialSearchChange}
              onTypeChange={onMaterialTypeChange}
              onTargetChange={onMaterialTargetChange}
              onUseMaterial={onUseMaterial}
              targetMessages={targetMessages}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InspirationTabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function VideoInspirationTemplates({
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

function VideoInspirationHistory({
  projects,
  onSelectProject,
}: {
  projects: VideoProject[];
  onSelectProject: (projectId: string) => void;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.history');
  if (projects.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <History className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">{t('empty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <VideoHistoryProjectCard
          key={project.id}
          project={project}
          onSelectProject={onSelectProject}
        />
      ))}
    </div>
  );
}

function VideoInspirationMaterials({
  materials,
  loading,
  search,
  type,
  target,
  onSearchChange,
  onTypeChange,
  onTargetChange,
  onUseMaterial,
  targetMessages,
}: {
  materials: MaterialAsset[];
  loading: boolean;
  search: string;
  type: MaterialAssetType | 'all';
  target: VideoMaterialTarget;
  onSearchChange: (search: string) => void;
  onTypeChange: (type: MaterialAssetType | 'all') => void;
  onTargetChange: (target: VideoMaterialTarget) => void;
  onUseMaterial: (asset: MaterialAsset) => void;
  targetMessages: MaterialTargetLabelMessages;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.materials');
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
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={type} onValueChange={(value) => onTypeChange(value as MaterialAssetType | 'all')}>
            <SelectTrigger className="h-9 border-border bg-background text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[70] rounded-lg">
              <SelectItem value="all" className="text-xs">{t('typeAll')}</SelectItem>
              <SelectItem value="image" className="text-xs">{t('typeImage')}</SelectItem>
              <SelectItem value="video" className="text-xs">{t('typeVideo')}</SelectItem>
              <SelectItem value="audio" className="text-xs">{t('typeAudio')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={target} onValueChange={(value) => onTargetChange(value as VideoMaterialTarget)}>
            <SelectTrigger className="h-9 border-border bg-background text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[70] rounded-lg">
              {MATERIAL_TARGET_VALUES.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {t('targetAction', { target: roleLabel(option.value, targetMessages) })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          {t('loading')}
        </div>
      ) : materials.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <FolderOpen className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">{t('empty')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((asset) => (
            <MaterialAssetCard
              key={asset.id}
              asset={asset}
              target={target}
              onUse={() => onUseMaterial(asset)}
              targetMessages={targetMessages}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialAssetCard({
  asset,
  target,
  onUse,
  targetMessages,
}: {
  asset: MaterialAsset;
  target: VideoMaterialTarget;
  onUse: () => void;
  targetMessages: MaterialTargetLabelMessages;
}) {
  const t = useTranslations('videoWorkbench.inspirationSheet.materials');
  const supported = canUseMaterialAsTarget(asset, target);
  const fallbackTarget = defaultMaterialTargetForType(asset.type);
  const actionLabel = supported
    ? t('targetAction', { target: roleLabel(target, targetMessages) })
    : t('targetAction', { target: roleLabel(fallbackTarget, targetMessages) });

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/45">
      <div className="aspect-video bg-muted">
        {asset.type === 'image' ? (
          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
        ) : asset.type === 'video' ? (
          <video src={asset.url} poster={asset.thumbnailUrl ?? undefined} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            {asset.type === 'audio' ? <Music2 className="size-7 text-muted-foreground" /> : <FolderOpen className="size-7 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              {asset.type === 'audio' ? t('audioFallback') : t('fileFallback')}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{asset.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{asset.type}</p>
          </div>
          {asset.type === 'image' ? (
            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : asset.type === 'video' ? (
            <Video className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Music2 className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={onUse}>
          <Plus className="size-3.5" />
          {actionLabel}
        </Button>
      </div>
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
