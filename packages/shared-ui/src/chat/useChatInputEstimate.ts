'use client';

import { useEffect, useState } from 'react';
import {
  videoWorkbenchActions,
  type AgentKind,
  type GenerationPricingEstimate,
  type ModelConfigItem,
} from '@autix/shared-store';
import type { FrameSlot, VideoMaterial } from '../video/VideoInputArea';
import type { VideoGenMode } from '../video/VideoToolbar';
import {
  buildImageEstimateInput,
  buildVideoEstimateInput,
} from './chat-pricing';

interface UseChatInputEstimateParams {
  activeSessionId: string | null | undefined;
  activeKind: AgentKind;
  selectedImageModel: ModelConfigItem | null;
  selectedVideoModel: ModelConfigItem | null;
  imageQuality: string;
  imageSize: string;
  imageCount: number;
  selectedSourceImageCount: number;
  videoResolutionValue: unknown;
  videoDuration: number;
  videoGenMode: VideoGenMode;
  videoMaterials: VideoMaterial[];
  videoFrames: FrameSlot[];
}

export function useChatInputEstimate({
  activeSessionId,
  activeKind,
  selectedImageModel,
  selectedVideoModel,
  imageQuality,
  imageSize,
  imageCount,
  selectedSourceImageCount,
  videoResolutionValue,
  videoDuration,
  videoGenMode,
  videoMaterials,
  videoFrames,
}: UseChatInputEstimateParams) {
  const [estimate, setEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSessionId || activeKind === 'chat') {
      setEstimate(null);
      setLoading(false);
      return;
    }

    const isImageEstimate = activeKind === 'image' && selectedImageModel;
    const isVideoEstimate = activeKind === 'video' && selectedVideoModel;
    if (!isImageEstimate && !isVideoEstimate) {
      setEstimate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const request =
        activeKind === 'image' && selectedImageModel
          ? videoWorkbenchActions.estimateGeneration(
              buildImageEstimateInput({
                model: selectedImageModel,
                quality: imageQuality,
                size: imageSize,
                count: imageCount,
                referenceImageCount: selectedSourceImageCount,
              }),
            )
          : videoWorkbenchActions.estimateGeneration(
              buildVideoEstimateInput({
                model: selectedVideoModel,
                resolutionValue: videoResolutionValue,
                duration: videoDuration,
                mode: videoGenMode,
                materials: videoMaterials,
                frames: videoFrames,
              }),
            );

      request
        .then((nextEstimate) => {
          if (!cancelled) setEstimate(nextEstimate);
        })
        .catch(() => {
          if (!cancelled) setEstimate(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activeKind,
    activeSessionId,
    imageCount,
    imageQuality,
    imageSize,
    selectedImageModel,
    selectedSourceImageCount,
    selectedVideoModel,
    videoDuration,
    videoFrames,
    videoGenMode,
    videoMaterials,
    videoResolutionValue,
  ]);

  return { estimate, loading };
}
