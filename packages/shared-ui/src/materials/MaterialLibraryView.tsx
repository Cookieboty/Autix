'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Upload } from 'lucide-react';
import {
  MaterialUploadError,
  useMaterialFolderStore,
  useMaterialStore,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialFolder,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { MaterialFilterBar, type FilterType, type LibrarySourceFilter } from './MaterialFilterBar';
import {
  DeleteFolderDialog,
  MaterialFolderMobileSelector,
  MaterialFolderSidebarNav,
} from './MaterialFolderSidebar';
import { MaterialGrid, MoveToMenu } from './MaterialGrid';
import { MaterialHistoryPanel } from './MaterialHistoryPanel';

function inferMaterialType(file: File): MaterialAssetType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

// ── Main component ───────────────────────────────────────────────────────────

/**
 * 素材库主视图（Plan C Task 12 Step 5）：类型/librarySource 筛选 + 文件夹导航 + 网格/历史面板
 * 双模式。按职责拆到同目录下的 MaterialFilterBar / MaterialFolderSidebar / MaterialGrid /
 * MaterialHistoryPanel（本文件此前 876 行，若不拆会更臃肿——拆分见 task-12-brief 的自评估）。
 * `materials/page.tsx` 保持 6 行不变，筛选/状态卡全部落在这里。
 */
export function MaterialLibraryView() {
  const t = useTranslations('materials');
  const tc = useTranslations('common');

  const {
    items,
    loading,
    loadMaterials: loadStoredMaterials,
    uploadMaterialFiles,
    deleteMaterial,
    deleteMaterials,
    moveMaterials,
    downloadMaterial,
  } = useMaterialStore();

  const sidebar = useMaterialFolderStore((s) => s.sidebar);
  const activeFolderId = useMaterialFolderStore((s) => s.activeFolderId);
  const setActiveFolder = useMaterialFolderStore((s) => s.setActiveFolder);
  const loadFolders = useMaterialFolderStore((s) => s.loadFolders);
  const createFolder = useMaterialFolderStore((s) => s.createFolder);
  const renameFolder = useMaterialFolderStore((s) => s.renameFolder);
  const deleteFolder = useMaterialFolderStore((s) => s.deleteFolder);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [librarySource, setLibrarySource] = useState<LibrarySourceFilter>('ALL');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingFolder, setDeletingFolder] = useState<MaterialFolder | null>(null);

  const isHistoryMode = librarySource === 'HISTORY';
  const selectedCount = selectedIds.size;

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const folders = sidebar?.folders ?? [];

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const loadMaterials = useCallback(async () => {
    if (isHistoryMode) return;
    try {
      const folderId = activeFolderId === 'all' ? undefined : activeFolderId === 'root' ? 'root' : activeFolderId;
      await loadStoredMaterials({
        type: filterType,
        search: search.trim() || undefined,
        pageSize: 80,
        folderId,
        librarySource: librarySource === 'ALL' ? undefined : librarySource,
      });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('loadFailed'));
    }
  }, [filterType, loadStoredMaterials, search, activeFolderId, librarySource, isHistoryMode, t]);

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

    const uploadFiles = Array.from(files);
    const uploadFolderId = activeFolderId === 'all' || activeFolderId === 'root' ? null : activeFolderId;
    setUploading(true);
    try {
      await uploadMaterialFiles(
        uploadFiles.map((file) => ({
          type: inferMaterialType(file),
          file,
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          thumbnailUrl: inferMaterialType(file) === 'image' ? undefined : null,
          sourceType: 'upload',
          folderId: uploadFolderId,
        })),
      );
      toast.success(t('uploadedCount', { count: uploadFiles.length }));
      await Promise.all([loadMaterials(), loadFolders()]);
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
    await Promise.all([loadMaterials(), loadFolders()]);
  };

  const deleteSelected = async () => {
    if (selectedCount === 0) return;
    await deleteMaterials(Array.from(selectedIds));
    toast.success(t('deleteSelectedSuccess', { count: selectedCount }));
    await Promise.all([loadMaterials(), loadFolders()]);
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

  const clearSelection = () => setSelectedIds(new Set());

  const openDownload = async (asset: MaterialAsset) => {
    try {
      const url = await downloadMaterial(asset.id);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('downloadFailed'));
    }
  };

  const handleMove = async (ids: string[], folderId: string | null) => {
    await moveMaterials(ids, folderId);
    clearSelection();
    await loadFolders();
    await loadMaterials();
  };

  const requestDeleteFolder = (folder: MaterialFolder) => setDeletingFolder(folder);

  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    try {
      await deleteFolder(deletingFolder.id);
      await loadMaterials();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingFolder(null);
    }
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

      {deletingFolder && (
        <DeleteFolderDialog
          folder={deletingFolder}
          message={t('deleteFolderConfirm', { count: deletingFolder.assetCount })}
          cancelLabel={tc('cancel')}
          confirmLabel={t('deleteFolder')}
          onCancel={() => setDeletingFolder(null)}
          onConfirm={() => void handleConfirmDeleteFolder()}
        />
      )}

      <header className="border-b border-border bg-background/95 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void Promise.all([loadMaterials(), loadFolders()])}
              disabled={loading || uploading}
            >
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              {t('refresh')}
            </Button>
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t('upload')}
            </Button>
          </div>
        </div>
      </header>

      {!isHistoryMode && (
        <MaterialFolderMobileSelector
          folders={folders}
          totalAssetCount={sidebar?.totalAssetCount}
          rootAssetCount={sidebar?.rootAssetCount}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolder}
        />
      )}

      <MaterialFilterBar
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        librarySource={librarySource}
        onLibrarySourceChange={setLibrarySource}
        search={search}
        onSearchChange={setSearch}
      />

      {!isHistoryMode && selectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-2 text-sm">
          <span>{t('selectedCount', { count: selectedCount })}</span>
          <div className="flex items-center gap-2">
            {selectedItems.length === 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => void openDownload(selectedItems[0]!)}>
                {t('download')}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={invertSelection}>
              {t('invertSelection')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              {t('clearSelection')}
            </Button>
            <MoveToMenu
              folders={folders}
              onMove={(folderId) => handleMove(Array.from(selectedIds), folderId)}
              label={t('moveTo')}
              uncategorizedLabel={t('uncategorized')}
            />
            <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()}>
              {t('deleteSelected')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!isHistoryMode && (
          <MaterialFolderSidebarNav
            folders={folders}
            totalAssetCount={sidebar?.totalAssetCount}
            rootAssetCount={sidebar?.rootAssetCount}
            activeFolderId={activeFolderId}
            onSelectFolder={setActiveFolder}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onRequestDeleteFolder={requestDeleteFolder}
          />
        )}

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          {isHistoryMode ? (
            <MaterialHistoryPanel />
          ) : loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t('loading')}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <p className="text-sm font-medium">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('emptyDescription')}</p>
            </div>
          ) : (
            <MaterialGrid
              items={items}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onDelete={(asset) => void deleteOne(asset)}
              onDownload={(asset) => void openDownload(asset)}
              folders={folders}
              onMove={handleMove}
            />
          )}
        </main>
      </div>
    </div>
  );
}
