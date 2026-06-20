'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderOpen,
  Loader2,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import {
  type MaterialAsset,
  videoWorkbenchActions,
} from '@autix/shared-store';
import {
  createLocalVideoProject,
  useVideoProjectStore,
  type VideoClip,
} from '@autix/shared-store';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/button';
import {
  DEFAULT_VIDEO_PARAMS,
  STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
  STORYBOARD_TIMELINE_MIN_CLIP_DURATION,
  STORYBOARD_TIMELINE_TOTAL_MAX_DURATION,
  buildTemplateDraft,
  buildVideoEstimateInput,
  canGenerateClip,
  canUseMaterialAsTarget,
  clampStoryboardClipDuration,
  clipParams,
  defaultMaterialTargetForType,
  isVideoWorkspaceMode,
  resolveClipVideoModel,
  extractStoryboardPromptFromDirectorContent,
  resolveStoryboardPrompt,
  roleLabel,
  resolveLatestCompletedVideoGeneration,
  suggestStoryboardClipDuration,
  type VideoClipEstimate,
  type VideoEstimateTarget,
  type VideoInspirationTab,
  type VideoWorkspaceMode,
  type WorkbenchVideoTemplate,
} from './workbench/constants';
import { useSelectedClipEstimate } from './workbench/useSelectedClipEstimate';
import { useVideoWorkbenchMaterials } from './workbench/useVideoWorkbenchMaterials';
import { useVideoWorkbenchModels } from './workbench/useVideoWorkbenchModels';
import { useVideoWorkbenchTemplates } from './workbench/useVideoWorkbenchTemplates';
import { VideoParameterPanel } from './workbench/panels/VideoParameterPanel';
import { VideoWorkspaceConfigPanel } from './workbench/panels/VideoWorkspaceConfigPanel';
import { VideoProductPanel } from './workbench/panels/VideoProductPanel';
import { StoryboardToolsDialog } from './workbench/dialogs/StoryboardToolsDialog';
import { VideoInspirationSheet } from './workbench/dialogs/VideoInspirationSheet';
import { VideoEstimateDialog } from './workbench/dialogs/VideoEstimateDialog';
import {
  buildStoryboardGenerationMessage,
  buildStoryboardGenerationSharedParams,
  buildStoryboardPromptOptimizationMessage,
  buildVideoPromptOptimizationMessage,
  resolveStoryboardToolClipCount,
} from './workbench/director-messages';

