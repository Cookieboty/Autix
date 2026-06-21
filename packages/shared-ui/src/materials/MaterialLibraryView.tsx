'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileIcon,
  ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import {
  MaterialUploadError,
  useMaterialStore,
  type MaterialAsset,
  type MaterialAssetType,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

type FilterType = MaterialAssetType | 'all';

const TYPE_OPTIONS: Array<{ value: FilterType; key: FilterType }> = [
  { value: 'all', key: 'all' },
  { value: 'image', key: 'image' },
  { value: 'video', key: 'video' },
  { value: 'audio', key: 'audio' },
  { value: 'file', key: 'file' },
];

const SOURCE_KEYS: Record<string, string> = {
  upload: 'upload',
  image_generation: 'imageGeneration',
  video_generation: 'videoGeneration',
  external: 'external',
};

function inferMaterialType(file: File): MaterialAssetType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatBytes(size: number | null | undefined, unknownSize: string) {
  if (!size || size <= 0) return unknownSize;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function mediaIcon(type: MaterialAssetType) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  if (type === 'audio') return Music;
  return FileIcon;
}

export function MaterialLibraryView() {
  const t = useTranslations('materials');
  const {
    items,
    entitlement,
    loading,
    loadMaterials: loadStoredMaterials,
    uploadMaterialFiles,
    deleteMaterial,
    deleteMaterials,
  } = useMaterialStore();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCount = selectedIds.size;
  const canAdd = Boolean(entitlement?.canAdd);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const loadMaterials = useCallback(async () => {
    try {
      await loadStoredMaterials({
        type: filterType,
        search: search.trim() || undefined,
        pageSize: 80,
      });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('loadFailed'));
    }
  }, [filterType, loadStoredMaterials, search, t]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    if (!canAdd) {
      toast.error(entitlement?.reason ?? t('membershipRequired'));
      return;
    }

    const uploadFiles = Array.from(files);
    setUploading(true);
    try {
      await uploadMaterialFiles(
        uploadFiles.map((file) => ({
          type: inferMaterialType(file),
          file,
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          thumbnailUrl: inferMaterialType(file) === 'image' ? undefined : null,
          sourceType: 'upload',
        })),
      );
      toast.success(t('uploadedCount', { count: uploadFiles.length }));
      await loadMaterials();
    } catch (error) {
      if (error instanceof MaterialUploadError) {
        toast.error(t('uploadFileFailed', { name: error.fileName }));
      } else {
        toast.error(error instanceof Error ? error.message : t('uploadFailed'));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteOne = async (asset: MaterialAsset) => {
    await deleteMaterial(asset.id);
    toast.success(t('deleteSuccess'));
    await loadMaterials();
  };

  const deleteSelected = async () => {
    if (selectedCount === 0) return;
    await deleteMaterials(Array.from(selectedIds));
    toast.success(t('deleteSelectedSuccess', { count: selectedCount }));
    await loadMaterials();
  };

  const invertSelection = () => {
    setSelectedIds((current) => {
      const next = new Set<string>();
      for (const item of items) {
        if (!current.has(item.id)) next.add(item.id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openDownload = (asset: MaterialAsset) => {
    window.open(asset.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.zip,.psd,.ai"
        className="hidden"
        onChange={(event) => void handleUpload(event.target.files)}
      />

      <header className="border-b border-border bg-background/95 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={canAdd ? 'default' : 'outline'}>
              {canAdd
                ? entitlement?.levelName
                  ? t('membershipAvailableWithLevel', { level: entitlement.levelName })
                  : t('membershipAvailable')
                : t('viewOnly')}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMaterials()}
              disabled={loading || uploading}
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              {t('refresh')}
            </Button>
            <Button
              type="button"
              disabled={!canAdd || uploading}
              onClick={() => fileInputRef.current?.click()}
              title={!canAdd ? entitlement?.reason ?? t('membershipRequired') : undefined}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t('upload')}
            </Button>
          </div>
        </div>
        {!canAdd && entitlement?.reason && (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
            {entitlement.reason}{t('expiredHintSuffix')}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterType(option.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                filterType === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`type.${option.key}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 lg:max-w-md">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9"
            />
          </label>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-2 text-sm">
          <span>{t('selectedCount', { count: selectedCount })}</span>
          <div className="flex items-center gap-2">
            {selectedItems.length === 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => openDownload(selectedItems[0])}>
                <Download className="size-4" />
                {t('download')}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={invertSelection}>
              {t('invertSelection')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              {t('clearSelection')}
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()}>
              <Trash2 className="size-4" />
              {t('deleteSelected')}
            </Button>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <ImageIcon className="mb-3 size-10 text-muted-foreground" />
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('emptyDescription')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1920px]:grid-cols-7">
            {items.map((asset) => (
              <MaterialCard
                key={asset.id}
                asset={asset}
                selected={selectedIds.has(asset.id)}
                onSelectedChange={(checked) => toggleSelected(asset.id, checked)}
                onDelete={() => void deleteOne(asset)}
                onDownload={() => openDownload(asset)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MaterialCard({
  asset,
  selected,
  onSelectedChange,
  onDelete,
  onDownload,
}: {
  asset: MaterialAsset;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const t = useTranslations('materials');
  const Icon = mediaIcon(asset.type);
  const sourceKey = SOURCE_KEYS[asset.sourceType];
  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border/80',
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {asset.type === 'image' ? (
          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : asset.type === 'video' ? (
          <video
            src={asset.url}
            poster={asset.thumbnailUrl ?? undefined}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            muted
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="size-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/70 opacity-80" />
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={t('selectAsset', { title: asset.title })}
            className="border-white/70 bg-black/40 text-white"
          />
          <Badge variant="secondary" className="bg-black/55 text-white backdrop-blur-sm">
            {t(`type.${asset.type}`)}
          </Badge>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div>
          <h3 className="line-clamp-1 text-sm font-medium" title={asset.title}>
            {asset.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {sourceKey ? t(`source.${sourceKey}`) : asset.sourceType} · {formatBytes(asset.size, t('unknownSize'))}
          </p>
        </div>
        {asset.tags.length > 0 && (
          <div className="flex min-h-5 flex-wrap gap-1">
            {asset.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8 flex-1" onClick={onDownload}>
            <Download className="size-4" />
            {t('download')}
          </Button>
          <Button type="button" variant="destructive" size="icon-sm" className="size-8" onClick={onDelete} aria-label={t('deleteAsset')}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
