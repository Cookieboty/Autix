import {
  FolderOpen,
  ImageIcon,
  Loader2,
  Music2,
  Plus,
  Search,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MaterialAsset, MaterialAssetType } from '@autix/shared-store';
import { Button } from '../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  MATERIAL_TARGET_VALUES,
  canUseMaterialAsTarget,
  defaultMaterialTargetForType,
  roleLabel,
  type MaterialTargetLabelMessages,
  type VideoMaterialTarget,
} from '../constants';

export function VideoInspirationMaterials({
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
