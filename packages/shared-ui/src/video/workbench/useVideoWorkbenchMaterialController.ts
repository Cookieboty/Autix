'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  type MaterialAsset,
  type VideoClip,
  type VideoClipGeneration,
  videoWorkbenchActions,
} from '@autix/shared-store';
import { toast } from 'sonner';
import {
  canUseMaterialAsTarget,
  defaultMaterialTargetForType,
  roleLabel,
  type MaterialTargetLabelMessages,
  type VideoMaterialTarget,
} from './constants';

interface VideoWorkbenchMaterialControllerMessages {
  selectClipFirst: string;
  materialUseFailed: string;
  noFramesToSwap: string;
  swappedFrames: string;
  swapFramesFailed: string;
  defaultMaterialTitle: string;
  addedToMaterials: string;
  addToMaterialsFailed: string;
  placedInto: (target: string) => string;
}

interface UseVideoWorkbenchMaterialControllerOptions {
  selectedClip: VideoClip | null;
  selectedLatestGeneration: VideoClipGeneration | null;
  projectTitle: string | null | undefined;
  materialTarget: VideoMaterialTarget;
  materialTargetMessages: MaterialTargetLabelMessages;
  setMaterialTarget: Dispatch<SetStateAction<VideoMaterialTarget>>;
  addMaterial: (
    clipId: string,
    data: {
      role: string;
      sourceType: string;
      sourceId?: string;
      url: string;
      name?: string;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<void>;
  removeMaterial: (materialId: string) => Promise<void>;
  messages: VideoWorkbenchMaterialControllerMessages;
}

export function useVideoWorkbenchMaterialController({
  selectedClip,
  selectedLatestGeneration,
  projectTitle,
  materialTarget,
  materialTargetMessages,
  setMaterialTarget,
  addMaterial,
  removeMaterial,
  messages,
}: UseVideoWorkbenchMaterialControllerOptions) {
  const {
    selectClipFirst,
    materialUseFailed,
    noFramesToSwap,
    swappedFrames,
    swapFramesFailed,
    defaultMaterialTitle,
    addedToMaterials,
    addToMaterialsFailed,
    placedInto,
  } = messages;

  const handleUseMaterialAsset = useCallback(
    async (asset: MaterialAsset) => {
      if (!selectedClip) {
        toast.info(selectClipFirst);
        return;
      }
      const target = canUseMaterialAsTarget(asset, materialTarget)
        ? materialTarget
        : defaultMaterialTargetForType(asset.type);
      try {
        await videoWorkbenchActions.useMaterial(asset.id);
        await addMaterial(selectedClip.id, {
          role: target,
          sourceType: 'platform_asset',
          sourceId: asset.id,
          url: asset.url,
          name: asset.title,
          metadata: { materialAssetId: asset.id, sourceType: asset.sourceType },
        });
        setMaterialTarget(target);
        toast.success(placedInto(roleLabel(target, materialTargetMessages)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : materialUseFailed);
      }
    },
    [
      addMaterial,
      materialTarget,
      materialTargetMessages,
      materialUseFailed,
      placedInto,
      selectClipFirst,
      selectedClip,
      setMaterialTarget,
    ],
  );

  const handleSwapFirstLastFrame = useCallback(async () => {
    if (!selectedClip) return;
    const first = selectedClip.materials.find((material) => material.role === 'first_frame');
    const last = selectedClip.materials.find((material) => material.role === 'last_frame');
    if (!first && !last) {
      toast.info(noFramesToSwap);
      return;
    }
    try {
      if (first) await removeMaterial(first.id);
      if (last) await removeMaterial(last.id);
      if (first) {
        await addMaterial(selectedClip.id, {
          role: 'last_frame',
          sourceType: first.sourceType,
          sourceId: first.sourceId ?? undefined,
          url: first.url,
          name: first.name ?? undefined,
          metadata: first.metadata ?? undefined,
        });
      }
      if (last) {
        await addMaterial(selectedClip.id, {
          role: 'first_frame',
          sourceType: last.sourceType,
          sourceId: last.sourceId ?? undefined,
          url: last.url,
          name: last.name ?? undefined,
          metadata: last.metadata ?? undefined,
        });
      }
      toast.success(swappedFrames);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : swapFramesFailed);
    }
  }, [
    addMaterial,
    noFramesToSwap,
    removeMaterial,
    selectedClip,
    swapFramesFailed,
    swappedFrames,
  ]);

  const handleAddSelectedVideoToMaterial = useCallback(async () => {
    if (!selectedLatestGeneration?.videoUrl) return;
    try {
      await videoWorkbenchActions.createMaterial({
        type: 'video',
        title: selectedClip?.title || projectTitle || defaultMaterialTitle,
        url: selectedLatestGeneration.videoUrl,
        thumbnailUrl: selectedLatestGeneration.thumbnailUrl ?? selectedLatestGeneration.lastFrameUrl ?? null,
        sourceType: 'video_generation',
        sourceId: selectedLatestGeneration.id,
        metadata: {
          prompt: selectedLatestGeneration.resolvedPrompt,
          clipId: selectedLatestGeneration.clipId,
          projectId: selectedLatestGeneration.projectId,
          durationSec: selectedLatestGeneration.durationSec ?? null,
        },
      });
      toast.success(addedToMaterials);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : addToMaterialsFailed);
    }
  }, [
    addToMaterialsFailed,
    addedToMaterials,
    defaultMaterialTitle,
    projectTitle,
    selectedClip?.title,
    selectedLatestGeneration,
  ]);

  return {
    handleUseMaterialAsset,
    handleSwapFirstLastFrame,
    handleAddSelectedVideoToMaterial,
  };
}
