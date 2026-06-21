'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { type VideoClip, type VideoProject, videoWorkbenchActions } from '@autix/shared-store';
import { toast } from 'sonner';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  clipParams,
  extractStoryboardPromptFromDirectorContent,
  suggestStoryboardClipDuration,
  type VideoWorkspaceMode,
} from './constants';
import {
  buildStoryboardGenerationMessage,
  buildStoryboardGenerationSharedParams,
  buildStoryboardPromptOptimizationMessage,
  buildVideoPromptOptimizationMessage,
  resolveStoryboardToolClipCount,
} from './director-messages';

interface VideoWorkbenchDirectorMessages {
  directorDefaultFallback: string;
  directorRequestFailed: string;
  emptyStoryboardPrompt: string;
  emptyVideoPrompt: string;
  storyboardPromptOptimized: string;
  videoPromptOptimized: string;
  storyboardPromptOptimizeFailed: string;
  videoPromptOptimizeFailed: string;
  emptyStoryboardIdea: string;
  storyboardGeneratedSuccess: string;
  storyboardGenerateFailed: string;
  storyboardGenerated: (count: number) => string;
  shotTitleFallback: (order: number) => string;
}

interface UseVideoWorkbenchDirectorControllerOptions {
  project: VideoProject | null;
  clips: VideoClip[];
  selectedClip: VideoClip | null;
  workspaceMode: VideoWorkspaceMode;
  globalVideoParams: Record<string, unknown>;
  storyboardPrompt: string;
  storyboardToolPrompt: string;
  storyboardToolClipCount: number;
  storyboardToolLoading: boolean;
  promptOptimizing: boolean;
  directorModelId: string | null;
  persistDraftProject: (options?: { withConversation?: boolean }) => Promise<{
    project: VideoProject;
    clipIdMap: Record<string, string>;
  }>;
  loadProject: (id: string) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  setWorkspaceMode: Dispatch<SetStateAction<VideoWorkspaceMode>>;
  setStoryboardPrompt: Dispatch<SetStateAction<string>>;
  setGlobalVideoParams: Dispatch<SetStateAction<Record<string, unknown>>>;
  setStoryboardToolPrompt: Dispatch<SetStateAction<string>>;
  setStoryboardToolsOpen: Dispatch<SetStateAction<boolean>>;
  setStoryboardToolLoading: Dispatch<SetStateAction<boolean>>;
  setPromptOptimizing: Dispatch<SetStateAction<boolean>>;
  messages: VideoWorkbenchDirectorMessages;
}

