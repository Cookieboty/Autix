'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type ModelConfigItem,
  type VideoClip,
  videoWorkbenchActions,
} from '@autix/shared-store';
import {
  buildVideoBatchEstimateInput,
  buildVideoEstimateInput,
  resolveClipVideoModel,
  type VideoClipEstimate,
  type VideoEstimateTarget,
} from './constants';

interface UseVideoWorkbenchEstimateControllerOptions {
  projectId: string | null;
  generatingCount: number;
  clips: VideoClip[];
  videoModels: ModelConfigItem[];
  estimateFailedMessage: string;
  syncStoryboardPromptToClips: () => Promise<unknown>;
  generateClip: (clipId: string) => Promise<unknown>;
  generateAll: () => Promise<unknown>;
}

export function useVideoWorkbenchEstimateController({
  projectId,
  generatingCount,
  clips,
  videoModels,
  estimateFailedMessage,
  syncStoryboardPromptToClips,
  generateClip,
  generateAll,
}: UseVideoWorkbenchEstimateControllerOptions) {
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateTarget, setEstimateTarget] = useState<VideoEstimateTarget | null>(null);
  const [clipEstimates, setClipEstimates] = useState<VideoClipEstimate[]>([]);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    videoWorkbenchActions
      .getAccountBalance()
      .then((balance) => {
        if (cancelled) return;
        setAccountBalance(balance);
      })
      .catch(() => {
        if (!cancelled) setAccountBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, generatingCount]);

  const resetEstimateDialog = useCallback(() => {
    setEstimateTarget(null);
    setClipEstimates([]);
    setEstimateError(null);
  }, []);

  const handleEstimateOpenChange = useCallback(
    (open: boolean) => {
      setEstimateOpen(open);
      if (!open) resetEstimateDialog();
    },
    [resetEstimateDialog],
  );

  const estimateVideoClips = useCallback(async (target: VideoEstimateTarget) => {
    if (generatingCount > 0) return;
    const targetClips =
      target.mode === 'single'
        ? clips.filter((clip) => clip.id === target.clipId)
        : clips.filter((clip) => target.clipIds.includes(clip.id));
    if (targetClips.length === 0) return;

    setEstimateTarget(target);
    setEstimateOpen(true);
    setEstimateLoading(true);
    setEstimateError(null);
    setClipEstimates([]);

    try {
      if (target.mode === 'batch') {
        const estimateInput = buildVideoBatchEstimateInput(targetClips, videoModels);
        if (!estimateInput) return;
        const estimate = await videoWorkbenchActions.estimateGeneration(estimateInput);
        setClipEstimates([
          {
            clip: targetClips[0],
            estimate,
            taskType: estimateInput.taskType,
            seconds: estimateInput.params.seconds,
            resolution: estimateInput.params.resolution,
            referenceImages: estimateInput.params.referenceImages,
            hasVideoInput: estimateInput.params.hasVideoInput,
            hasAudioInput: estimateInput.params.hasAudioInput,
            submittedClipCount: targetClips.length,
          },
        ]);
      } else {
        const clip = targetClips[0];
        const estimateInput = buildVideoEstimateInput(clip, resolveClipVideoModel(clip, videoModels));
        const estimate = await videoWorkbenchActions.estimateGeneration(estimateInput);
        setClipEstimates([
          {
            clip,
            estimate,
            taskType: estimateInput.taskType,
            seconds: estimateInput.params.seconds,
            resolution: estimateInput.params.resolution,
            referenceImages: estimateInput.params.referenceImages,
            hasVideoInput: estimateInput.params.hasVideoInput,
            hasAudioInput: estimateInput.params.hasAudioInput,
          },
        ]);
      }
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : estimateFailedMessage);
    } finally {
      setEstimateLoading(false);
    }
  }, [clips, estimateFailedMessage, generatingCount, videoModels]);

  const handleConfirmVideoGenerate = useCallback(async () => {
    const target = estimateTarget;
    if (!target) return;
    await syncStoryboardPromptToClips();
    setEstimateOpen(false);
    setEstimateTarget(null);
    setClipEstimates([]);
    const total = clipEstimates.reduce((sum, item) => sum + item.estimate.estimatedCost, 0);
    setAccountBalance((cur) => (cur == null ? cur : Math.max(0, cur - total)));
    if (target.mode === 'single') {
      await generateClip(target.clipId);
    } else {
      await generateAll();
    }
  }, [clipEstimates, estimateTarget, generateAll, generateClip, syncStoryboardPromptToClips]);

  return {
    estimateOpen,
    estimateLoading,
    estimateError,
    clipEstimates,
    accountBalance,
    handleEstimateOpenChange,
    estimateVideoClips,
    handleConfirmVideoGenerate,
  };
}
