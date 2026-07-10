'use client';

import { useEffect, useState } from 'react';
import {
  type TaskEstimateResult,
  type ModelConfigItem,
  type VideoClip,
  videoWorkbenchActions,
} from '@autix/shared-store';
import {
  buildVideoBatchEstimateInput,
  buildVideoEstimateInput,
  resolveClipVideoModel,
} from './constants';

interface UseSelectedClipEstimateOptions {
  selectedClip: VideoClip | null;
  canGenerate: boolean;
  videoModels: ModelConfigItem[];
}

interface UseVideoClipsEstimateOptions {
  clips: VideoClip[];
  canGenerate: boolean;
  videoModels: ModelConfigItem[];
}

export function useSelectedClipEstimate({
  selectedClip,
  canGenerate,
  videoModels,
}: UseSelectedClipEstimateOptions) {
  const [estimate, setEstimate] = useState<TaskEstimateResult | null>(null);
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

export function useVideoClipsEstimate({
  clips,
  canGenerate,
  videoModels,
}: UseVideoClipsEstimateOptions) {
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clips.length === 0 || !canGenerate) {
      setEstimatedCost(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const estimateInput = buildVideoBatchEstimateInput(clips, videoModels);
      if (!estimateInput) {
        setEstimatedCost(null);
        setLoading(false);
        return;
      }
      videoWorkbenchActions
        .estimateGeneration(estimateInput)
        .then((estimate) => {
          if (!cancelled) {
            setEstimatedCost(estimate.estimatedCost);
          }
        })
        .catch(() => {
          if (!cancelled) setEstimatedCost(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canGenerate, clips, videoModels]);

  return {
    estimatedCost,
    loading,
  };
}
