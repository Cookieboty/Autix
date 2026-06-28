'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileIcon,
  FolderIcon,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Music,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import {
  MaterialUploadError,
  useMaterialStore,
  useMaterialFolderStore,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialFolder,
} from '@autix/shared-store';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

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

// ── FolderItem subcomponent ──────────────────────────────────────────────────

interface FolderItemProps {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  onRename?: (name: string) => Promise<void>;
  onDelete?: () => void;
}

function FolderItem({ active, label, count, onClick, onRename, onDelete }: FolderItemProps) {
  const t = useTranslations('materials');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(label);
  const renameInputRef = useRef<HTMLInputElement>(null);
  // FIX 1: guard against double-submit when Enter closes the input and blur fires a second commit
  const committingRef = useRef(false);

  const handleRenameStart = () => {
    setRenameValue(label);
    committingRef.current = false; // reset so the new editing session can commit
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const handleRenameCommit = async () => {
    if (!onRename) return;
    if (committingRef.current) return; // FIX 1: block re-entrant call from blur
    committingRef.current = true;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error(t('folderNameRequired'));
      committingRef.current = false; // FIX 2: allow retry, keep input open
      return;
    }
    try {
      await onRename(trimmed);
      setRenaming(false); // FIX 2: only close on success; ref stays true to block blur from unmount
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) toast.error(t('duplicateFolderName'));
      else if (status === 400) toast.error(t('folderNameRequired'));
      else toast.error(err instanceof Error ? err.message : String(err));
      committingRef.current = false; // FIX 2: allow retry; input stays open on all errors
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleRenameCommit();
    if (e.key === 'Escape') setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => void handleRenameCommit()}
          onKeyDown={handleRenameKeyDown}
          className="h-7 text-sm"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        )}
        {(onRename || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-0.5 flex size-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent"
                onClick={(e) => e.stopPropagation()}
                aria-label="Folder actions"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              {onRename && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameStart();
                  }}
                >
                  {t('rename')}
                </DropdownMenuItem>
              )}
              {onRename && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  {t('deleteFolder')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// ── MoveTo dropdown ──────────────────────────────────────────────────────────

interface MoveToMenuProps {
  folders: MaterialFolder[];
  onMove: (folderId: string | null) => Promise<void>;
  label: string;
  uncategorizedLabel: string;
}

function MoveToMenu({ folders, onMove, label, uncategorizedLabel }: MoveToMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FolderIcon className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void onMove(null)}>
          {uncategorizedLabel}
        </DropdownMenuItem>
        {folders.length > 0 && <DropdownMenuSeparator />}
        {folders.map((f) => (
          <DropdownMenuItem key={f.id} onClick={() => void onMove(f.id)}>
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── DeleteFolderDialog ───────────────────────────────────────────────────────

interface DeleteFolderDialogProps {
  folder: MaterialFolder;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteFolderDialog({
  folder,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: DeleteFolderDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {folder.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">{message}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MaterialLibraryView() {
  const t = useTranslations('materials');
  const tc = useTranslations('common');

  const {
    items,
    entitlement,
    loading,
    loadMaterials: loadStoredMaterials,
    uploadMaterialFiles,
    deleteMaterial,
    deleteMaterials,
    moveMaterials,
  } = useMaterialStore();

  const sidebar = useMaterialFolderStore((s) => s.sidebar);
  const activeFolderId = useMaterialFolderStore((s) => s.activeFolderId);
  const setActiveFolder = useMaterialFolderStore((s) => s.setActiveFolder);
  const loadFolders = useMaterialFolderStore((s) => s.loadFolders);
  const createFolder = useMaterialFolderStore((s) => s.createFolder);
  const renameFolder = useMaterialFolderStore((s) => s.renameFolder);
  const deleteFolder = useMaterialFolderStore((s) => s.deleteFolder);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New-folder inline state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  // FIX 1: guard against double-submit on new-folder input (Enter → blur)
  const creatingFolderCommittingRef = useRef(false);

  // Delete-folder confirm state
  const [deletingFolder, setDeletingFolder] = useState<MaterialFolder | null>(null);

  const selectedCount = selectedIds.size;
  const canAdd = Boolean(entitlement?.canAdd);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const folders = sidebar?.folders ?? [];

  // Load folders on mount
  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  // Load materials whenever filter/search/activeFolderId changes
  const loadMaterials = useCallback(async () => {
    try {
      const folderId =
        activeFolderId === 'all'
          ? undefined
          : activeFolderId === 'root'
            ? 'root'
            : activeFolderId;
      await loadStoredMaterials({
        type: filterType,
        search: search.trim() || undefined,
        pageSize: 80,
        folderId,
      });
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('loadFailed'));
    }
  }, [filterType, loadStoredMaterials, search, activeFolderId, t]);

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
    // Upload into the active folder; 'all'/'root' both mean uncategorized (null).
    const uploadFolderId =
      activeFolderId === 'all' || activeFolderId === 'root' ? null : activeFolderId;
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

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openDownload = (asset: MaterialAsset) => {
    window.open(asset.url, '_blank', 'noopener,noreferrer');
  };

  // Move handler (batch or single card)
  const handleMove = async (ids: string[], folderId: string | null) => {
    await moveMaterials(ids, folderId);
    clearSelection();
    await loadFolders();
    await loadMaterials();
  };

  // Create folder
  const handleCreateFolderCommit = async () => {
    if (creatingFolderCommittingRef.current) return; // FIX 1: block re-entrant call from blur
    creatingFolderCommittingRef.current = true;
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      toast.error(t('folderNameRequired'));
      creatingFolderCommittingRef.current = false; // FIX 2: allow retry, keep input open
      return;
    }
    try {
      await createFolder(trimmed);
      setCreatingFolder(false); // FIX 2: only close on success; ref stays true to block blur from unmount
      setNewFolderName('');
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) toast.error(t('duplicateFolderName'));
      else if (status === 400) toast.error(t('folderNameRequired'));
      else toast.error(err instanceof Error ? err.message : String(err));
      creatingFolderCommittingRef.current = false; // FIX 2: allow retry; input stays open on all errors
    }
  };

  const handleCreateFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleCreateFolderCommit();
    if (e.key === 'Escape') {
      setCreatingFolder(false);
      setNewFolderName('');
    }
  };

  const handleStartCreateFolder = () => {
    creatingFolderCommittingRef.current = false; // reset for new editing session
    setCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  };

  // Request folder deletion
  const requestDeleteFolder = (folder: MaterialFolder) => {
    setDeletingFolder(folder);
  };

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

  // Folder label for mobile selector
  const activeFolderLabel =
    activeFolderId === 'all'
      ? t('allFolders')
      : activeFolderId === 'root'
        ? t('uncategorized')
        : (folders.find((f) => f.id === activeFolderId)?.name ?? t('allFolders'));

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

      {/* Delete folder confirm dialog */}
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
              onClick={() => void Promise.all([loadMaterials(), loadFolders()])}
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

      {/* Mobile folder selector — visible below md */}
      <div className="md:hidden border-b border-border px-5 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FolderIcon className="size-4" />
                {activeFolderLabel}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-full">
            <DropdownMenuItem onClick={() => setActiveFolder('all')}>
              {t('allFolders')}
              {sidebar?.totalAssetCount !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">{sidebar.totalAssetCount}</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveFolder('root')}>
              {t('uncategorized')}
              {sidebar?.rootAssetCount !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">{sidebar.rootAssetCount}</span>
              )}
            </DropdownMenuItem>
            {folders.length > 0 && <DropdownMenuSeparator />}
            {folders.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => setActiveFolder(f.id)}>
                {f.name}
                <span className="ml-auto text-xs text-muted-foreground">{f.assetCount}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
              <Button type="button" variant="outline" size="sm" onClick={() => openDownload(selectedItems[0]!)}>
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
            <MoveToMenu
              folders={folders}
              onMove={(folderId) => handleMove(Array.from(selectedIds), folderId)}
              label={t('moveTo')}
              uncategorizedLabel={t('uncategorized')}
            />
            <Button type="button" variant="destructive" size="sm" onClick={() => void deleteSelected()}>
              <Trash2 className="size-4" />
              {t('deleteSelected')}
            </Button>
          </div>
        </div>
      )}

      {/* Body: sidebar + grid */}
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar — hidden on mobile */}
        <aside className="hidden md:block w-48 shrink-0 border-r border-border/60 overflow-y-auto p-3">
          <nav className="space-y-0.5 text-sm">
            <FolderItem
              active={activeFolderId === 'all'}
              label={t('allFolders')}
              count={sidebar?.totalAssetCount}
              onClick={() => setActiveFolder('all')}
            />
            <FolderItem
              active={activeFolderId === 'root'}
              label={t('uncategorized')}
              count={sidebar?.rootAssetCount}
              onClick={() => setActiveFolder('root')}
            />
            {folders.length > 0 && <div className="my-2 h-px bg-border/60" />}
            {folders.map((f) => (
              <FolderItem
                key={f.id}
                active={activeFolderId === f.id}
                label={f.name}
                count={f.assetCount}
                onClick={() => setActiveFolder(f.id)}
                onRename={(name) => renameFolder(f.id, name)}
                onDelete={() => requestDeleteFolder(f)}
              />
            ))}
            {canAdd && (
              <div className="mt-2">
                {creatingFolder ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <Input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onBlur={() => void handleCreateFolderCommit()}
                      onKeyDown={handleCreateFolderKeyDown}
                      placeholder={t('folderNamePlaceholder')}
                      className="h-7 text-sm"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartCreateFolder}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    <Plus className="size-3.5" />
                    {t('newFolder')}
                  </button>
                )}
              </div>
            )}
          </nav>
        </aside>

        {/* Right: materials grid */}
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
                  folders={folders}
                  onMove={(folderId) => handleMove([asset.id], folderId)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MaterialCard({
  asset,
  selected,
  onSelectedChange,
  onDelete,
  onDownload,
  folders,
  onMove,
}: {
  asset: MaterialAsset;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onDelete: () => void;
  onDownload: () => void;
  folders: MaterialFolder[];
  onMove: (folderId: string | null) => Promise<void>;
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
          {/* FIX 3: reuse MoveToMenu instead of duplicating the dropdown inline */}
          <MoveToMenu
            folders={folders}
            onMove={onMove}
            label={t('moveTo')}
            uncategorizedLabel={t('uncategorized')}
          />
          <Button type="button" variant="destructive" size="icon-sm" className="size-8" onClick={onDelete} aria-label={t('deleteAsset')}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
