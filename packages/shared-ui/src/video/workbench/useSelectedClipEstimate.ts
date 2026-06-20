'use client';

import { useEffect, useState } from 'react';
import {
  type GenerationPricingEstimate,
  type ModelConfigItem,
  type VideoClip,
  videoWorkbenchActions,
} from '@autix/shared-store';
import {
  buildVideoEstimateInput,
  resolveClipVideoModel,
} from './constants';

interface UseSelectedClipEstimateOptions {
  selectedClip: VideoClip | null;
  canGenerate: boolean;
  videoModels: ModelConfigItem[];
}

export function useSelectedClipEstimate({
  selectedClip,
  canGenerate,
  videoModels,
}: UseSelectedClipEstimateOptions) {
  const [estimate, setEstimate] = useState<GenerationPricingEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedClip || !canGenerate) {
      setEstimate(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const videoModel = resolveClipVideoModel(selectedClip, videoModels);
      const estimateInput = buildVideoEstimateInput(selectedClip, videoModel);
      videoWorkbenchActions
        .estimateGeneration(estimateInput)
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
  }, [canGenerate, selectedClip, videoModels]);

  return {
    estimate,
    loading,
  };
}
