'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Upload, FolderOpen, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { materialsApi, videoProjectApi, type MaterialAsset, type MaterialAssetType } from '@autix/shared-lib';
import { useVideoProjectStore, type VideoClip } from '@autix/shared-store';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

interface MaterialPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
  clipId: string;
  projectId: string;
  clips?: VideoClip[];
}

type TabId = 'upload' | 'library';

function materialTypeForRole(role: string): MaterialAssetType {
  if (role === 'reference_video') return 'video';
  if (role === 'reference_audio') return 'audio';
  return 'image';
}

export function MaterialPicker({ open, onOpenChange, role, clipId, projectId, clips }: MaterialPickerProps) {
  const t = useTranslations('videoWorkbench.materialPicker');
  const tRoles = useTranslations('videoWorkbench.materialPicker.roles');
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [libraryItems, setLibraryItems] = useState<MaterialAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const { addMaterial, removeMaterial } = useVideoProjectStore();

  void projectId;

  const materialRoleLabel = useCallback(
    (currentRole: string) => {
      if (currentRole === 'first_frame') return tRoles('firstFrame');
      if (currentRole === 'last_frame') return tRoles('lastFrame');
      if (currentRole === 'reference_image') return tRoles('referenceImage');
      if (currentRole === 'reference_video') return tRoles('referenceVideo');
      if (currentRole === 'reference_audio') return tRoles('referenceAudio');
      return tRoles('default');
    },
    [tRoles],
  );

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = useMemo(
    () => [
      { id: 'upload', label: t('tabs.upload'), icon: <Upload className="size-3.5" /> },
      { id: 'library', label: t('tabs.library'), icon: <FolderOpen className="size-3.5" /> },
    ],
    [t],
  );

  const orderedClips = useMemo<VideoClip[]>(() => {
    if (!clips || clips.length === 0) return [];
    const sorted = [...clips].sort((a, b) => a.order - b.order);
    const startIndex = sorted.findIndex((clip) => clip.id === clipId);
    if (startIndex <= 0) return sorted;
    return [...sorted.slice(startIndex), ...sorted.slice(0, startIndex)];
  }, [clips, clipId]);

  const availableTargetClips = useMemo<VideoClip[]>(() => {
    if (orderedClips.length === 0) return [];
    return orderedClips.filter((clip) => !clip.materials.some((material) => material.role === role));
  }, [orderedClips, role]);

  const batchEnabled = availableTargetClips.length > 1;
  const batchCapacity = batchEnabled ? availableTargetClips.length : 1;
  const totalClips = orderedClips.length;
  const filledClips = totalClips - availableTargetClips.length;

  useEffect(() => {
    if (!open) {
      setSelectedAssetIds([]);
      return;
    }
    if (activeTab === 'library') {
      materialsApi
        .list({ type: materialTypeForRole(role), pageSize: 60 })
        .then((res) => setLibraryItems(res.data.items ?? []))
        .catch(() => setLibraryItems([]));
    }
  }, [open, activeTab, role]);

  useEffect(() => {
    setSelectedAssetIds((prev) => (prev.length > batchCapacity ? prev.slice(0, batchCapacity) : prev));
  }, [batchCapacity]);

  const applyAssetsToClips = useCallback(
    async (assets: { url: string; name?: string | null; sourceType: string; sourceId?: string | null; metadata?: Record<string, unknown> | null }[]) => {
      if (assets.length === 0) return;
      const targetClips: Pick<VideoClip, 'id' | 'materials'>[] = batchEnabled
        ? availableTargetClips.slice(0, assets.length)
        : availableTargetClips.length === 1
          ? availableTargetClips
          : [orderedClips.find((clip) => clip.id === clipId) ?? ({ id: clipId, materials: [] } as Pick<VideoClip, 'id' | 'materials'>)];
      for (let i = 0; i < targetClips.length; i += 1) {
        const target = targetClips[i];
        const asset = assets[i];
        if (!target || !asset) continue;
        const existing = target.materials?.find((material) => material.role === role) ?? null;
        if (existing) {
          try {
            await removeMaterial(existing.id);
          } catch {
            // Local drafts are overwritten by addMaterial; persisted projects are validated by the backend.
          }
        }
        await addMaterial(target.id, {
          role,
          sourceType: asset.sourceType,
          sourceId: asset.sourceId ?? undefined,
          url: asset.url,
          name: asset.name ?? undefined,
          metadata: asset.metadata ?? undefined,
        });
      }
    },
    [availableTargetClips, batchEnabled, orderedClips, clipId, role, addMaterial, removeMaterial],
  );

  const handleConfirmLibrary = useCallback(async () => {
    if (selectedAssetIds.length === 0) return;
    const picked = selectedAssetIds
      .map((id) => libraryItems.find((item) => item.id === id))
      .filter((item): item is MaterialAsset => Boolean(item))
      .slice(0, batchCapacity);
    if (picked.length === 0) return;
    setWorking(true);
    try {
      await Promise.all(picked.map((asset) => materialsApi.use(asset.id).catch(() => null)));
      await applyAssetsToClips(
        picked.map((asset) => ({
          url: asset.url,
          name: asset.title,
          sourceType: 'platform_asset',
          sourceId: asset.id,
          metadata: { materialAssetId: asset.id, sourceType: asset.sourceType },
        })),
      );
      const matched = Math.min(picked.length, batchCapacity);
      if (batchEnabled) toast.success(t('toasts.libraryAppliedBatch', { count: matched }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.libraryError'));
    } finally {
      setWorking(false);
    }
  }, [selectedAssetIds, libraryItems, batchCapacity, applyAssetsToClips, batchEnabled, onOpenChange, t]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files ? Array.from(e.target.files) : [];
      if (fileList.length === 0) return;
      const files = fileList.slice(0, batchCapacity);
      setWorking(true);
      try {
        const uploaded: { url: string; name: string }[] = [];
        for (const file of files) {
          const res = await videoProjectApi.uploadUrl({
            fileName: file.name,
            contentType: file.type,
            folder: 'video-materials',
          });
          const { uploadUrl, publicUrl } = res.data as { uploadUrl: string; publicUrl: string };
          await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          uploaded.push({ url: publicUrl, name: file.name });
        }
        await applyAssetsToClips(
          uploaded.map((item) => ({
            url: item.url,
            name: item.name,
            sourceType: 'upload',
          })),
        );
        if (batchEnabled && uploaded.length > 1) {
          toast.success(t('toasts.uploadAppliedBatch', { count: uploaded.length }));
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toasts.uploadError'));
      } finally {
        setWorking(false);
        e.target.value = '';
      }
    },
    [applyAssetsToClips, batchCapacity, batchEnabled, onOpenChange, t],
  );

  const toggleAssetSelection = useCallback(
    (assetId: string) => {
      setSelectedAssetIds((prev) => {
        if (prev.includes(assetId)) return prev.filter((id) => id !== assetId);
        if (prev.length >= batchCapacity) {
          toast.message(t('toasts.selectionLimit', { count: batchCapacity }), {
            description: batchEnabled ? t('toasts.selectionLimitDescription') : undefined,
          });
          return prev;
        }
        return [...prev, assetId];
      });
    },
    [batchCapacity, batchEnabled, t],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[480px] flex flex-col">
        <SheetHeader className="px-6">
          <SheetTitle>{t('title', { role: materialRoleLabel(role) })}</SheetTitle>
          {totalClips > 1 && (
            <p className="text-xs text-muted-foreground">
              {batchEnabled
                ? t('description.batch', {
                  role: materialRoleLabel(role),
                  count: batchCapacity,
                  skipped: filledClips,
                })
                : availableTargetClips.length === 1
                  ? t('description.singleAvailable', { role: materialRoleLabel(role) })
                  : t('description.allFilled', { role: materialRoleLabel(role) })}
            </p>
          )}
        </SheetHeader>

        <div className="flex gap-1 border-b border-border px-6 pb-2 pt-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {activeTab === 'upload' && (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <label className="relative flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors">
                <Upload className="size-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {batchEnabled
                    ? t('upload.dropAreaBatch', { count: batchCapacity })
                    : t('upload.dropArea')}
                </p>
                <input
                  type="file"
                  multiple={batchEnabled}
                  accept={role === 'reference_audio' ? 'audio/*' : role === 'reference_video' ? 'video/*' : 'image/*'}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={handleFileUpload}
                  disabled={working}
                />
              </label>
              {working && <p className="text-xs text-muted-foreground">{t('upload.processing')}</p>}
            </div>
          )}

          {activeTab === 'library' && (
            <div className={materialTypeForRole(role) === 'image' ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
              {libraryItems.map((item) => {
                const selectionIndex = selectedAssetIds.indexOf(item.id);
                const selected = selectionIndex >= 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`group relative aspect-video overflow-hidden rounded-md border transition-all ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:ring-2 hover:ring-primary/30'}`}
                    onClick={() => toggleAssetSelection(item.id)}
                    title={item.title}
                  >
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
                    ) : item.type === 'video' ? (
                      <video src={item.url} poster={item.thumbnailUrl ?? undefined} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted px-2 text-center">
                        <FolderOpen className="size-6 text-muted-foreground" />
                        <span className="line-clamp-2 text-xs text-muted-foreground">{item.title}</span>
                      </div>
                    )}
                    {selected && (
                      <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow">
                        {batchEnabled ? selectionIndex + 1 : <Check className="size-3" />}
                      </span>
                    )}
                  </button>
                );
              })}
              {libraryItems.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted-foreground py-10">{t('library.empty')}</p>
              )}
            </div>
          )}
        </div>

        {activeTab === 'library' && libraryItems.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-6 pb-4 pt-3">
            <span className="text-xs text-muted-foreground">
              {t('library.selectionCount', { selected: selectedAssetIds.length, total: batchCapacity })}
            </span>
            <div className="flex items-center gap-2">
              {selectedAssetIds.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedAssetIds([])} disabled={working}>
                  {t('library.clear')}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => void handleConfirmLibrary()}
                disabled={working || selectedAssetIds.length === 0}
              >
                {working
                  ? t('library.applying')
                  : batchEnabled
                    ? t('library.applyBatchOrder', { count: Math.min(selectedAssetIds.length, batchCapacity) })
                    : t('library.useSelected')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
