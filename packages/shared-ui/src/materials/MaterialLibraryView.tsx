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
  materialsApi,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialEntitlement,
} from '@autix/shared-lib';
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
  const [items, setItems] = useState<MaterialAsset[]>([]);
  const [entitlement, setEntitlement] = useState<MaterialEntitlement | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const res = await materialsApi.list({
        type: filterType,
        search: search.trim() || undefined,
        pageSize: 80,
      });
      setItems(res.data.items ?? []);
      setEntitlement(res.data.entitlement);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filterType, search]);

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
      for (const file of uploadFiles) {
        const presign = await materialsApi.uploadUrl({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        });
        const uploadRes = await fetch(presign.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(t('uploadFileFailed', { name: file.name }));
        await materialsApi.create({
          type: inferMaterialType(file),
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          url: presign.data.publicUrl,
          thumbnailUrl: inferMaterialType(file) === 'image' ? presign.data.publicUrl : null,
          mimeType: file.type || null,
          size: file.size,
          storageKey: presign.data.key,
          sourceType: 'upload',
        });
      }
      toast.success(t('uploadedCount', { count: uploadFiles.length }));
      await loadMaterials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteOne = async (asset: MaterialAsset) => {
    await materialsApi.remove(asset.id);
    toast.success(t('deleteSuccess'));
    await loadMaterials();
  };

  const deleteSelected = async () => {
    if (selectedCount === 0) return;
    await materialsApi.batchDelete(Array.from(selectedIds));
    toast.success(t('deleteSelectedSuccess', { count: selectedCount }));
    await loadMaterials();
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        'group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {asset.type === 'image' ? (
          <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" loading="lazy" />
        ) : asset.type === 'video' ? (
          <video
            src={asset.url}
            poster={asset.thumbnailUrl ?? undefined}
            className="h-full w-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="size-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={t('selectAsset', { title: asset.title })}
            className="border-white/70 bg-black/40 text-white"
          />
          <Badge variant="secondary">{t(`type.${asset.type}`)}</Badge>
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <h3 className="line-clamp-1 text-sm font-medium" title={asset.title}>
            {asset.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {sourceKey ? t(`source.${sourceKey}`) : asset.sourceType} · {formatBytes(asset.size, t('unknownSize'))}
          </p>
        </div>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onDownload}>
            <Download className="size-4" />
            {t('download')}
          </Button>
          <Button type="button" variant="destructive" size="icon-sm" onClick={onDelete} aria-label={t('deleteAsset')}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