export function useVideoWorkbenchDirectorController({
  project,
  clips,
  selectedClip,
  workspaceMode,
  globalVideoParams,
  storyboardPrompt,
  storyboardToolPrompt,
  storyboardToolClipCount,
  storyboardToolLoading,
  promptOptimizing,
  directorModelId,
  persistDraftProject,
  loadProject,
  deleteClip,
  setWorkspaceMode,
  setStoryboardPrompt,
  setGlobalVideoParams,
  setStoryboardToolPrompt,
  setStoryboardToolsOpen,
  setStoryboardToolLoading,
  setPromptOptimizing,
  messages,
}: UseVideoWorkbenchDirectorControllerOptions) {
  const {
    directorDefaultFallback,
    directorRequestFailed,
    emptyStoryboardPrompt,
    emptyVideoPrompt,
    storyboardPromptOptimized,
    videoPromptOptimized,
    storyboardPromptOptimizeFailed,
    videoPromptOptimizeFailed,
    emptyStoryboardIdea,
    storyboardGeneratedSuccess,
    storyboardGenerateFailed,
    storyboardGenerated,
    shotTitleFallback,
  } = messages;

  const openStoryboardTool = useCallback(
    (promptSeed?: string) => {
      const seed =
        promptSeed?.trim() ||
        storyboardPrompt.trim() ||
        selectedClip?.prompt?.trim() ||
        '';
      setStoryboardToolPrompt(seed);
      setStoryboardToolsOpen(true);
    },
    [
      selectedClip?.prompt,
      setStoryboardToolPrompt,
      setStoryboardToolsOpen,
      storyboardPrompt,
    ],
  );

  const runDirectorMessage = useCallback(
    async (message: string, fallbackContent?: string, _displayContent = message) => {
      const safeFallback = fallbackContent ?? directorDefaultFallback;
      if (!message.trim() || !project) return null;
      try {
        const persisted = await persistDraftProject({ withConversation: true });
        const serverProject = persisted.project;
        const res = await videoWorkbenchActions.directorChat(serverProject.id, {
          message,
          modelId: directorModelId ?? undefined,
        });
        const content = res.content || safeFallback;
        await loadProject(serverProject.id);
        return {
          content,
          projectId: serverProject.id,
          clipIdMap: persisted.clipIdMap,
        };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : directorRequestFailed);
        throw err;
      }
    },
    [
      directorDefaultFallback,
      directorModelId,
      directorRequestFailed,
      loadProject,
      persistDraftProject,
      project,
    ],
  );

  const handleOptimizeSelectedPrompt = useCallback(async () => {
    if (!selectedClip || !project || promptOptimizing) return;
    const isStoryboardMode = workspaceMode === 'storyboard';
    const prompt = isStoryboardMode ? storyboardPrompt.trim() : selectedClip.prompt?.trim();
    if (!prompt) {
      toast.info(isStoryboardMode ? emptyStoryboardPrompt : emptyVideoPrompt);
      return;
    }

    setPromptOptimizing(true);
    try {
      const params = {
        ...DEFAULT_VIDEO_PARAMS,
        ...globalVideoParams,
        ...clipParams(selectedClip),
        generationMode: workspaceMode,
        ...(isStoryboardMode ? { storyboardPrompt } : {}),
      };
      if (isStoryboardMode) {
        const message = buildStoryboardPromptOptimizationMessage({
          clip: selectedClip,
          title: selectedClip.title || shotTitleFallback(selectedClip.order),
          params,
          prompt,
        });
        const result = await runDirectorMessage(
          message,
          storyboardPromptOptimized,
          `AI 优化整片提示词：\n${prompt}`,
        );
        const optimizedPrompt = extractStoryboardPromptFromDirectorContent(result?.content);
        if (optimizedPrompt) {
          setStoryboardPrompt(optimizedPrompt);
          setGlobalVideoParams((prev) => ({
            ...prev,
            generationMode: 'storyboard',
            storyboardPrompt: optimizedPrompt,
          }));
        }
        toast.success(storyboardPromptOptimized);
        return;
      }

      const message = buildVideoPromptOptimizationMessage({
        clip: selectedClip,
        title: selectedClip.title || shotTitleFallback(selectedClip.order),
        params,
        prompt,
      });
      await runDirectorMessage(message, videoPromptOptimized, `AI 优化当前视频提示词：\n${prompt}`);
      toast.success(videoPromptOptimized);
    } catch {
      toast.error(isStoryboardMode ? storyboardPromptOptimizeFailed : videoPromptOptimizeFailed);
    } finally {
      setPromptOptimizing(false);
    }
  }, [
    emptyStoryboardPrompt,
    emptyVideoPrompt,
    globalVideoParams,
    project,
    promptOptimizing,
    runDirectorMessage,
    selectedClip,
    setGlobalVideoParams,
    setPromptOptimizing,
    setStoryboardPrompt,
    shotTitleFallback,
    storyboardPrompt,
    storyboardPromptOptimized,
    storyboardPromptOptimizeFailed,
    videoPromptOptimized,
    videoPromptOptimizeFailed,
    workspaceMode,
  ]);

  const handleGenerateStoryboardFromTool = useCallback(async () => {
    const prompt = storyboardToolPrompt.trim();
    if (!prompt || storyboardToolLoading || !project) {
      if (!prompt) toast.info(emptyStoryboardIdea);
      return;
    }

    setStoryboardToolLoading(true);
    try {
      setWorkspaceMode('storyboard');
      const targetCount = resolveStoryboardToolClipCount(storyboardToolClipCount);
      const suggestedClipDuration = suggestStoryboardClipDuration(targetCount);
      const suggestedTotalDuration = Math.min(
        STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
        suggestedClipDuration * targetCount,
      );
      const sharedParams = buildStoryboardGenerationSharedParams({
        globalVideoParams,
        selectedClip,
        storyboardPrompt,
      });
      const extraClips = [...clips]
        .filter((clip) => clip.order > targetCount)
        .sort((a, b) => b.order - a.order);
      const message = buildStoryboardGenerationMessage({
        prompt,
        targetCount,
        suggestedClipDuration,
        suggestedTotalDuration,
        sharedParams,
      });
      const result = await runDirectorMessage(
        message,
        storyboardGenerated(targetCount),
        `生成 ${targetCount} 个分镜脚本：\n${prompt}`,
      );
      if (result) {
        for (const clip of extraClips) {
          await deleteClip(result.clipIdMap[clip.id] ?? clip.id);
        }
      }
      setStoryboardToolsOpen(false);
      toast.success(storyboardGeneratedSuccess);
    } catch {
      toast.error(storyboardGenerateFailed);
    } finally {
      setStoryboardToolLoading(false);
    }
  }, [
    clips,
    deleteClip,
    emptyStoryboardIdea,
    globalVideoParams,
    project,
    runDirectorMessage,
    selectedClip,
    setStoryboardToolLoading,
    setStoryboardToolsOpen,
    setWorkspaceMode,
    storyboardGenerated,
    storyboardGeneratedSuccess,
    storyboardGenerateFailed,
    storyboardPrompt,
    storyboardToolClipCount,
    storyboardToolLoading,
    storyboardToolPrompt,
  ]);

  return {
    openStoryboardTool,
    handleOptimizeSelectedPrompt,
    handleGenerateStoryboardFromTool,
  };
}
