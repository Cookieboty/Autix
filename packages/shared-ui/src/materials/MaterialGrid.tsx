'use client';

import {
  AlertTriangle,
  Download,
  FileIcon,
  FolderIcon,
  ImageIcon,
  Music,
  Trash2,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  isMaterialUsable,
  type MaterialAsset,
  type MaterialAssetType,
  type MaterialFolder,
} from '@autix/shared-store';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { cn } from '../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const SOURCE_KEYS: Record<string, string> = {
  upload: 'upload',
  image_generation: 'imageGeneration',
  video_generation: 'videoGeneration',
  external: 'external',
};

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

export interface MoveToMenuProps {
  folders: MaterialFolder[];
  onMove: (folderId: string | null) => Promise<void>;
  label: string;
  uncategorizedLabel: string;
  /** Plan C Task 10：会员过期只允许"其他文件夹 → 默认"，此处禁用移入任何具体文件夹的选项。 */
  moveRestricted?: boolean;
  restrictedHint?: string;
}

export function MoveToMenu({
  folders,
  onMove,
  label,
  uncategorizedLabel,
  moveRestricted,
  restrictedHint,
}: MoveToMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FolderIcon className="size-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void onMove(null)}>{uncategorizedLabel}</DropdownMenuItem>
        {folders.length > 0 && <DropdownMenuSeparator />}
        {folders.map((f) => (
          <DropdownMenuItem
            key={f.id}
            disabled={moveRestricted}
            title={moveRestricted ? restrictedHint : undefined}
            onClick={() => !moveRestricted && void onMove(f.id)}
          >
            {f.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** sourceState=blocked/missing/unpublished 的占位卡：不渲染媒体，只展示状态说明，use/download 全禁用。 */
function UnavailableMaterialCard({
  asset,
  selected,
  onSelectedChange,
  onDelete,
}: {
  asset: MaterialAsset;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('materials');
  const stateKey = asset.sourceState ?? 'blocked';
  return (
    <article
      className={cn(
        'group overflow-hidden rounded-lg border bg-card/60 shadow-sm',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border/60',
      )}
    >
      <div className="relative flex aspect-square flex-col items-center justify-center gap-2 bg-muted/50 p-4 text-center">
        <div className="absolute left-2 top-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={t('selectAsset', { title: asset.title })}
          />
        </div>
        <AlertTriangle className="size-8 text-amber-500/80" />
        <p className="text-xs font-medium text-muted-foreground">{t(`sourceState.${stateKey}`)}</p>
      </div>
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-muted-foreground" title={asset.title}>
          {asset.title}
        </h3>
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="h-8 flex-1" disabled title={t('sourceStateActionDisabled')}>
            <Download className="size-4" />
            {t('download')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            className="size-8"
            onClick={onDelete}
            aria-label={t('deleteAsset')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
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
  moveRestricted,
  restrictedHint,
}: {
  asset: MaterialAsset;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onDelete: () => void;
  onDownload: () => void;
  folders: MaterialFolder[];
  onMove: (folderId: string | null) => Promise<void>;
  moveRestricted?: boolean;
  restrictedHint?: string;
}) {
  const t = useTranslations('materials');

  if (!isMaterialUsable(asset.sourceState)) {
    return (
      <UnavailableMaterialCard
        asset={asset}
        selected={selected}
        onSelectedChange={onSelectedChange}
        onDelete={onDelete}
      />
    );
  }

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
          <img
            src={asset.url}
            alt={asset.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
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
        {asset.librarySource === 'FAVORITE' ? (
          <div className="absolute right-2 top-2">
            <Badge variant="secondary" className="bg-black/55 text-white backdrop-blur-sm">
              {t('librarySource.FAVORITE')}
            </Badge>
          </div>
        ) : null}
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
          <MoveToMenu
            folders={folders}
            onMove={onMove}
            label={t('moveTo')}
            uncategorizedLabel={t('uncategorized')}
            moveRestricted={moveRestricted}
            restrictedHint={restrictedHint}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            className="size-8"
            onClick={onDelete}
            aria-label={t('deleteAsset')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function MaterialGrid({
  items,
  selectedIds,
  onToggleSelected,
  onDelete,
  onDownload,
  folders,
  onMove,
  moveRestricted,
  restrictedHint,
}: {
  items: MaterialAsset[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string, checked: boolean) => void;
  onDelete: (asset: MaterialAsset) => void;
  onDownload: (asset: MaterialAsset) => void;
  folders: MaterialFolder[];
  onMove: (ids: string[], folderId: string | null) => Promise<void>;
  moveRestricted?: boolean;
  restrictedHint?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1920px]:grid-cols-7">
      {items.map((asset) => (
        <MaterialCard
          key={asset.id}
          asset={asset}
          selected={selectedIds.has(asset.id)}
          onSelectedChange={(checked) => onToggleSelected(asset.id, checked)}
          onDelete={() => onDelete(asset)}
          onDownload={() => onDownload(asset)}
          folders={folders}
          onMove={(folderId) => onMove([asset.id], folderId)}
          moveRestricted={moveRestricted}
          restrictedHint={restrictedHint}
        />
      ))}
    </div>
  );
}
