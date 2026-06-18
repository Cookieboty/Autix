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
import type { MaterialAsset, MaterialAssetType } from '@autix/shared-lib';
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
  MATERIAL_TARGET_OPTIONS,
  canUseMaterialAsTarget,
  defaultMaterialTargetForType,
  roleLabel,
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(94vw,560px)] gap-0 p-0 sm:max-w-none">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="size-4 text-primary" />
            灵感库
          </SheetTitle>
          <SheetDescription className="sr-only">
            汇总视频模板、历史项目和图片视频素材。
          </SheetDescription>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
            <InspirationTabButton active={tab === 'history'} icon={<History className="size-3.5" />} onClick={() => onTabChange('history')}>
              历史
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'materials'} icon={<FolderOpen className="size-3.5" />} onClick={() => onTabChange('materials')}>
              素材
            </InspirationTabButton>
            <InspirationTabButton active={tab === 'templates'} icon={<LayoutTemplate className="size-3.5" />} onClick={() => onTabChange('templates')}>
              模板
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
  const hasActiveFilter = search.trim().length > 0 || category !== 'all';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="搜索模板、场景或标签"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <CategoryChip active={category === 'all'} onClick={() => onCategoryChange('all')}>
            全部
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
          正在加载视频模板
        </div>
      ) : templates.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <LayoutTemplate className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">{hasActiveFilter ? '没有匹配的视频模板' : '还没有可用模板'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasActiveFilter ? '换一个关键词或分类试试。' : '可以用底部 chat 生成分镜。'}
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
  if (projects.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
        <History className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">暂无历史项目</p>
        <p className="mt-1 text-xs text-muted-foreground">生成或保存过的视频项目会显示在这里。</p>
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
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="搜索素材名称或标签"
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
              <SelectItem value="all" className="text-xs">全部素材</SelectItem>
              <SelectItem value="image" className="text-xs">图片素材</SelectItem>
              <SelectItem value="video" className="text-xs">视频素材</SelectItem>
              <SelectItem value="audio" className="text-xs">音频素材</SelectItem>
            </SelectContent>
          </Select>
          <Select value={target} onValueChange={(value) => onTargetChange(value as VideoMaterialTarget)}>
            <SelectTrigger className="h-9 border-border bg-background text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[70] rounded-lg">
              {MATERIAL_TARGET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  放入{option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          正在加载素材库
        </div>
      ) : materials.length === 0 ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <FolderOpen className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">暂无匹配素材</p>
          <p className="mt-1 text-xs text-muted-foreground">图片、视频和音频素材都可以在这里选择。</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {materials.map((asset) => (
            <MaterialAssetCard
              key={asset.id}
              asset={asset}
              target={target}
              onUse={() => onUseMaterial(asset)}
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
}: {
  asset: MaterialAsset;
  target: VideoMaterialTarget;
  onUse: () => void;
}) {
  const supported = canUseMaterialAsTarget(asset, target);
  const fallbackTarget = defaultMaterialTargetForType(asset.type);
  const actionLabel = supported ? `放入${roleLabel(target)}` : `放入${roleLabel(fallbackTarget)}`;

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
            <span className="text-xs text-muted-foreground">{asset.type === 'audio' ? '音频素材' : '文件素材'}</span>
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
      ? `${clipCount} 镜头`
      : `${Number.isFinite(duration) ? duration : 5}s · 单镜头`;
  const description =
    template.description ||
    (template.templateKind === 'workflow'
      ? '包含可直接编辑的分镜脚本、镜头参数与素材槽。'
      : '带入完整视频提示词和生成参数，可继续拆分镜或补充素材。');
  const kindLabel = template.templateKind === 'workflow' ? '分镜模板' : '视频模板';

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
          <span className="shrink-0">{metaLabel} · {template.useCount ?? 0} 次使用</span>
        </div>
        <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={applying} onClick={onApply}>
          {applying ? <Loader2 className="size-3.5 animate-spin" /> : <LayoutTemplate className="size-3.5" />}
          使用模板
        </Button>
      </div>
    </div>
  );
}
