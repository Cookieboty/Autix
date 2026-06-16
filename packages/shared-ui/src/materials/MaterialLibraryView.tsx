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
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

type FilterType = MaterialAssetType | 'all';

const TYPE_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
];

const TYPE_LABEL: Record<MaterialAssetType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  file: '文件',
};

const SOURCE_LABEL: Record<string, string> = {
  upload: '上传',
  image_generation: '图片生成',
  video_generation: '视频生成',
  external: '外部来源',
};

function inferMaterialType(file: File): MaterialAssetType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return '未知大小';
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
      toast.error(error instanceof Error ? error.message : '素材库加载失败');
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
      toast.error(entitlement?.reason ?? '需要有效会员才能新增素材');
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
        if (!uploadRes.ok) throw new Error(`${file.name} 上传失败`);
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
      toast.success(`已上传 ${uploadFiles.length} 个素材`);
      await loadMaterials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '素材上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteOne = async (asset: MaterialAsset) => {
    await materialsApi.remove(asset.id);
    toast.success('素材已删除');
    await loadMaterials();
  };

  const deleteSelected = async () => {
    if (selectedCount === 0) return;
    await materialsApi.batchDelete(Array.from(selectedIds));
    toast.success(`已删除 ${selectedCount} 个素材`);
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
            <h1 className="text-xl font-semibold">素材库</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              上传、整理和复用图片、视频、音频等创作素材。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={canAdd ? 'default' : 'outline'}>
              {canAdd ? `会员可用${entitlement?.levelName ? ` · ${entitlement.levelName}` : ''}` : '仅查看/下载'}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMaterials()}
              disabled={loading || uploading}
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              刷新
            </Button>
            <Button
              type="button"
              disabled={!canAdd || uploading}
              onClick={() => fileInputRef.current?.click()}
              title={!canAdd ? entitlement?.reason ?? '需要有效会员才能新增素材' : undefined}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              上传素材
            </Button>
          </div>
        </div>
        {!canAdd && entitlement?.reason && (
          <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200">
            {entitlement.reason}。会员过期后仍可查看和下载已有素材，但不能新增或在工作台中使用。
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
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 lg:max-w-md">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、标签或来源"
              className="pl-9"
            />
          </label>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-2 text-sm">
          <span>已选择 {selectedCount} 个素材</span>
          <div className="flex items-center gap-2">
            {selectedItems.length === 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => openDownload(selectedItems[0])}>
                <Download className="size-4" />
                下载
              </Button>
            )}
            <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()}>
              <Trash2 className="size-4" />
              批量删除
            </Button>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            正在加载素材...
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <ImageIcon className="mb-3 size-10 text-muted-foreground" />
            <p className="text-sm font-medium">暂无素材</p>
            <p className="mt-1 text-xs text-muted-foreground">上传素材或从图片/视频历史中加入素材库。</p>
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
  const Icon = mediaIcon(asset.type);
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
            aria-label={`选择 ${asset.title}`}
            className="border-white/70 bg-black/40 text-white"
          />
          <Badge variant="secondary">{TYPE_LABEL[asset.type]}</Badge>
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div>
          <h3 className="line-clamp-1 text-sm font-medium" title={asset.title}>
            {asset.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {SOURCE_LABEL[asset.sourceType] ?? asset.sourceType} · {formatBytes(asset.size)}
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
            下载
          </Button>
          <Button type="button" variant="destructive" size="icon-sm" onClick={onDelete} aria-label="删除素材">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