export function VideoWorkbenchWorkspace({
  initialTemplateId = null,
  initialWorkflowTemplateId = null,
}: {
  initialTemplateId?: string | null;
  initialWorkflowTemplateId?: string | null;
} = {}) {
  const {
    project,
    projects,
    loading,
    selectedClipId,
    loadProject,
    loadProjects,
    loadOrCreateStandaloneProject,
    persistDraftProject,
    replaceDraftProject,
    selectClip,
    addClip,
    updateClip,
    deleteClip,
    addMaterial,
    removeMaterial,
    generateClip,
    generateAll,
    generatingClipIds,
    lastError,
  } = useVideoProjectStore();
  const t = useTranslations('videoWorkbench.workspace');
  const tToast = useTranslations('videoWorkbench.toasts');
  const tMaterialTargets = useTranslations('videoWorkbench.materialTargets');
  const materialTargetMessages = useMemo(
    () => ({
      firstFrame: tMaterialTargets('firstFrame'),
      lastFrame: tMaterialTargets('lastFrame'),
      referenceImage: tMaterialTargets('referenceImage'),
      referenceVideo: tMaterialTargets('referenceVideo'),
      referenceAudio: tMaterialTargets('referenceAudio'),
    }),
    [tMaterialTargets],
  );
  const [paramsOpen, setParamsOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [inspirationTab, setInspirationTab] = useState<VideoInspirationTab>('history');
  const [storyboardToolsOpen, setStoryboardToolsOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<VideoWorkspaceMode>('storyboard');
  const [globalVideoParams, setGlobalVideoParams] = useState<Record<string, unknown>>(
    () => ({ ...DEFAULT_VIDEO_PARAMS }),
  );
  const globalParamsSeededRef = useRef<string | null>(null);
  const {
    templates,
    templatesLoading,
    templateSearch,
    setTemplateSearch,
    templateCategory,
    setTemplateCategory,
    templateCategories,
    filteredTemplates,
  } = useVideoWorkbenchTemplates({ initialTemplateId, initialWorkflowTemplateId });
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const {
    materials,
    materialsLoading,
    materialSearch,
    setMaterialSearch,
    materialType,
    setMaterialType,
    materialTarget,
    setMaterialTarget,
  } = useVideoWorkbenchMaterials({ open: inspirationOpen, tab: inspirationTab });
  const {
    directorModels,
    directorModelId,
    setDirectorModelId,
    directorModelsLoading,
    videoModels,
    videoModelsLoading,
  } = useVideoWorkbenchModels();
  const [promptOptimizing, setPromptOptimizing] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState('');
  const [storyboardToolPrompt, setStoryboardToolPrompt] = useState('');
  const [storyboardToolClipCount, setStoryboardToolClipCount] = useState(5);
  const [storyboardToolLoading, setStoryboardToolLoading] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateTarget, setEstimateTarget] = useState<VideoEstimateTarget | null>(null);
  const [clipEstimates, setClipEstimates] = useState<VideoClipEstimate[]>([]);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [appliedInitialTemplateId, setAppliedInitialTemplateId] = useState<string | null>(null);
  const creatingInitialClipRef = useRef(false);

  useEffect(() => {
    void loadOrCreateStandaloneProject();
  }, [loadOrCreateStandaloneProject]);

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
  }, [project?.id, generatingClipIds.length]);

  const clips = project?.clips ?? [];
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0] ?? null;

  useEffect(() => {
    if (!project || clips.length > 0 || creatingInitialClipRef.current) return;
    creatingInitialClipRef.current = true;
    addClip({
      title: t('initialClipTitle'),
      prompt: '',
      params: { ...DEFAULT_VIDEO_PARAMS, generationMode: workspaceMode },
      chainFromPrev: false,
    }).finally(() => {
      creatingInitialClipRef.current = false;
    });
  }, [addClip, clips.length, project, workspaceMode, t]);

  useEffect(() => {
    const projectKey = project?.id ?? null;
    if (globalParamsSeededRef.current === projectKey) return;
    if (!projectKey) {
      globalParamsSeededRef.current = null;
      return;
    }
    const seedClip = clips[0];
    if (!seedClip) {
      setStoryboardPrompt('');
      return;
    }
    const seedParams = clipParams(seedClip);
    const seededStoryboardPrompt = resolveStoryboardPrompt(clips);
    setStoryboardPrompt(seededStoryboardPrompt);
    setGlobalVideoParams({
      ...DEFAULT_VIDEO_PARAMS,
      ...seedParams,
      ...(seededStoryboardPrompt ? { storyboardPrompt: seededStoryboardPrompt } : {}),
    });
    const seededMode = seedParams.generationMode;
    if (isVideoWorkspaceMode(seededMode)) setWorkspaceMode(seededMode);
    globalParamsSeededRef.current = projectKey;
  }, [project?.id, clips]);

  useEffect(() => {
    if (inspirationOpen && inspirationTab === 'history') {
      void loadProjects();
    }
  }, [inspirationOpen, inspirationTab, loadProjects]);

  const selectedLatestGeneration = useMemo(
    () => resolveLatestCompletedVideoGeneration(selectedClip),
    [selectedClip],
  );
  const selectedClipCanGenerate = useMemo(
    () =>
      Boolean(
        selectedClip &&
        (canGenerateClip(selectedClip) ||
          (workspaceMode === 'storyboard' && storyboardPrompt.trim())),
      ),
    [selectedClip, storyboardPrompt, workspaceMode],
  );
  const {
    estimate: selectedClipEstimate,
    loading: selectedClipEstimateLoading,
  } = useSelectedClipEstimate({
    selectedClip,
    canGenerate: selectedClipCanGenerate,
    videoModels,
  });

  const handleCreateBlankProject = useCallback(() => {
    replaceDraftProject(createLocalVideoProject());
    setInspirationOpen(false);
    setStoryboardToolsOpen(false);
  }, [replaceDraftProject]);

  const handleOpenHistoryProject = useCallback(
    async (projectId: string) => {
      await loadProject(projectId);
      setInspirationOpen(false);
      setStoryboardToolsOpen(false);
    },
    [loadProject],
  );

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
    [selectedClip?.prompt, storyboardPrompt],
  );

  const runDirectorMessage = useCallback(
    async (message: string, fallbackContent?: string, _displayContent = message) => {
      const safeFallback = fallbackContent ?? tToast('directorDefaultFallback');
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
        toast.error(err instanceof Error ? err.message : tToast('directorRequestFailed'));
        throw err;
      }
    },
    [directorModelId, loadProject, persistDraftProject, project, tToast],
  );

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
    [clips, updateClip],
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
    [],
  );

  const syncStoryboardPromptToClips = useCallback(async () => {
    if (workspaceMode !== 'storyboard') return;
    const trimmedPrompt = storyboardPrompt.trim();
    await updateSelectedClipParams(
      trimmedPrompt
        ? { generationMode: 'storyboard', storyboardPrompt }
        : { generationMode: 'storyboard' },
      trimmedPrompt ? [] : ['storyboardPrompt'],
    );
  }, [storyboardPrompt, updateSelectedClipParams, workspaceMode]);

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
    [clips, updateClip],
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

  useEffect(() => {
    if (videoModels.length === 0) return;
    const currentId = typeof globalVideoParams.modelConfigId === 'string' ? globalVideoParams.modelConfigId : '';
    const stillExists = currentId && videoModels.some((model) => model.id === currentId);
    if (stillExists) return;
    const fallbackId = videoModels[0]?.id;
    if (!fallbackId || fallbackId === currentId) return;
    void handleVideoModelChange(fallbackId);
  }, [videoModels, globalVideoParams.modelConfigId, handleVideoModelChange]);

  const handleAddStoryboardClip = useCallback(
    async (duration: number) => {
      const fallbackDuration = suggestStoryboardClipDuration(clips.length || 1);
      const currentTotalDuration = clips.reduce(
        (total, clip) => total + clampStoryboardClipDuration(clipParams(clip).duration ?? fallbackDuration),
        0,
      );
      const remainingDuration = Math.max(0, STORYBOARD_TIMELINE_TOTAL_MAX_DURATION - currentTotalDuration);
      const nextDuration = Math.min(
        STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
        remainingDuration,
        Number.isFinite(duration) ? duration : STORYBOARD_TIMELINE_MAX_CLIP_DURATION,
      );

      if (nextDuration < STORYBOARD_TIMELINE_MIN_CLIP_DURATION) {
        toast.info(tToast('insufficientDuration'));
        return;
      }

      const trimmedStoryboardPrompt = storyboardPrompt.trim();
      const params: Record<string, unknown> = {
        ...DEFAULT_VIDEO_PARAMS,
        ...globalVideoParams,
        generationMode: 'storyboard',
        duration: nextDuration,
        ...(trimmedStoryboardPrompt ? { storyboardPrompt } : {}),
      };
      delete params.startTime;
      delete params.endTime;
      delete params.start;
      delete params.end;

      setWorkspaceMode('storyboard');
      await addClip({
        title: t('storyboardClipTitle', { order: clips.length + 1 }),
        prompt: '',
        params,
        chainFromPrev: clips.length > 0,
      });
    },
    [addClip, clips, globalVideoParams, storyboardPrompt, t, tToast],
  );

  const handleUseMaterialAsset = useCallback(
    async (asset: MaterialAsset) => {
      if (!selectedClip) {
        toast.info(tToast('selectClipFirst'));
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
        toast.success(tToast('placedInto', { target: roleLabel(target, materialTargetMessages) }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : tToast('materialUseFailed'));
      }
    },
    [addMaterial, materialTarget, materialTargetMessages, selectedClip, tToast],
  );

  const handleSwapFirstLastFrame = useCallback(async () => {
    if (!selectedClip) return;
    const first = selectedClip.materials.find((material) => material.role === 'first_frame');
    const last = selectedClip.materials.find((material) => material.role === 'last_frame');
    if (!first && !last) {
      toast.info(tToast('noFramesToSwap'));
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
      toast.success(tToast('swappedFrames'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tToast('swapFramesFailed'));
    }
  }, [addMaterial, removeMaterial, selectedClip, tToast]);

  const handleOptimizeSelectedPrompt = useCallback(async () => {
    if (!selectedClip || !project || promptOptimizing) return;
    const isStoryboardMode = workspaceMode === 'storyboard';
    const prompt = isStoryboardMode ? storyboardPrompt.trim() : selectedClip.prompt?.trim();
    if (!prompt) {
      toast.info(isStoryboardMode ? tToast('emptyStoryboardPrompt') : tToast('emptyVideoPrompt'));
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
          title: selectedClip.title || t('shotTitleFallback', { order: selectedClip.order }),
          params,
          prompt,
        });
        const result = await runDirectorMessage(
          message,
          tToast('storyboardPromptOptimized'),
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
        toast.success(tToast('storyboardPromptOptimized'));
        return;
      }

      const message = buildVideoPromptOptimizationMessage({
        clip: selectedClip,
        title: selectedClip.title || t('shotTitleFallback', { order: selectedClip.order }),
        params,
        prompt,
      });
      await runDirectorMessage(message, tToast('videoPromptOptimized'), `AI 优化当前视频提示词：\n${prompt}`);
      toast.success(tToast('videoPromptOptimized'));
    } catch {
      toast.error(isStoryboardMode ? tToast('storyboardPromptOptimizeFailed') : tToast('videoPromptOptimizeFailed'));
    } finally {
      setPromptOptimizing(false);
    }
  }, [
    globalVideoParams,
    project,
    promptOptimizing,
    runDirectorMessage,
    selectedClip,
    storyboardPrompt,
    workspaceMode,
    t,
    tToast,
  ]);

  const handleGenerateStoryboardFromTool = useCallback(async () => {
    const prompt = storyboardToolPrompt.trim();
    if (!prompt || storyboardToolLoading || !project) {
      if (!prompt) toast.info(tToast('emptyStoryboardIdea'));
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
        tToast('storyboardGenerated', { count: targetCount }),
        `生成 ${targetCount} 个分镜脚本：\n${prompt}`,
      );
      if (result) {
        for (const clip of extraClips) {
          await deleteClip(result.clipIdMap[clip.id] ?? clip.id);
        }
      }
      setStoryboardToolsOpen(false);
      toast.success(tToast('storyboardGeneratedSuccess'));
    } catch {
      toast.error(tToast('storyboardGenerateFailed'));
    } finally {
      setStoryboardToolLoading(false);
    }
  }, [
    clips,
    deleteClip,
    globalVideoParams,
    project,
    runDirectorMessage,
    selectedClip,
    storyboardPrompt,
    storyboardToolClipCount,
    storyboardToolLoading,
    storyboardToolPrompt,
    tToast,
  ]);

  const estimateVideoClips = useCallback(async (target: VideoEstimateTarget) => {
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
      const results = await Promise.all(
        targetClips.map(async (clip): Promise<VideoClipEstimate> => {
          const estimateInput = buildVideoEstimateInput(clip, resolveClipVideoModel(clip, videoModels));
          const estimate = await videoWorkbenchActions.estimateGeneration(estimateInput);
          return {
            clip,
            estimate,
            taskType: estimateInput.taskType,
            seconds: estimateInput.seconds,
            resolution: estimateInput.resolution,
            referenceImages: estimateInput.referenceImages,
            hasVideoInput: estimateInput.hasVideoInput,
            hasAudioInput: estimateInput.hasAudioInput,
          };
        }),
      );
      setClipEstimates(results);
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : tToast('estimateFailed'));
    } finally {
      setEstimateLoading(false);
    }
  }, [clips, videoModels, tToast]);

  const handleRequestClipGenerate = useCallback(
    async (clip: VideoClip) => {
      await syncStoryboardPromptToClips();
      void estimateVideoClips({ mode: 'single', clipId: clip.id });
    },
    [estimateVideoClips, syncStoryboardPromptToClips],
  );

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

  const handleApplyTemplate = async (template: WorkbenchVideoTemplate) => {
    setApplyingTemplateId(template.templateKey);
    try {
      setInspirationOpen(false);
      replaceDraftProject(buildTemplateDraft(template));
      setWorkspaceMode(template.templateKind === 'workflow' ? 'storyboard' : 'standard');
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const handleAddSelectedVideoToMaterial = useCallback(async () => {
    if (!selectedLatestGeneration?.videoUrl) return;
    try {
      await videoWorkbenchActions.createMaterial({
        type: 'video',
        title: selectedClip?.title || project?.title || tToast('defaultMaterialTitle'),
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
      toast.success(tToast('addedToMaterials'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tToast('addToMaterialsFailed'));
    }
  }, [project?.title, selectedClip?.title, selectedLatestGeneration, tToast]);

  useEffect(() => {
    const targetId = initialWorkflowTemplateId ?? initialTemplateId;
    if (!targetId || templatesLoading || appliedInitialTemplateId === targetId) return;
    const target = templates.find((template) => {
      if (initialWorkflowTemplateId) {
        return template.templateKind === 'workflow' && template.id === initialWorkflowTemplateId;
      }
      return template.templateKind === 'standard' && template.id === initialTemplateId;
    });
    if (!target) return;
    setAppliedInitialTemplateId(targetId);
    void handleApplyTemplate(target);
  }, [
    appliedInitialTemplateId,
    initialTemplateId,
    initialWorkflowTemplateId,
    templates,
    templatesLoading,
  ]);

  if (loading && !project) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 bg-background text-foreground">
      {paramsOpen && (
        <button
          type="button"
          aria-label={t('closeParamsAria')}
          className="fixed inset-0 z-30 bg-background/65 backdrop-blur-sm xl:hidden"
          onClick={() => setParamsOpen(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project?.title ?? t('headerTitle')}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {t('headerSubtitle')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 xl:hidden" onClick={() => setParamsOpen(true)}>
              <PanelLeftOpen className="size-3.5" />
              <span className="hidden sm:inline">{t('paramsButton')}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateBlankProject}>
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">{t('newButton')}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInspirationOpen(true)}>
              <FolderOpen className="size-3.5" />
              <span className="hidden sm:inline">{t('inspirationButton')}</span>
            </Button>
          </div>
        </header>

        {lastError && (
          <div className="border-b border-destructive/20 bg-destructive/8 px-4 py-2 text-sm text-destructive">
            {lastError}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)]">
          <VideoParameterPanel
            open={paramsOpen}
            mode={workspaceMode}
            params={globalVideoParams}
            hasClip={Boolean(selectedClip)}
            onClose={() => setParamsOpen(false)}
            onModeChange={(mode) => void handleModeChange(mode)}
            onParamChange={(partial, removeKeys) => void updateSelectedClipParams(partial, removeKeys)}
          />

          <div className="min-h-0 overflow-y-auto p-4">
            <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4">
              <VideoProductPanel
                selectedClip={selectedClip}
                isGenerating={generatingClipIds.length > 0}
                onAddSelectedVideoToMaterial={() => void handleAddSelectedVideoToMaterial()}
              />

              <VideoWorkspaceConfigPanel
                mode={workspaceMode}
                clips={clips}
                selectedClip={selectedClip}
                selectedClipId={selectedClip?.id ?? null}
                storyboardPrompt={storyboardPrompt}
                projectId={project?.id ?? ''}
                onSelectClip={selectClip}
                onOpenTools={() => openStoryboardTool(storyboardPrompt)}
                onAddClip={(duration) => void handleAddStoryboardClip(duration)}
                onStoryboardPromptChange={handleStoryboardPromptChange}
                onStoryboardPromptBlur={() => void syncStoryboardPromptToClips()}
                onPromptChange={(clip, prompt) => void updateClip(clip.id, { prompt })}
                onTitleChange={(clip, title) => void updateClip(clip.id, { title })}
                onClipDurationChange={(clip, duration) =>
                  void updateClip(clip.id, { params: { ...clipParams(clip), duration } })
                }
                onDeleteClip={(clip) => void deleteClip(clip.id)}
                onOptimizePrompt={() => void handleOptimizeSelectedPrompt()}
                optimizingPrompt={promptOptimizing}
                onSwapFirstLastFrame={() => void handleSwapFirstLastFrame()}
                textModelId={directorModelId}
                textModels={directorModels}
                textModelsLoading={directorModelsLoading}
                modelConfigId={
                  typeof globalVideoParams.modelConfigId === 'string'
                    ? globalVideoParams.modelConfigId
                    : ''
                }
                videoModels={videoModels}
                videoModelsLoading={videoModelsLoading}
                estimatedCost={selectedClipEstimate?.estimatedCost ?? null}
                estimatingCost={selectedClipEstimateLoading}
                canGenerate={selectedClipCanGenerate}
                onTextModelChange={setDirectorModelId}
                onVideoModelChange={(modelId) => void handleVideoModelChange(modelId)}
                onGenerate={(clip) => handleRequestClipGenerate(clip)}
              />
            </div>
          </div>
        </div>
      </main>

      <VideoInspirationSheet
        open={inspirationOpen}
        onOpenChange={setInspirationOpen}
        tab={inspirationTab}
        onTabChange={setInspirationTab}
        templates={filteredTemplates}
        categories={templateCategories}
        templatesLoading={templatesLoading}
        templateSearch={templateSearch}
        templateCategory={templateCategory}
        applyingId={applyingTemplateId}
        onTemplateSearchChange={setTemplateSearch}
        onTemplateCategoryChange={setTemplateCategory}
        onApply={(template) => void handleApplyTemplate(template)}
        historyProjects={projects}
        onSelectProject={(projectId) => void handleOpenHistoryProject(projectId)}
        materials={materials}
        materialsLoading={materialsLoading}
        materialSearch={materialSearch}
        materialType={materialType}
        materialTarget={materialTarget}
        onMaterialSearchChange={setMaterialSearch}
        onMaterialTypeChange={setMaterialType}
        onMaterialTargetChange={setMaterialTarget}
        onUseMaterial={(asset) => void handleUseMaterialAsset(asset)}
      />
      <StoryboardToolsDialog
        open={storyboardToolsOpen}
        onOpenChange={setStoryboardToolsOpen}
        prompt={storyboardToolPrompt}
        onPromptChange={setStoryboardToolPrompt}
        clipCount={storyboardToolClipCount}
        onClipCountChange={setStoryboardToolClipCount}
        directorModels={directorModels}
        directorModelId={directorModelId}
        directorModelsLoading={directorModelsLoading}
        onDirectorModelChange={setDirectorModelId}
        loading={storyboardToolLoading}
        onGenerate={() => void handleGenerateStoryboardFromTool()}
      />
      <VideoEstimateDialog
        open={estimateOpen}
        onOpenChange={(open) => {
          setEstimateOpen(open);
          if (!open) {
            setEstimateTarget(null);
            setClipEstimates([]);
            setEstimateError(null);
          }
        }}
        loading={estimateLoading}
        error={estimateError}
        estimates={clipEstimates}
        accountBalance={accountBalance}
        onConfirm={() => void handleConfirmVideoGenerate()}
      />
    </div >
  );
}
