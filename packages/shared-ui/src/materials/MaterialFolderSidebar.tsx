'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, FolderIcon, MoreHorizontal, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ActiveFolderKey, MaterialFolder } from '@autix/shared-store';
import { Button } from '../ui/button';
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

interface DeleteFolderDialogProps {
  folder: MaterialFolder;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteFolderDialog({
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

export interface MaterialFolderNavProps {
  folders: MaterialFolder[];
  totalAssetCount?: number;
  rootAssetCount?: number;
  activeFolderId: ActiveFolderKey;
  onSelectFolder: (key: ActiveFolderKey) => void;
  canCreateFolder: boolean;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onRequestDeleteFolder: (folder: MaterialFolder) => void;
}

/** 桌面端左侧文件夹导航——从 MaterialLibraryView 拆出（Plan C Task 12：拆分职责，控制单文件体量）。 */
export function MaterialFolderSidebarNav({
  folders,
  totalAssetCount,
  rootAssetCount,
  activeFolderId,
  onSelectFolder,
  canCreateFolder,
  onCreateFolder,
  onRenameFolder,
  onRequestDeleteFolder,
}: MaterialFolderNavProps) {
  const t = useTranslations('materials');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  // FIX 1: guard against double-submit on new-folder input (Enter → blur)
  const creatingFolderCommittingRef = useRef(false);

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
      await onCreateFolder(trimmed);
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

  return (
    <aside className="hidden md:block w-48 shrink-0 border-r border-border/60 overflow-y-auto p-3">
      <nav className="space-y-0.5 text-sm">
        <FolderItem
          active={activeFolderId === 'all'}
          label={t('allFolders')}
          count={totalAssetCount}
          onClick={() => onSelectFolder('all')}
        />
        <FolderItem
          active={activeFolderId === 'root'}
          label={t('uncategorized')}
          count={rootAssetCount}
          onClick={() => onSelectFolder('root')}
        />
        {folders.length > 0 && <div className="my-2 h-px bg-border/60" />}
        {folders.map((f) => (
          <FolderItem
            key={f.id}
            active={activeFolderId === f.id}
            label={f.name}
            count={f.assetCount}
            onClick={() => onSelectFolder(f.id)}
            onRename={(name) => onRenameFolder(f.id, name)}
            onDelete={() => onRequestDeleteFolder(f)}
          />
        ))}
        {canCreateFolder && (
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
  );
}

/** 移动端折叠文件夹选择器——同样从 MaterialLibraryView 拆出。 */
export function MaterialFolderMobileSelector({
  folders,
  totalAssetCount,
  rootAssetCount,
  activeFolderId,
  onSelectFolder,
}: Pick<
  MaterialFolderNavProps,
  'folders' | 'totalAssetCount' | 'rootAssetCount' | 'activeFolderId' | 'onSelectFolder'
>) {
  const t = useTranslations('materials');
  const activeFolderLabel =
    activeFolderId === 'all'
      ? t('allFolders')
      : activeFolderId === 'root'
        ? t('uncategorized')
        : (folders.find((f) => f.id === activeFolderId)?.name ?? t('allFolders'));

  return (
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
          <DropdownMenuItem onClick={() => onSelectFolder('all')}>
            {t('allFolders')}
            {totalAssetCount !== undefined && (
              <span className="ml-auto text-xs text-muted-foreground">{totalAssetCount}</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelectFolder('root')}>
            {t('uncategorized')}
            {rootAssetCount !== undefined && (
              <span className="ml-auto text-xs text-muted-foreground">{rootAssetCount}</span>
            )}
          </DropdownMenuItem>
          {folders.length > 0 && <DropdownMenuSeparator />}
          {folders.map((f) => (
            <DropdownMenuItem key={f.id} onClick={() => onSelectFolder(f.id)}>
              {f.name}
              <span className="ml-auto text-xs text-muted-foreground">{f.assetCount}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
