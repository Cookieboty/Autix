'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import type { ModelConfigItem, VideoClip } from '@autix/shared-store';
import {
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  clipParams,
  type VideoWorkspaceMode,
} from './constants';
import {
  buildStoryboardClipParams,
  resolveNextStoryboardClipDuration,
} from './storyboard-clip-helpers';

interface VideoWorkbenchClipControllerMessages {
  insufficientDuration: string;
  storyboardClipTitle: (order: number) => string;
}

interface UseVideoWorkbenchClipControllerOptions {
  clips: VideoClip[];
  videoModels: ModelConfigItem[];
  workspaceMode: VideoWorkspaceMode;
  globalVideoParams: Record<string, unknown>;
  storyboardPrompt: string;
  setGlobalVideoParams: Dispatch<SetStateAction<Record<string, unknown>>>;
  setStoryboardPrompt: Dispatch<SetStateAction<string>>;
  setWorkspaceMode: Dispatch<SetStateAction<VideoWorkspaceMode>>;
  addClip: (data: {
    title?: string;
    prompt?: string;
    params: Record<string, unknown>;
    chainFromPrev?: boolean;
  }) => Promise<void>;
  updateClip: (
    clipId: string,
    data: {
      title?: string;
      prompt?: string;
      params?: Record<string, unknown>;
      chainFromPrev?: boolean;
    },
  ) => Promise<void>;
  messages: VideoWorkbenchClipControllerMessages;
}

export function useVideoWorkbenchClipController({
  clips,
  videoModels,
  workspaceMode,
  globalVideoParams,
  storyboardPrompt,
  setGlobalVideoParams,
  setStoryboardPrompt,
  setWorkspaceMode,
  addClip,
  updateClip,
  messages,
}: UseVideoWorkbenchClipControllerOptions) {
  const { insufficientDuration, storyboardClipTitle } = messages;

  const updateSelectedClipParams = useCallback(
    async (partial: Record<string, unknown>, removeKeys: string[] = []) => {
      setGlobalVideoParams((prev) => {
        const next = { ...prev };
        for (const key of removeKeys) delete next[key];
        return { ...next, ...partial };
      });
      if (clips.length === 0) return;
      await Promise.all(
        clips.map((clip) => {
          const nextParams = { ...clipParams(clip) };
          for (const key of removeKeys) delete nextParams[key];
          return updateClip(clip.id, { params: { ...nextParams, ...partial } });
        }),
      );
    },
    [clips, setGlobalVideoParams, updateClip],
  );

  const handleStoryboardPromptChange = useCallback(
    (prompt: string) => {
      setStoryboardPrompt(prompt);
      const trimmedPrompt = prompt.trim();
      setGlobalVideoParams((prev) => {
        const next: Record<string, unknown> = { ...prev, generationMode: 'storyboard' };
        if (trimmedPrompt) {
          next.storyboardPrompt = prompt;
        } else {
          delete next.storyboardPrompt;
        }
        return next;
      });
    },
    [setGlobalVideoParams, setStoryboardPrompt],
  );

  const syncStoryboardPromptToClips = useCallback(
    async () => {
      if (workspaceMode !== 'storyboard') return;
      const trimmedPrompt = storyboardPrompt.trim();
      await updateSelectedClipParams(
        trimmedPrompt
          ? { generationMode: 'storyboard', storyboardPrompt }
          : { generationMode: 'storyboard' },
        trimmedPrompt ? [] : ['storyboardPrompt'],
      );
    },
    [storyboardPrompt, updateSelectedClipParams, workspaceMode],
  );

  const handleModeChange = useCallback(
    async (mode: VideoWorkspaceMode) => {
      setWorkspaceMode(mode);
      setGlobalVideoParams((prev) => ({ ...prev, generationMode: mode }));
      if (clips.length === 0) return;
      await Promise.all(
        clips.map((clip) => {
          const nextParams = { ...clipParams(clip), generationMode: mode };
          return updateClip(clip.id, {
            params: nextParams,
            ...(mode === 'storyboard' ? {} : { chainFromPrev: false }),
          });
        }),
      );
    },
    [clips, setGlobalVideoParams, setWorkspaceMode, updateClip],
  );

  const handleVideoModelChange = useCallback(
    async (modelConfigId: string) => {
      const selectedModel = videoModels.find((model) => model.id === modelConfigId);
      if (!modelConfigId) {
        await updateSelectedClipParams({}, ['modelConfigId', 'model']);
        return;
      }
      await updateSelectedClipParams({
        modelConfigId,
        ...(selectedModel?.model ? { model: selectedModel.model } : {}),
      });
    },
    [updateSelectedClipParams, videoModels],
  );

  const handleAddStoryboardClip = useCallback(
    async (duration: number) => {
      const nextDuration = resolveNextStoryboardClipDuration(clips, duration);
      if (nextDuration < STORYBOARD_TIMELINE_MIN_CLIP_DURATION) {
        toast.info(insufficientDuration);
        return;
      }

      const params = buildStoryboardClipParams({
        duration: nextDuration,
        globalVideoParams,
        storyboardPrompt,
      });

      setWorkspaceMode('storyboard');
      await addClip({
        title: storyboardClipTitle(clips.length + 1),
        prompt: '',
        params,
        chainFromPrev: clips.length > 0,
      });
    },
    [
      addClip,
      clips,
      globalVideoParams,
      insufficientDuration,
      setWorkspaceMode,
      storyboardClipTitle,
      storyboardPrompt,
    ],
  );

  return {
    updateSelectedClipParams,
    handleStoryboardPromptChange,
    syncStoryboardPromptToClips,
    handleModeChange,
    handleVideoModelChange,
    handleAddStoryboardClip,
  };
}
